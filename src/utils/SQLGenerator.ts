import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import backoff from 'backoff';
import dotenv from 'dotenv';
import { GenerativeModel, GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SchemaDict, SqlResponse, DatabaseResponse, TableDescription, LLMResponse, TableSchemaDescription } from '@request/sql';
import mysql from "mysql2/promise";

dotenv.config();

const system_prompt = `
Using valid SQLite, answer the following questions for the tables provided above. 
Additionally, determine the best way to visualize the result based on the query outcome. The visualization type can be:
1. "table": If the result is a tabular dataset. Provide column definitions with "dataIndex" and "name".
2. "chart": If the result is better suited for a visual representation. Specify the chart type as either:
   - "pie": For categorical data with associated numerical values. Provide data in the form of "label" and "value".
   - "line": For time-series or trend data. Provide data points with "label" for the x-axis and "value" for the y-axis. Specify "xAxis" and "yAxis" keys for the corresponding chart axes.
3. "text": For single-value outputs or narrative explanations.

Return the SQL query and the appropriate visualization configuration in JSON format. 

EXAMPLE JSON OUTPUTS:

1. Table visualization:
{
  "sql": "SELECT id, name, age FROM users WHERE age > 30;",
  "visualization": {
    "type": "table",
    "columns": [
      { "dataIndex": "id", "name": "User ID" },
      { "dataIndex": "name", "name": "Name" },
      { "dataIndex": "age", "name": "Age" }
    ]
  }
}

2. Pie chart visualization:
{
  "sql": "SELECT category, COUNT(*) as count FROM sales GROUP BY category;",
  "visualization": {
    "type": "chart",
    "chart": {
      "chartType": "pie",
      "data": [
        { "label": "Electronics", "value": 120 },
        { "label": "Clothing", "value": 80 },
        { "label": "Groceries", "value": 150 }
      ]
    }
  }
}

3. Line chart visualization:
{
  "sql": "SELECT month, revenue FROM sales WHERE year = 2024;",
  "visualization": {
    "type": "chart",
    "chart": {
      "chartType": "line",
      "data": [
        { "label": "January", "value": 10000 },
        { "label": "February", "value": 15000 },
        { "label": "March", "value": 20000 }
      ],
      "xAxis": "label",
      "yAxis": "value"
    }
  }
}

4. Text visualization:
{
  "sql": "SELECT COUNT(*) FROM users;",
  "visualization": {
    "type": "text"
  }
}
`;

export class SQLGenerator {
  private gemini: GenerativeModel;

  constructor() {
    const genAi = new GoogleGenerativeAI(process.env.API_KEY!);
    this.gemini = genAi.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            sql: {
              type: SchemaType.STRING,
              description: system_prompt
            },
            visualization: {
              type: SchemaType.OBJECT,
              description: "Details about how to visualize the result",
              properties: {
                type: {
                  type: SchemaType.STRING,
                  enum: ["table", "chart", "text"],
                  description: "The recommended visualization type"
                },
                chart: {
                  type: SchemaType.OBJECT,
                  description: "Chart configuration, applicable when type is 'chart'",
                  properties: {
                    chartType: {
                      type: SchemaType.STRING,
                      enum: ["pie", "line"],
                      description: "The type of chart to display"
                    },
                    data: {
                      type: SchemaType.ARRAY,
                      items: {
                        type: SchemaType.OBJECT,
                        properties: {
                          label: {
                            type: SchemaType.STRING,
                            description: "The label for the chart data point"
                          },
                          value: {
                            type: SchemaType.NUMBER,
                            description: "The value for the chart data point"
                          }
                        },
                        required: ["label", "value"]
                      },
                      description: "The data points for the chart"
                    },
                    xAxis: {
                      type: SchemaType.STRING,
                      description: "The key used for the x-axis (applicable for line charts)"
                    },
                    yAxis: {
                      type: SchemaType.STRING,
                      description: "The key used for the y-axis (applicable for line charts)"
                    }
                  },
                  required: ["chartType", "data"]
                },
                columns: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      dataIndex: {
                        type: SchemaType.STRING,
                        description: "The key for the table column"
                      },
                      name: {
                        type: SchemaType.STRING,
                        description: "The display name for the table column"
                      }
                    },
                    required: ["dataIndex", "name"]
                  },
                  description: "Column definitions for table visualization"
                }
              },
              required: ["type"]
            }
          },
          required: ["sql", "visualization"]
        }
      }
    });
  }

  private async newDirectory(path: string): Promise<void> {
    try {
      await fs.mkdir(path, { recursive: true });
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code !== 'EEXIST') {
        throw err;
      }
    }
  }

  private async getDbSchemas(benchRoot: string, dbName: string): Promise<SchemaDict> {
    const asdf = benchRoot === 'spider' ? 'database' : 'databases';
    const dbPath = `${benchRoot}/${asdf}/${dbName}/${dbName}.sqlite`;

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READONLY
    });

    const tables = await db.all<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table'");
    const schemas: SchemaDict = {};

    for (const table of tables) {
      const result = await db.get<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        table.name
      );
      if (result && result.sql) {
        schemas[table.name] = result.sql;
      }
    }

    await db.close();
    return schemas;
  }

  private niceLookTable(columnNames: string[], values: unknown[][]): string {
    const widths = columnNames.map((_, i) => {
      return Math.max(
        ...values.map(row => String(row[i]).length),
        String(columnNames[i]).length
      );
    });

    const header = columnNames.map((col, i) =>
      String(col).padEnd(widths[i])).join(' ');

    const rows = values.map(row =>
      row.map((val, i) => String(val).padEnd(widths[i])).join(' ')
    );

    return `${header}\n${rows.join('\n')}`;
  }

  async generateSchemaPrompt(dbPath: string, numRows: number | null = null): Promise<string> {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    const tables = await db.all<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table'");
    const schemas: SchemaDict = {};

    for (const table of tables) {
      if (table.name === 'sqlite_sequence') continue;

      const createSql = await db.get<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        table.name
      );

      if (createSql?.sql) {
        schemas[table.name] = createSql.sql;

        if (numRows) {
          const curTable = ['order', 'by', 'group'].includes(table.name)
            ? `\`${table.name}\``
            : table.name;

          const rows = await db.all(`SELECT * FROM ${curTable} LIMIT ${numRows}`);
          if (rows.length > 0) {
            const columnNames = Object.keys(rows[0]);
            const values = rows.map(row => Object.values(row));
            const rowsPrompt = this.niceLookTable(columnNames, values);

            schemas[table.name] = `${createSql.sql}\n/* \n ${numRows} example rows: \n` +
              `SELECT * FROM ${curTable} LIMIT ${numRows}; \n ${rowsPrompt} \n */`;
          }
        }
      }
    }

    await db.close();
    return Object.values(schemas).join('\n\n');
  }

  async showAllData(dbPath: string, dbId: string): Promise<DatabaseResponse> {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    const res: DatabaseResponse = {
      database: dbId,
      table: []
    }

    const tables = await db.all<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table'");

    for (const table of tables) {
      if (table.name === 'sqlite_sequence') continue;

      const curTable = ['order', 'by', 'group'].includes(table.name)
        ? `\`${table.name}\``
        : table.name;

      const tableInfo: TableDescription = {
        name: table.name,
        columns: [],
        rows: []
      }

      const rows = await db.all(`SELECT * FROM ${curTable} LIMIT 100`); // 加速接口返回
      if (rows.length > 0) {
        const columnNames = Object.keys(rows[0]);
        const values = rows.map(row => Object.values(row));
        // const rowsOutput = this.niceLookTable(columnNames, values);
        tableInfo.columns = columnNames;
        tableInfo.rows = values as (string | number)[][];
        res.table.push(tableInfo);
      } else {
        console.log('该表没有数据。');
      }
    }

    await db.close();

    return res;
  }

  async showDatabseSchema(dbPath: string, dbId: string): Promise<DatabaseResponse<TableSchemaDescription>> {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    const res: DatabaseResponse<TableSchemaDescription> = {
      database: dbId,
      table: []
    }

    const tables = await db.all<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table'");

    for (const table of tables) {
      if (table.name === 'sqlite_sequence') continue;

      const curTable = ['order', 'by', 'group'].includes(table.name)
        ? `\`${table.name}\``
        : table.name;

      const tableInfo: TableSchemaDescription = {
        tableName: table.name,
        columns: []
      }

      const columns = await db.all<{ name: string, type: string, notnull: number, dflt_value: string | null, pk: number }[]>(`PRAGMA table_info(${curTable})`);
      if (columns.length > 0) {
        tableInfo.columns = columns.map(col => ({
          name: col.name,
          type: col.type,
          constraints: [
            col.pk ? 'PRIMARY KEY' : null,
            col.notnull ? 'NOT NULL' : null,
            col.dflt_value ? `DEFAULT ${col.dflt_value}` : null
          ].filter(Boolean).join(' ')
        }));
        res.table.push(tableInfo);
      } else {
        console.log('该表没有数据。');
      }
    }

    await db.close();

    return res;
  }

  async showMysqlDatabaseSchema(connection: mysql.Connection, dbId: string): Promise<DatabaseResponse<TableSchemaDescription>> {
    const res: DatabaseResponse<TableSchemaDescription> = {
      database: dbId,
      table: []
    };

    // 获取所有表名
    const [tables] = await connection.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?", [dbId]) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    for (const table of tables) {
      const tableInfo: TableSchemaDescription = {
        tableName: table.TABLE_NAME,
        columns: []
      };

      // 获取表的列信息
      const [columns] = await connection.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?`, [table.TABLE_NAME, dbId]) as [{ COLUMN_NAME: string, COLUMN_TYPE: string, IS_NULLABLE: string, COLUMN_DEFAULT: string | null, COLUMN_KEY: string }[], mysql.FieldPacket[]];

      if (columns.length > 0) {
        tableInfo.columns = columns.map(col => ({
          name: col.COLUMN_NAME,
          type: col.COLUMN_TYPE,
          constraints: [
            col.COLUMN_KEY === 'PRI' ? 'PRIMARY KEY' : null,
            col.IS_NULLABLE === 'NO' ? 'NOT NULL' : null,
            col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : null
          ].filter(Boolean).join(' ')
        }));
        res.table.push(tableInfo);
      } else {
        console.log('该表没有数据。');
      }
    }

    return res;
  }

  generateCommentPrompt(question: string, knowledge: string | null = null): string {
    const patternPromptNoKg = "-- Using valid SQLite, answer the following questions for the tables provided above.";
    const patternPromptKg = "-- Using valid SQLite and understanding External Knowledge, answer the following questions for the tables provided above.";
    const questionPrompt = `-- ${question}`;
    const knowledgePrompt = knowledge ? `-- External Knowledge: ${knowledge}` : null;

    return knowledge
      ? `${knowledgePrompt}\n${patternPromptKg}\n${questionPrompt}`
      : `${patternPromptNoKg}\n${questionPrompt}`;
  }

  async connectGPT(prompt: string): Promise<unknown> {
    const exponentialBackoff = backoff.exponential({
      initialDelay: 1000,
      maxDelay: 60000
    });

    return new Promise((resolve, reject) => {
      exponentialBackoff.failAfter(5);

      exponentialBackoff.on('ready', async () => {
        try {
          const completion = await this.gemini.generateContent(prompt);
          console.log('the completion is: ', completion);
          resolve(completion.response.text());
          exponentialBackoff.reset();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) { // FIXME
          if ((error).response?.status === 429) {
            exponentialBackoff.backoff();
          } else {
            reject(error);
          }
        }
      });

      exponentialBackoff.on('fail', () => {
        reject(new Error('Max retries reached'));
      });

      exponentialBackoff.backoff();
    });
  }

  async collectResponseFromGPT(
    dbPathList: string[],
    questionList: string[],
    knowledgeList: string[] | null = null
  ): Promise<LLMResponse[]> {
    const responseList: LLMResponse[] = [];

    for (let i = 0; i < questionList.length; i++) {
      console.log(`--------------------- processing ${i}th question ---------------------`);
      console.log(`the question is: ${questionList[i]}`);

      const prompt = await this.generateSchemaPrompt(dbPathList[i]) + '\n' +
        this.generateCommentPrompt(
          questionList[i],
          knowledgeList ? knowledgeList[i] : null
        );

      console.log(`the prompt is: ${prompt}`);

      try {
        const result = JSON.parse(await this.connectGPT(prompt) as string) as LLMResponse;
        console.log(`the result is: ${result}`);
        const sql = result.sql;
        responseList.push({
          ...result,
          sql: sql
        })
        // const sql = JSON.parse(result as string).sql;
        // const dbId = path.basename(dbPathList[i], '.sqlite');
        console.log(`the sql is: ${sql}`);
        // responseList.push(`${sql}\t----- bird -----\t${dbId}`);

      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error processing question ${i}:`, error);
          // responseList.push(`ERROR: ${error.message}`);
        }
      }
    }

    return responseList;
  }

  async generateSqlFile(sqlList: string[], outputPath: string | null = null): Promise<SqlResponse> {
    const result: SqlResponse = Object.fromEntries(sqlList.map((sql, i) => [i, sql]));

    if (outputPath) {
      await this.newDirectory(path.dirname(outputPath));
      await fs.writeFile(outputPath, JSON.stringify(result, null, 4));
    }

    return result;
  }

  // 生成数据库架构提示
  async generateMySQLSchemaPrompt(connection: mysql.Connection, database: string): Promise<string> {
    let schemaPrompt = '';
    const [tables] = await connection.query(`SHOW TABLES FROM \`${database}\``);
    interface TableObject {
      [key: string]: string;
    }

    for (const tableObj of tables as TableObject[]) {
      const tableName = tableObj[`Tables_in_${database}`];
      schemaPrompt += `CREATE TABLE ${tableName} (\n`;
      const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` FROM \`${database}\``);
      const columnDefinitions = (columns as { Field: string, Type: string, Null: string, Key: string }[]).map(col => {
        return `  ${col.Field} ${col.Type}${col.Null === 'NO' ? ' NOT NULL' : ''}${col.Key === 'PRI' ? ' PRIMARY KEY' : ''}`;
      });
      schemaPrompt += columnDefinitions.join(',\n');
      schemaPrompt += `\n);\n\n`;
    }
    return schemaPrompt;
  }

  // 执行生成的 SQL 查询
  async executeMySQLQuery(connection: mysql.Connection, sql: string): Promise<unknown[]> {
    const [results] = await connection.query(sql);
    return results as unknown[];
  }

  async collectMySqlResponseFromGPT(question: string, connection: mysql.Connection): Promise<LLMResponse | string | undefined> {
    const prompt = await this.generateMySQLSchemaPrompt(connection, connection.config.database!);
    const commentPrompt = this.generateCommentPrompt(question);
    const fullPrompt = `${commentPrompt}\n${prompt}`;

    console.log(`the full prompt is: ${fullPrompt}`);
    try {
      const result = JSON.parse(await this.connectGPT(fullPrompt) as string) as LLMResponse;
      return result;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error processing question:`, error);
        return error.message;
      }
    }
  }
}
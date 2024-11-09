import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import OpenAI from "openai";
import backoff from 'backoff';
import { Config, SchemaDict, SqlResponse } from './types';
import dotenv from 'dotenv';

dotenv.config();

const system_prompt = `
Using valid SQLite, answer the following questions for the tables provided above.

EXAMPLE JSON OUTPUT:
{
  "sql": "SELECT * FROM table_name WHERE column_name = 'value';",
}
`

export class SQLGenerator {
  private openai: OpenAI;
  private engine: string;

  constructor(config: Config) {
    this.openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.API_KEY
    });

    this.engine = config.engine;
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
          const completion = await this.openai.chat.completions.create({
            messages: [{ role: 'system', content: system_prompt }, { role: "user", content: prompt }],
            model: this.engine,
            temperature: 0,
            response_format: {
              'type': 'json_object'
            }
          });
          resolve(completion.choices[0].message.content);
          exponentialBackoff.reset();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
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
  ): Promise<string[]> {
    const responseList: string[] = [];

    for (let i = 0; i < questionList.length; i++) {
      console.log(`--------------------- processing ${i}th question ---------------------`);
      console.log(`the question is: ${questionList[i]}`);

      const prompt = await this.generateSchemaPrompt(dbPathList[i]) + '\n' +
        this.generateCommentPrompt(
          questionList[i],
          knowledgeList ? knowledgeList[i] : null
        );

      try {
        const result = await this.connectGPT(prompt);
        // const sql = 'SELECT' + result;
        const sql = JSON.parse(result as string).sql;
        const dbId = path.basename(dbPathList[i], '.sqlite');
        console.log(`the sql is: ${sql}`);
        responseList.push(`${sql}\t----- bird -----\t${dbId}`);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error processing question ${i}:`, error);
          responseList.push(`ERROR: ${error.message}`);
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
}
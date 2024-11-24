// route.ts

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { SQLGenerator } from "../../../utils/SQLGenerator";
import { IGeneralResponse } from "@request/api";
import mysql from "mysql2/promise";

export async function POST(request: NextRequest): Promise<NextResponse<IGeneralResponse>> {
  const { question, dbConfig } = (await request.json());
  const { host, port, database, username, password } = dbConfig;

  const generator = new SQLGenerator();

  try {
    // 连接到 MySQL 数据库
    const connection = await mysql.createConnection({
      host,
      port,
      user: username,
      password,
      database,
    });

    // 生成数据库架构提示
    const schemaPrompt = await generator.generateMySQLSchemaPrompt(connection, database);

    // 生成完整的提示
    const prompt = `${schemaPrompt}\n${generator.generateCommentPrompt(question)}`;

    // 调用 LLM 生成 SQL
    const llmResponse = await generator.collectMySqlResponseFromGPT(prompt, connection);

    // 关闭数据库连接
    await connection.end();

    if (llmResponse && !(typeof llmResponse === 'string')) {
      return NextResponse.json({
        isOk: true,
        data: {
          sql: llmResponse.sql,
          responseJson: llmResponse,
        },
        msg: "success",
      });
    } else {
      return NextResponse.json({
        isOk: false,
        data: null,
        msg: "failedm, error message: " + llmResponse,
      });
    }
  } catch (error) {
    return NextResponse.json({
      isOk: false,
      data: null,
      msg: error instanceof Error ? error.message : String(error),
    });
  }
}
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { IGeneralResponse } from "@request/api";
import { SQLGenerator } from "../../../utils/SQLGenerator";
import mysql from "mysql2/promise";

export async function POST(request: NextRequest): Promise<NextResponse<IGeneralResponse>> {
  const { sql, dbConfig } = await request.json();
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

    // 执行 SQL 查询
    const executeResult = await generator.executeMySQLQuery(connection, sql);

    // 关闭数据库连接
    await connection.end();

    return NextResponse.json({
      isOk: true,
      data: executeResult,
      msg: "查询成功",
    });
  } catch (error) {
    return NextResponse.json({
      isOk: false,
      data: null,
      msg: error instanceof Error ? error.message : String(error),
    });
  }
}
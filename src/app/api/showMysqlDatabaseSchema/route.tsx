import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { IGeneralResponse } from "@request/api";
import { SQLGenerator } from "../../../utils/SQLGenerator";
import mysql from "mysql2/promise";
import { DatabaseResponse, TableSchemaDescription } from "@request/sql";

export async function POST(request: NextRequest): Promise<NextResponse<IGeneralResponse<DatabaseResponse<TableSchemaDescription>[] | string>>> {
  const { host, port, database, username, password } = await request.json();

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

    // 获取数据库结构
    const databaseStructure = await generator.showMysqlDatabaseSchema(connection, database);

    // 关闭数据库连接
    await connection.end();

    return NextResponse.json({
      isOk: true,
      data: [databaseStructure],
      msg: "success",
    });
  } catch (error) {
    return NextResponse.json({
      isOk: false,
      data: "",
      msg: error instanceof Error ? error.message : String(error),
    });
  }
}
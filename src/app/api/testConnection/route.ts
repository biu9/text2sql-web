import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import mysql from "mysql2/promise";
import { IGeneralResponse } from "@request/api";

export async function POST(request: NextRequest): Promise<NextResponse<IGeneralResponse>> {
  const { host, port, database, username, password } = await request.json();

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user: username,
      password,
      database,
    });

    await connection.end();

    return NextResponse.json({
      isOk: true,
      msg: "连接成功",
      data: null,
    });
  } catch (error) {
    return NextResponse.json({
      isOk: false,
      msg: (error as Error).message,
      data: null,
    });
  }
}
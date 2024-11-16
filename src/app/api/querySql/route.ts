import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { IGeneralResponse } from "@request/api";
import path from "path";
import fs from 'fs/promises';
import { EvalData } from "@request/sql";
import { getSqlRes } from "@/utils/executeSQL";

const eval_path = path.join(process.cwd(),'public' ,'data/dev_mini.json');
const db_root_path = path.join(process.cwd(), 'public', 'data/dev_databases');

export async function POST(request: NextRequest): Promise<NextResponse<IGeneralResponse>> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sql } = await request.json();

  const evalDataRaw = await fs.readFile(eval_path, 'utf-8');
  const evalData = JSON.parse(evalDataRaw) as EvalData[];

  // const questionList = evalData.map(d => d.question);
  const dbPathList = evalData.map(d =>
    path.join(db_root_path, d.db_id, `${d.db_id}.sqlite`));

  const dbPath = dbPathList[0];

  const executeResult = await getSqlRes(sql, dbPath);

  try {
    return NextResponse.json({
      isOk: true,
      data: {
        sql,
        executeResult,
      },
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
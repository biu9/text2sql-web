import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { IGeneralResponse } from "@request/api";
import { SQLGenerator } from "../../../utils/SQLGenerator";
import path from "path";
import fs from 'fs/promises';
import { EvalData } from "@request/sql";

const eval_path = path.join(process.cwd(),'public' ,'data/dev_mini.json');
const db_root_path = path.join(process.cwd(), 'public', 'data/dev_databases');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest): Promise<NextResponse<IGeneralResponse>> {

  const generator = new SQLGenerator();

  const evalDataRaw = await fs.readFile(eval_path, 'utf-8');
  const evalData = JSON.parse(evalDataRaw) as EvalData[];

  const dbPathList = [...new Set(evalData.map(d =>
    path.join(db_root_path, d.db_id, `${d.db_id}.sqlite`)))];
  const dbIdList = [...new Set(evalData.map(d => d.db_id))];

  const allData = [];

  for(let i = 0; i < dbPathList.length; i++) {
    const data = await generator.showAllData(dbPathList[i], dbIdList[i]);
    allData.push(data);
  }

  try {
    return NextResponse.json({
      isOk: true,
      data: allData,
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
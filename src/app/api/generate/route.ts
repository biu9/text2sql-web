import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { IGeneralResponse, IGenerateRequest } from "@request/api";
import { SQLGenerator } from "../../../utils/SQLGenerator";
import path from "path";
import fs from 'fs/promises';
import { EvalData } from "@request/sql";
import { getSqlRes } from "@/utils/executeSQL";

const eval_path = path.join(process.cwd(),'public' ,'data/dev_mini.json');
const db_root_path = path.join(process.cwd(), 'public', 'data/dev_databases');
const use_knowledge = true;

export async function POST(request: NextRequest): Promise<NextResponse<IGeneralResponse>> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { question } = await request.json() as IGenerateRequest;

  const generator = new SQLGenerator();

  const evalDataRaw = await fs.readFile(eval_path, 'utf-8');
  const evalData = JSON.parse(evalDataRaw) as EvalData[];

  // const questionList = evalData.map(d => d.question);
  const dbPathList = evalData.map(d =>
    path.join(db_root_path, d.db_id, `${d.db_id}.sqlite`));
  const knowledgeList = evalData.map(d => d.evidence).filter((evidence): evidence is string => evidence !== undefined);

  const responses = await generator.collectResponseFromGPT(
    [dbPathList[0]],
    [question],
    use_knowledge ? (knowledgeList.length > 0 ? knowledgeList : null) : null
  );

  const sql = responses[0].sql;
  const dbPath = dbPathList[0];

  const executeResult = await getSqlRes(sql, dbPath);

  try {
    return NextResponse.json({
      isOk: true,
      data: {
        sql,
        executeResult,
        responseJson: responses[0]
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
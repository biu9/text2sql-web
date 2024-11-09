import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { IGeneralResponse, IGenerateRequest } from "@request/api";
import { SQLGenerator } from "./SQLGenerator";
import path from "path";
import { EvalData } from "./types";
import fs from 'fs/promises';

const eval_path = './data/dev_mini.json';
const db_root_path = './data/dev_databases/';
const use_knowledge = false;

export async function POST(request: NextRequest): Promise<NextResponse<IGeneralResponse>> {
  const { question } = await request.json() as IGenerateRequest;

  const generator = new SQLGenerator({
    engine: 'code-davinci-002'
  });

  const evalDataRaw = await fs.readFile(eval_path, 'utf-8');
  const evalData = JSON.parse(evalDataRaw) as EvalData[];

  const questionList = evalData.map(d => d.question);
  const dbPathList = evalData.map(d =>
    path.join(db_root_path, d.db_id, `${d.db_id}.sqlite`));
  const knowledgeList = evalData.map(d => d.evidence).filter((evidence): evidence is string => evidence !== undefined);

  const responses = await generator.collectResponseFromGPT(
    dbPathList,
    questionList,
    use_knowledge ? (knowledgeList.length > 0 ? knowledgeList : null) : null
  );

  try {
    // const result = await model.generateContent(question);
    // const response = result.response;
    // const resultText = response.text();

    return NextResponse.json({
      isOk: true,
      data: JSON.stringify(responses),
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
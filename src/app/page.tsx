'use client';
import { Button, TextField } from "@mui/material";
import { POST } from "@/request";
import { useEffect, useState } from "react";
import { IGenerateRequest, IGeneralResponse } from "@request/api";
import { GET } from "@/request";
import { DatabaseResponse } from "@request/sql";

export default function Home() {

  const [question, setQuestion] = useState<string>('');

  useEffect(() => {
    (async () => {
      const response = await GET<IGeneralResponse<DatabaseResponse[]>>('/api/showTable');
      console.log(response);
    })()
  }, [])

  const handleGenerate = async () => {
    const response = await POST<IGenerateRequest, IGeneralResponse>('/api/generate', { question });
    console.log(response);
  }

  return (
    <div className="flex items-center justify-center min-h-screen flex-col">
      <div className="font-lg text-3xl mb-20">text2sql playground</div>
      <div className="flex">
        <TextField
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          label="输入问题" variant="standard" />
        <Button
          onClick={handleGenerate}
          variant="contained">确认</Button>
      </div>
    </div>
  );
}
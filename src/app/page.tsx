'use client';
import { Button, TextField, Typography } from "@mui/material";
import { POST } from "@/request";
import { useEffect, useState } from "react";
import { IGenerateRequest, IGeneralResponse } from "@request/api";
import { GET } from "@/request";
import { DatabaseResponse } from "@request/sql";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

export default function Home() {

  const [question, setQuestion] = useState<string>('');
  const [data, setData] = useState<DatabaseResponse[]>([]);

  useEffect(() => {
    (async () => {
      const response = await GET<IGeneralResponse<DatabaseResponse[]>>('/api/showTable');
      setData(response.data);
    })()
  }, [])

  const handleGenerate = async () => {
    const response = await POST<IGenerateRequest, IGeneralResponse>('/api/generate', { question });
    console.log(response);
  }

  return (
    <div className="flex items-center justify-center min-h-screen flex-col py-20">
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
      {/* 数据展示部分 */}
      <div>
        {data.map((dbItem, dbIndex) => (
          <div key={dbIndex} style={{ marginBottom: 40 }}>
            <Typography variant="h5" gutterBottom>
              数据库：{dbItem.database}
            </Typography>
            {dbItem.table.map((tableItem, tableIndex) => (
              <div key={tableIndex} style={{ marginBottom: 20 }}>
                <Typography variant="h6" gutterBottom>
                  表：{tableItem.name}
                </Typography>
                <TableContainer component={Paper} style={{ maxHeight: 400, maxWidth: 1200 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        {tableItem.columns.map((col, colIndex) => (
                          <TableCell key={colIndex}>{col}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tableItem.rows.slice(0, 10).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.slice(0, 100).map((cell, cellIndex) => (
                            <TableCell key={cellIndex}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
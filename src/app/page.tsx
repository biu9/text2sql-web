'use client';
import { Button, Collapse, TextField, Typography } from "@mui/material";
import { POST } from "@/request";
import { useEffect, useState } from "react";
import { IGenerateRequest, IGeneralResponse } from "@request/api";
import { GET } from "@/request";
import { DatabaseResponse, LLMResponse } from "@request/sql";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { PieChart, Pie, Cell, Legend } from "recharts";

export default function Home() {

  const [question, setQuestion] = useState<string>('');
  const [data, setData] = useState<DatabaseResponse[]>([]);
  const [sql, setSql] = useState<string>('');
  const [executeResult, setExecuteResult] = useState<unknown[]>([]);
  const [visualization, setVisualization] = useState<LLMResponse['visualization'] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const response = await GET<IGeneralResponse<DatabaseResponse[]>>('/api/showTable');
      setData(response.data);
    })()
  }, [])

  const handleGenerate = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST<IGenerateRequest, IGeneralResponse<any>>('/api/generate', { question });
    setSql(response.data.sql);
    setExecuteResult(response.data.executeResult);
    setVisualization(response.data.responseJson.visualization);
    console.log(response);
  }

  return (
    <div className="flex items-center justify-center min-h-screen flex-col py-20">
      <div className="font-lg text-3xl mb-20">text2sql playground</div>
      <div className="flex">
        <TextField
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          fullWidth
          style={{ width: 1000 }}
          label="输入问题" variant="standard" />
        <Button
          onClick={handleGenerate}
          variant="contained">确认</Button>
      </div>
      <Paper className="w-[1200px] p-5 my-10">
        <Button onClick={() => setOpen(!open)}>{open ? '收起' : '展开'}</Button>
        <Collapse in={open}>
          <div className="flex">
            <div className="font-bold text-2xl">sql from llm: </div>
            <div>{sql}</div>
          </div>
          <div className="flex">
            <div className="font-bold text-2xl">execute result: </div>
            <div>{JSON.stringify(executeResult)}</div>
          </div>
        </Collapse>
      </Paper>
      {/** 数据可视化部分 */}
      <div className="py-10">
        <div className="font-bold text-2xl">visualization: </div>
        {
          visualization && visualization.type === 'table' && (
            <TableDisplay columns={visualization.columns} data={executeResult as Record<string, string | number>[]} />
          )
        }
        {
          visualization && visualization.type === 'text' && (
            <TextDisplay text={executeResult[0] as string} />
          )
        }
        {
          visualization && visualization.type === 'chart' && visualization?.chart?.chartType === 'pie' && (
            <PieDisplay data={visualization.chart.data} />
          )
        }
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

const TableDisplay = ({
  columns,
  data
}: {
  columns: LLMResponse['visualization']['columns'],
  data: Record<string, string | number>[]
}) => {
  return (
    <TableContainer component={Paper} style={{ maxHeight: 400, maxWidth: 1200 }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((col, colIndex) => (
              <TableCell key={colIndex}>{col.name}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((col, colIndex) => (
                <TableCell key={colIndex}>{row[col.dataIndex]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

const TextDisplay = ({ text }: { text: string }) => {
  return (
    <div>
      {text}
    </div>
  )
}

const PieDisplay = ({ data }: { data: ChartDataPoint[] }) => {
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <PieChart width={400} height={400}>
      <Pie
        data={data}
        dataKey="value"
        nameKey="label"
        cx="50%"
        cy="50%"
        outerRadius={150}
        label
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Legend />
    </PieChart>
  );
};
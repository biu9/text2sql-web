"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

import { GET, POST } from "@/request";
import {
  DatabaseResponse,
  LLMResponse,
  TableSchemaDescription,
} from "@request/sql";
import { IGeneralResponse } from "@request/api";
import { PieChart, Pie, Cell, Legend } from "recharts";

const theme = createTheme();

export default function SQLGeneratorMUI() {
  const [input, setInput] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [queryResult, setQueryResult] = useState<unknown[] | null>(null);
  const [generateResult, setGenerateResult] = useState<LLMResponse | null>(
    null
  );

  const [isLoading, setIsLoading] = useState(false);
  const [dbHost, setDbHost] = useState("");
  const [dbPort, setDbPort] = useState("");
  const [dbName, setDbName] = useState("");
  const [dbUsername, setDbUsername] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isDbConnectionExpanded, setIsDbConnectionExpanded] = useState(false);
  const [databaseStructure, setDatabaseStructure] = useState<
    TableSchemaDescription[] | null
  >(null);

  useEffect(() => {
    (async () => {
      const res = await GET<
        IGeneralResponse<DatabaseResponse<TableSchemaDescription>[] | string>
      >("/api/showDatabaseStructure");
      if (typeof res === "object") {
        if (res.isOk) {
          setDatabaseStructure(
            (
              res as IGeneralResponse<
                DatabaseResponse<TableSchemaDescription>[]
              >
            ).data[0].table
          );
        }
      }
    })();
  }, []);

  const handleGenerate = async () => {
    // 模拟API调用延迟
    setIsLoading(true);
    const res = await POST<
      { question: string },
      IGeneralResponse<{
        sql: string;
        responseJson: LLMResponse;
      }>
    >("/api/generateSql", { question: input });
    if (typeof res === "object") {
      if (res.isOk) {
        setGeneratedSQL(res.data.sql);
        setGenerateResult(res.data.responseJson);
        setIsLoading(false);
      }
    }
  };

  const handleExecute = async () => {
    setIsLoading(true);
    // 模拟API调用延迟
    const res = await POST<
      { sql: string },
      IGeneralResponse<{ sql: string; executeResult: unknown[] }>
    >("/api/querySql", { sql: generatedSQL });
    if (typeof res === "object") {
      if (res.isOk) {
        setQueryResult(res.data.executeResult);
        setIsLoading(false);
      }
    }
  };

  const handleTestConnection = async () => {
    if (dbHost && dbPort && dbName && dbUsername && dbPassword) {
      // setIsConnected(true);
      const res = await POST<unknown, IGeneralResponse>('/api/testConnection', {
        host: dbHost,
        port: dbPort,
        database: dbName,
        username: dbUsername,
        password: dbPassword,
      });
      console.log(res);
      if (res.isOk) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
        alert('连接失败' + res.msg);
      }
    } else {
      setIsConnected(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom align="center">
            SQL Generator
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Accordion
              expanded={isDbConnectionExpanded}
              onChange={() =>
                setIsDbConnectionExpanded(!isDbConnectionExpanded)
              }
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="database-connection-content"
                id="database-connection-header"
              >
                <Typography variant="h5">数据库连接配置-{isConnected ? '连接成功' : '未连接'}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Host"
                      value={dbHost}
                      onChange={(e) => setDbHost(e.target.value)}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Port"
                      value={dbPort}
                      onChange={(e) => setDbPort(e.target.value)}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Database Name"
                      value={dbName}
                      onChange={(e) => setDbName(e.target.value)}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Username"
                      value={dbUsername}
                      onChange={(e) => setDbUsername(e.target.value)}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={dbPassword}
                      onChange={(e) => setDbPassword(e.target.value)}
                      margin="normal"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? (
                                <VisibilityOffIcon />
                              ) : (
                                <VisibilityIcon />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleTestConnection}
                      disabled={
                        !(
                          dbHost &&
                          dbPort &&
                          dbName &&
                          dbUsername &&
                          dbPassword
                        )
                      }
                    >
                      测试连接
                    </Button>
                    {isConnected && (
                      <Typography
                        color="success"
                        sx={{ ml: 2, display: "inline" }}
                      >
                        Connected successfully!
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Box>
          <Divider sx={{ my: 4 }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              数据库结构
            </Typography>
            {databaseStructure &&
              databaseStructure.map((table) => (
                <Accordion key={table.tableName}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls={`${table.tableName}-content`}
                    id={`${table.tableName}-header`}
                  >
                    <Typography>{table.tableName}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>列名</TableCell>
                            <TableCell>类型</TableCell>
                            <TableCell>约束</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {table.columns.map((column) => (
                            <TableRow key={column.name}>
                              <TableCell>{column.name}</TableCell>
                              <TableCell>{column.type}</TableCell>
                              <TableCell>{column.constraints}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              ))}
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入问题"
              variant="outlined"
              margin="normal"
            />
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleGenerate}
                  disabled={isLoading || !input}
                  color="primary"
                  size="large"
                >
                  {isLoading ? "Generating..." : "Generate SQL"}
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleExecute}
                  disabled={isLoading || !generatedSQL}
                  color="secondary"
                  size="large"
                >
                  {isLoading ? "Executing..." : "Execute Query"}
                </Button>
              </Grid>
            </Grid>
          </Box>

          {generatedSQL && (
            <Box sx={{ mb: 2, mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Generated SQL:
              </Typography>
              <Paper elevation={3} sx={{ p: 2, bgcolor: "grey.100", mb: 2 }}>
                <Typography variant="body2" component="code">
                  {generatedSQL}
                </Typography>
              </Paper>
            </Box>
          )}

          {queryResult && generateResult && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Query Results:
              </Typography>
              {generateResult.visualization &&
                generateResult.visualization.type === "table" && (
                  <TableDisplay
                    columns={generateResult.visualization.columns}
                    data={queryResult as Record<string, string | number>[]}
                  />
                )}
              {generateResult.visualization &&
                generateResult.visualization.type === "text" && (
                  <TextDisplay
                    text={JSON.stringify(queryResult[0]) as string}
                  />
                )}
              {generateResult.visualization &&
                generateResult.visualization.type === "chart" &&
                generateResult.visualization?.chart?.chartType === "pie" && (
                  <PieDisplay data={generateResult.visualization.chart.data} />
                )}
            </Box>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

const TableDisplay = ({
  columns,
  data,
}: {
  columns: LLMResponse["visualization"]["columns"];
  data: Record<string, string | number>[];
}) => {
  return (
    <TableContainer
      component={Paper}
      style={{ maxHeight: 400, maxWidth: 1200 }}
    >
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
  );
};

const TextDisplay = ({ text }: { text: string }) => {
  return <div>{text}</div>;
};

const PieDisplay = ({ data }: { data: ChartDataPoint[] }) => {
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

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

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

import { GET } from "@/request";
import { DatabaseResponse, TableSchemaDescription } from "@request/sql";
import { IGeneralResponse } from "@request/api";

const theme = createTheme();

export default function SQLGeneratorMUI() {
  const [input, setInput] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
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

  const handleGenerate = () => {
    if (!isConnected) {
      alert("Please connect to a database first.");
      return;
    }
    setIsLoading(true);
    // 模拟API调用延迟
    setTimeout(() => {
      setGeneratedSQL(`SELECT * FROM users WHERE name LIKE '%${input}%'`);
      setIsLoading(false);
    }, 1000);
  };

  const handleExecute = () => {
    if (!isConnected) {
      alert("Please connect to a database first.");
      return;
    }
    setIsLoading(true);
    // 模拟API调用延迟
    setTimeout(() => {
      setQueryResult([
        { id: 1, name: "John Doe", email: "john@example.com" },
        { id: 2, name: "Jane Smith", email: "jane@example.com" },
        { id: 3, name: "Bob Johnson", email: "bob@example.com" },
      ]);
      setIsLoading(false);
    }, 1500);
  };

  const handleTestConnection = () => {
    // 这里应该是实际测试数据库连接的逻辑
    // 为了演示，我们只是简单地检查所有字段是否都已填写
    if (dbHost && dbPort && dbName && dbUsername && dbPassword) {
      setIsConnected(true);
      // 在这里你应该调用后端 API 来实际测试连接
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
                <Typography variant="h5">数据库连接配置(开发中)</Typography>
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
                  disabled={isLoading || !input || !isConnected}
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
                  disabled={isLoading || !generatedSQL || !isConnected}
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

          {queryResult && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Query Results:
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      {Object.keys(queryResult[0]).map((key) => (
                        <TableCell key={key}>{key}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {queryResult.map((row: unknown, index: number) => (
                      <TableRow key={index}>
                        {Object.values(row).map(
                          (value: unknown, cellIndex: number) => (
                            <TableCell key={cellIndex}>{value}</TableCell>
                          )
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

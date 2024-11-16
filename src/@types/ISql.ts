declare module "@request/sql" {
  export interface Config {
    engine: string;
  }

  export interface EvalData {
    question: string;
    db_id: string;
    evidence?: string;
  }

  export interface CommandLineArgs {
    eval_path: string;
    mode: string;
    use_knowledge: string;
    db_root_path: string;
    engine: string;
    data_output_path: string;
    chain_of_thought: string;
  }

  export interface SchemaDict {
    [key: string]: string;
  }

  export interface SqlResponse {
    [key: number]: string;
  }

  export interface DatabaseResponse<T = TableDescription> {
    database: string;
    table: Array<T>
  }

  export interface TableDescription {
    name: string;
    columns: string[];
    rows: (string | number)[][];
  }

  export interface TableSchemaDescription {
    tableName: string;
    columns: {
      name: string;
      type: string;
      constraints: string;
    }[];
  }

  export type LLMResponse = {
    sql: string,
    visualization: {
      type: string,
      columns: {
        dataIndex: string,
        name: string
      }[],
      chart: Chart
    }
  }
}

interface ChartDataPoint {
  label: string;
  value: number;
}

interface Chart {
  chartType: 'pie' | 'line';
  data: ChartDataPoint[];
  xAxis?: string;
  yAxis?: string;
}
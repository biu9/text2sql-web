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
}
declare module "@request/api" {
  export interface ISummaryResponse {
    msg: string,
    code: number
  }
  export interface IGeneralResponse<T = unknown> {
    isOk: boolean,
    data: T,
    msg: string,
  }
  export interface IGenerateRequest {
    question: string
  }
  export interface IGenerateRequest {
    question: string;
    dbConfig: {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
    };
  }
}
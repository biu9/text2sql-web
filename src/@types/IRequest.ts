declare module "@request/api" {
  export interface ISummaryResponse {
    msg: string,
    code: number
  }
  export interface IGeneralResponse {
    isOk: boolean,
    data: unknown,
    msg: string,
  }
  export interface IGenerateRequest {
    question: string
  }
}
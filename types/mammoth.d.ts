declare module 'mammoth' {
  interface MammothResult {
    value: string
    messages: Array<{ type: string; message: string }>
  }

  interface MammothInput {
    path?: string
    buffer?: Buffer | ArrayBuffer
  }

  function extractRawText(input: MammothInput): Promise<MammothResult>
  function convertToHtml(input: MammothInput): Promise<MammothResult>
}

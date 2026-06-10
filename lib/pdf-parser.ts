export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const mod = await import('pdf-parse')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (mod as any).default ?? mod
  const data = await pdfParse(buffer)
  return data.text as string
}

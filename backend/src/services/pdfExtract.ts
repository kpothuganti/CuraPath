import pdfParse from 'pdf-parse';

export async function extractTextFromPDF(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  const data = await pdfParse(buffer);

  if (!data.text?.trim()) {
    throw new Error('No readable text found in PDF. The file may be scanned or image-only.');
  }

  return data.text;
}

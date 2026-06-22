import { NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_EXTRACTED_CHARACTERS = 40_000
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml'])

function extensionOf(filename: string) {
  return filename.toLowerCase().split('.').pop() ?? ''
}

function normalizeText(value: string) {
  return value.replace(/\0/g, '').replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim()
}

async function extractPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    return (await parser.getText()).text
  } finally {
    await parser.destroy()
  }
}

async function extractText(file: File, buffer: Buffer) {
  const extension = extensionOf(file.name)
  if (extension === 'pdf') return extractPdf(buffer)
  if (extension === 'docx') return (await mammoth.extractRawText({ buffer })).value
  if (TEXT_EXTENSIONS.has(extension)) return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  throw new Error('Unsupported file type. Use PDF, DOCX, TXT, Markdown, CSV, JSON, HTML, or XML.')
}

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid document upload.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a document to upload.' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'The selected document is empty.' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Documents must be 8 MB or smaller.' }, { status: 413 })

  try {
    const extracted = normalizeText(await extractText(file, Buffer.from(await file.arrayBuffer())))
    if (!extracted) {
      return NextResponse.json(
        { error: 'No readable text was found. Scanned PDFs need OCR before AirGPT can read them.' },
        { status: 422 },
      )
    }
    const truncated = extracted.length > MAX_EXTRACTED_CHARACTERS
    const text = truncated ? extracted.slice(0, MAX_EXTRACTED_CHARACTERS) : extracted
    return NextResponse.json({ name: file.name, text, characters: text.length, truncated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The document could not be read.'
    return NextResponse.json({ error: message }, { status: message.startsWith('Unsupported') ? 415 : 422 })
  }
}

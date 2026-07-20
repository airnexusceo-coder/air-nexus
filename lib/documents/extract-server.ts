import 'server-only'

import JSZip from 'jszip'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { getData as getPdfWorkerData } from 'pdf-parse/worker'

/**
 * Shared binary-document text extraction — used by the direct document
 * upload route (app/api/documents/extract) and the Google Drive import route,
 * so both paths support exactly the same file types with one implementation.
 */

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml'])

export function extensionOf(filename: string) {
  return filename.toLowerCase().split('.').pop() ?? ''
}

export function normalizeExtractedText(value: string) {
  return value.replace(/\0/g, '').replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim()
}

function decodeXmlText(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function extractPowerPointXmlText(xml: string) {
  const paragraphs = [...xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)]
  const sources = paragraphs.length > 0 ? paragraphs.map((match) => match[1]) : [xml]
  return sources.flatMap((source) => {
    const runs = [...source.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXmlText(match[1]).replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    return runs.length > 0 ? [runs.join(' ')] : []
  }).join('\n')
}

function numberedOfficeFiles(zip: JSZip, pattern: RegExp) {
  return Object.keys(zip.files).flatMap((path) => {
    const match = path.match(pattern)
    return match ? [{ path, number: Number(match[1]) }] : []
  }).sort((a, b) => a.number - b.number)
}

async function extractPowerPoint(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const slides = numberedOfficeFiles(zip, /^ppt\/slides\/slide(\d+)\.xml$/)
  if (slides.length === 0) throw new Error('No readable slides were found in this PowerPoint file.')

  const notes = new Map<number, string>()
  await Promise.all(numberedOfficeFiles(zip, /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/).map(async (item) => {
    const entry = zip.file(item.path)
    if (!entry) return
    const noteText = extractPowerPointXmlText(await entry.async('string'))
    if (noteText) notes.set(item.number, noteText)
  }))

  const sections = await Promise.all(slides.map(async (slide) => {
    const entry = zip.file(slide.path)
    if (!entry) return ''
    const slideText = extractPowerPointXmlText(await entry.async('string'))
    const noteText = notes.get(slide.number)
    const content = slideText || '[No readable text on this slide]'
    return `## Slide ${slide.number}\n${content}${noteText ? `\n\nSpeaker notes:\n${noteText}` : ''}`
  }))
  return sections.filter(Boolean).join('\n\n')
}

async function extractPdf(buffer: Buffer) {
  PDFParse.setWorker(getPdfWorkerData())
  const parser = new PDFParse({ data: buffer })
  try {
    return (await parser.getText()).text
  } finally {
    await parser.destroy()
  }
}

/** Throws with a user-facing message on unsupported/unreadable input. */
export async function extractTextFromBuffer(fileName: string, buffer: Buffer): Promise<string> {
  const extension = extensionOf(fileName)
  if (extension === 'pdf') return extractPdf(buffer)
  if (extension === 'docx') return (await mammoth.extractRawText({ buffer })).value
  if (extension === 'pptx') return extractPowerPoint(buffer)
  if (extension === 'ppt') throw new Error('Legacy PPT files are not supported. Open the presentation and save it as PPTX, then upload it again.')
  if (TEXT_EXTENSIONS.has(extension)) return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  throw new Error('Unsupported file type. Use PDF, DOCX, PPTX, TXT, Markdown, CSV, JSON, HTML, or XML.')
}

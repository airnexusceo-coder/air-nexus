import { sanitizeResponse } from '@/lib/ai/sanitize-response'

/**
 * Converts AI-generated Markdown into HTML safe to drop into a contentEditable
 * document body. Every AI-to-document insertion point (Write with AI, Apply
 * suggestion, Record Lesson notes, AI Chat "Save to document") used to just
 * split the reply on newlines and wrap each line in <p>, which left literal
 * "##", "**", and "- " characters sitting in the document instead of real
 * headings, bold text, and lists.
 */

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatInline(text: string) {
  let html = escapeHtml(text)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  html = html.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?;:]|$)/g, '$1<em>$2</em>')
  html = html.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?;:]|$)/g, '$1<em>$2</em>')
  return html
}

export function formatAiTextForDocument(rawText: string): string {
  const lines = sanitizeResponse(rawText).split('\n')
  const htmlParts: string[] = []
  let listBuffer: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = () => {
    if (listBuffer.length === 0) return
    const tag = listType === 'ol' ? 'ol' : 'ul'
    htmlParts.push(`<${tag}>${listBuffer.map((item) => `<li>${formatInline(item)}</li>`).join('')}</${tag}>`)
    listBuffer = []
    listType = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      continue
    }

    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      const tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4'
      htmlParts.push(`<${tag}>${formatInline(headingMatch[2])}</${tag}>`)
      continue
    }

    const bulletMatch = /^[-*]\s+(.*)$/.exec(line)
    if (bulletMatch) {
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listBuffer.push(bulletMatch[1])
      continue
    }

    const numberedMatch = /^\d+[.)]\s+(.*)$/.exec(line)
    if (numberedMatch) {
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listBuffer.push(numberedMatch[1])
      continue
    }

    flushList()
    htmlParts.push(`<p>${formatInline(line)}</p>`)
  }
  flushList()
  return htmlParts.join('')
}

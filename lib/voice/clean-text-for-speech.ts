import { sanitizeResponse } from '../ai/sanitize-response'

export function cleanTextForSpeech(value: unknown): string {
  return sanitizeResponse(value)
    .replace(/```(?:[\w-]+)?\s*([\s\S]*?)```/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/(`{1,2})(.*?)\1/g, '$2')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|\s)([*_])([^\n]+?)\2(?=\s|[.,!?;:]|$)/g, '$1$3')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

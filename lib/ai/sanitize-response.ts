const REASONING_TAGS =
  'think|thinking|reasoning|analysis|internal|internal-thoughts?|assistant-thoughts?|thoughts?|scratchpad'

const COMPLETE_REASONING_BLOCK = new RegExp(
  `<\\s*(${REASONING_TAGS})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`,
  'gi',
)

const DANGLING_REASONING_BLOCK = new RegExp(
  `<\\s*(?:${REASONING_TAGS})\\b[^>]*>[\\s\\S]*$`,
  'gi',
)

const ORPHAN_REASONING_TAG = new RegExp(
  `<\\s*\\/?\\s*(?:${REASONING_TAGS})\\b[^>]*>`,
  'gi',
)

/**
 * Removes private model reasoning before an assistant response is stored or rendered.
 * For streamed responses, call this with the accumulated response buffer so an open
 * reasoning tag remains hidden until its matching closing tag arrives.
 */
export function sanitizeResponse(value: unknown): string {
  if (typeof value !== 'string') return ''

  let sanitized = value
  let previous = ''

  // Repeat to safely remove adjacent or nested reasoning blocks.
  while (sanitized !== previous) {
    previous = sanitized
    sanitized = sanitized.replace(COMPLETE_REASONING_BLOCK, '')
  }

  sanitized = sanitized
    .replace(DANGLING_REASONING_BLOCK, '')
    .replace(ORPHAN_REASONING_TAG, '')

  const finalMarker = /(?:^|\n)\s*(?:final answer|final response)\s*:\s*/i.exec(sanitized)
  if (finalMarker?.index !== undefined) {
    sanitized = sanitized.slice(finalMarker.index + finalMarker[0].length)
  } else if (/^\s*(?:reasoning|thinking|analysis|internal thoughts?)\s*:/i.test(sanitized)) {
    const answerMarker = /(?:^|\n)\s*(?:answer|response)\s*:\s*/i.exec(sanitized)
    if (answerMarker?.index !== undefined) {
      sanitized = sanitized.slice(answerMarker.index + answerMarker[0].length)
    }
  }

  return sanitized.trim().replace(/\n{3,}/g, '\n\n')
}

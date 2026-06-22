import { apiUrl } from '@/lib/api-client'

export const DOCUMENT_ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm,.xml'
export const MAX_DOCUMENTS_PER_MESSAGE = 5

export type DocumentAttachment = {
  id: string
  name: string
  size: string
  text: string
  status: 'processing' | 'ready' | 'error'
  error?: string
  truncated?: boolean
}

export function formatDocumentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function pendingDocument(file: File, id: string): DocumentAttachment {
  return { id, name: file.name, size: formatDocumentSize(file.size), text: '', status: 'processing' }
}

export async function readDocument(file: File, id: string): Promise<DocumentAttachment> {
  const formData = new FormData()
  formData.set('file', file)
  const response = await fetch(apiUrl('/api/documents/extract'), { method: 'POST', body: formData })
  const result = await response.json() as { text?: string; error?: string; truncated?: boolean }
  if (!response.ok || !result.text) throw new Error(result.error ?? `AirGPT could not read ${file.name}.`)
  return {
    id,
    name: file.name,
    size: formatDocumentSize(file.size),
    text: result.text,
    status: 'ready',
    truncated: result.truncated === true,
  }
}

const API_PATH_PREFIX = '/api/'

/**
 * Returns a same-origin API URL in the browser. This deliberately does not read
 * API_URL: server-only environment variables must never be bundled into client code.
 */
export function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : '/' + path
  if (!normalizedPath.startsWith(API_PATH_PREFIX)) {
    throw new Error('AirGPT API requests must target /api/.')
  }
  if (typeof window === 'undefined') return normalizedPath
  return new URL(normalizedPath, window.location.origin).toString()
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

function retryDelay(response: Response | null, attempt: number) {
  const retryAfter = response?.headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(5_000, Math.max(250, seconds * 1_000))
    const dateDelay = Date.parse(retryAfter) - Date.now()
    if (Number.isFinite(dateDelay) && dateDelay > 0) return Math.min(5_000, dateDelay)
  }
  return 450 * (attempt + 1)
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { attempts?: number } = {},
) {
  const attempts = Math.max(1, Math.min(3, options.attempts ?? 2))
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('You appear to be offline. Reconnect and try again.')
    if (init.signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError')

    let response: Response | null = null
    try {
      response = await fetch(input, init)
      if (!RETRYABLE_STATUSES.has(response.status) || attempt + 1 >= attempts) return response
      await response.body?.cancel()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      lastError = error
      if (attempt + 1 >= attempts) throw error
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)))
  }

  throw lastError instanceof Error ? lastError : new Error('The request failed after retrying.')
}

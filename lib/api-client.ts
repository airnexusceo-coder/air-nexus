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

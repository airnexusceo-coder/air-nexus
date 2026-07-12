export async function readApexError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === 'string' ? data.error : fallback
  } catch {
    return fallback
  }
}

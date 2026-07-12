import 'server-only'

import { supabaseServiceFetch } from '@/lib/supabase/server'

/** Exact row count via PostgREST's Content-Range header, without fetching any rows. */
export async function countRows(path: string): Promise<number> {
  const response = await supabaseServiceFetch(path, { headers: { Prefer: 'count=exact', Range: '0-0' } })
  const range = response.headers.get('content-range')
  const total = range?.split('/')[1]
  return total && total !== '*' ? Number(total) : 0
}

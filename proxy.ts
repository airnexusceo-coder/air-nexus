import { NextRequest, NextResponse } from 'next/server'

const LOCAL_HTTPS_ORIGINS = new Set([
  'https://localhost:3000',
  'https://127.0.0.1:3000',
])

function allowedOrigins() {
  const origins = new Set<string>()
  const configuredUrl = process.env.API_URL

  if (configuredUrl) {
    try {
      origins.add(new URL(configuredUrl).origin)
    } catch {
      // Invalid configuration is ignored instead of widening CORS access.
    }
  }

  if (process.env.NODE_ENV === 'development' && process.env.LOCAL_HTTPS === 'true') {
    LOCAL_HTTPS_ORIGINS.forEach((origin) => origins.add(origin))
  }

  return origins
}

function addCorsHeaders(response: NextResponse, origin: string) {
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.append('Vary', 'Origin')
  return response
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin')
  const originAllowed = !origin || allowedOrigins().has(origin)

  if (origin && !originAllowed) {
    return NextResponse.json({ error: 'Origin is not allowed' }, { status: 403 })
  }

  if (request.method === 'OPTIONS') {
    if (!origin || !originAllowed) {
      return NextResponse.json({ error: 'Origin is not allowed' }, { status: 403 })
    }
    return addCorsHeaders(new NextResponse(null, { status: 204 }), origin)
  }

  const response = NextResponse.next()
  return origin && originAllowed ? addCorsHeaders(response, origin) : response
}

export const config = {
  matcher: '/api/:path*',
}

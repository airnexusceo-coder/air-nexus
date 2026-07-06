'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function ProductionRuntime() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine)
    updateStatus()
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error: unknown) => {
        console.warn('AirNexus offline worker registration failed:', error instanceof Error ? error.message : 'Unknown error')
      })
    }

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  if (online) return null
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-slate-950/95 px-4 py-3 text-sm text-amber-100 shadow-2xl backdrop-blur-xl">
      <WifiOff className="size-4" />
      You’re offline. Saved workspace data remains available; AI requests will resume when you reconnect.
    </div>
  )
}

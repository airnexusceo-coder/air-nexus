import Link from 'next/link'
import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08090b] p-5 text-white">
      <section className="glass w-full max-w-lg rounded-[2rem] p-8 text-center"><WifiOff className="mx-auto size-10 text-amber-300" /><h1 className="mt-5 text-2xl font-semibold">You’re offline</h1><p className="mt-3 text-sm leading-6 text-slate-400">Previously saved workspace data is still stored on this device. Reconnect before sending AI requests or uploading new documents.</p><Link href="/" className="primary-action mt-6">Try again</Link></section>
    </main>
  )
}

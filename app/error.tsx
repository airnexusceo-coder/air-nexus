'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { CircleAlert, RefreshCw } from 'lucide-react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('AirNexus route error:', error) }, [error])
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08090b] p-5 text-white">
      <section className="glass w-full max-w-lg rounded-[2rem] p-8 text-center">
        <CircleAlert className="mx-auto size-10 text-rose-300" />
        <h1 className="mt-5 text-2xl font-semibold">This page hit an unexpected error</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Your locally saved workspace data is untouched. Retry the page, or return home if the problem continues.</p>
        {error.digest && <p className="mt-3 text-[10px] text-slate-600">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"><button type="button" onClick={reset} className="primary-action"><RefreshCw className="size-4" />Try again</button><Link href="/" className="secondary-action">Return home</Link></div>
      </section>
    </main>
  )
}

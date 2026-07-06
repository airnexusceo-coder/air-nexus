'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-[#08090b] p-5 font-sans text-white">
        <main className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-semibold">AirNexus couldn’t start</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Retry the application. Your locally saved workspace has not been deleted.</p>
          <button type="button" onClick={reset} className="mt-6 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white">Try again</button>
        </main>
      </body>
    </html>
  )
}

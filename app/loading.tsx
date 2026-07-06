export default function Loading() {
  return (
    <main className="min-h-screen bg-[#08090b] px-5 py-8 text-white" role="status" aria-label="Loading AirNexus">
      <div className="mx-auto max-w-6xl">
        <div className="premium-skeleton h-12 w-44 rounded-2xl" />
        <div className="mt-16 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <div className="premium-skeleton h-96 rounded-[2rem]" />
          <div className="grid gap-5"><div className="premium-skeleton h-44 rounded-[2rem]" /><div className="premium-skeleton h-44 rounded-[2rem]" /></div>
        </div>
      </div>
    </main>
  )
}

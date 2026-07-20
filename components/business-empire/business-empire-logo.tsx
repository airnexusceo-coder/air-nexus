import { Landmark, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type BusinessEmpireLogoProps = { compact?: boolean; className?: string }
export function BusinessEmpireLogo({ compact = false, className }: BusinessEmpireLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-200/40 bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400 text-slate-950 shadow-lg shadow-amber-950/30">
        <Landmark className="size-5" aria-hidden="true" />
        <span className="absolute bottom-1 left-1 right-1 flex items-end justify-center gap-0.5 opacity-45" aria-hidden="true"><span className="h-1.5 w-1 rounded-full bg-slate-950" /><span className="h-2.5 w-1 rounded-full bg-slate-950" /><span className="h-4 w-1 rounded-full bg-slate-950" /></span>
        <TrendingUp className="absolute right-1 top-1 size-3 text-slate-950/80" aria-hidden="true" />
      </span>
      {!compact && <span className="min-w-0"><span className="block text-sm font-bold uppercase tracking-wide text-white">Business Empire</span><span className="block text-[11px] font-medium text-amber-200/80">Real-world company simulator</span></span>}
    </div>
  )
}

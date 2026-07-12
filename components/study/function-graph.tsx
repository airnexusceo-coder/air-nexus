'use client'

import { useMemo } from 'react'
import { ChartNoAxesCombined } from 'lucide-react'
import type { GraphSpec } from '@/lib/ai/study-artifacts'
import { autoFitYBounds, buildFunctionPaths } from '@/lib/math/plot'

type FunctionGraphCardProps = {
  graph: GraphSpec
}

const DEFAULT_X_MIN = -10
const DEFAULT_X_MAX = 10

export function FunctionGraphCard({ graph }: FunctionGraphCardProps) {
  const xMin = graph.xMin ?? DEFAULT_X_MIN
  const xMax = graph.xMax ?? DEFAULT_X_MAX
  const expressions = useMemo(() => graph.functions.map((fn) => fn.expression), [graph.functions])
  const expressionsKey = expressions.join('|')

  const { yMin, yMax } = useMemo(() => {
    if (graph.yMin !== undefined && graph.yMax !== undefined) return { yMin: graph.yMin, yMax: graph.yMax }
    return autoFitYBounds(expressions, xMin, xMax)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.yMin, graph.yMax, xMin, xMax, expressionsKey])

  const paths = useMemo(
    () => buildFunctionPaths(expressions, { xMin, xMax, yMin, yMax }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expressionsKey, xMin, xMax, yMin, yMax],
  )
  const errors = paths.filter((item): item is typeof item & { error: string } => Boolean(item.error))

  const originX = xMin <= 0 && xMax >= 0 ? ((0 - xMin) / (xMax - xMin)) * 640 : -10
  const originY = yMin <= 0 && yMax >= 0 ? 320 - ((0 - yMin) / (yMax - yMin)) * 320 : -10

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white"><ChartNoAxesCombined className="size-5" /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Graph</p>
          <h3 className="text-lg font-semibold text-white">{graph.title}</h3>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {graph.functions.map((fn, index) => (
          <span key={fn.expression + index} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: paths[index]?.color }} />
            {fn.label} <span className="text-slate-500">(y = {fn.expression})</span>
          </span>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="mt-3 space-y-1">
          {errors.map((item, index) => <p key={index} className="text-xs text-rose-300">Could not plot: {item.error}</p>)}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
        <svg viewBox="0 0 640 320" className="w-full" role="img" aria-label={graph.title}>
          <defs><pattern id="airnexus-chat-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,.12)" strokeWidth="1" /></pattern></defs>
          <rect width="640" height="320" fill="url(#airnexus-chat-grid)" />
          <line x1="0" y1={originY} x2="640" y2={originY} stroke="rgba(226,232,240,.35)" />
          <line x1={originX} y1="0" x2={originX} y2="320" stroke="rgba(226,232,240,.35)" />
          {paths.map((item, index) => item.path && <path key={index} d={item.path} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
      </div>
      <p className="mt-2 text-[10px] text-slate-600">x: [{xMin}, {xMax}] · y: [{yMin.toFixed(1)}, {yMax.toFixed(1)}]</p>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { ChartNoAxesCombined } from 'lucide-react'
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import type { GraphSpec } from '@/lib/ai/study-artifacts'
import { sampleFunctionPoints } from '@/lib/math/plot'

type FunctionGraphCardProps = {
  graph: GraphSpec
}

const DEFAULT_X_MIN = -10
const DEFAULT_X_MAX = 10
const GRAPH_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185', '#facc15', '#4ade80', '#818cf8', '#22d3ee']

type PlottedFunction = { label: string; expression: string; color: string; points: { x: number; y: number }[]; error?: string }
type PlottedSeries = { label: string; color: string; style: 'line' | 'scatter'; points: { x: number; y: number }[] }

export function FunctionGraphCard({ graph }: FunctionGraphCardProps) {
  const xMin = graph.xMin ?? DEFAULT_X_MIN
  const xMax = graph.xMax ?? DEFAULT_X_MAX
  const series = graph.series ?? []
  const functionsKey = graph.functions.map((fn) => fn.expression).join('|')
  const seriesKey = series.map((entry) => `${entry.label}:${entry.points.length}`).join('|')

  const functions = useMemo<PlottedFunction[]>(() => graph.functions.map((fn, index) => {
    const color = GRAPH_COLORS[index % GRAPH_COLORS.length]
    try {
      return { label: fn.label, expression: fn.expression, color, points: sampleFunctionPoints(fn.expression, xMin, xMax) }
    } catch (error) {
      return { label: fn.label, expression: fn.expression, color, points: [], error: error instanceof Error ? error.message : 'Invalid expression' }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [functionsKey, xMin, xMax])

  const plottedSeries = useMemo<PlottedSeries[]>(() => series.map((entry, index) => ({
    label: entry.label,
    color: GRAPH_COLORS[(functions.length + index) % GRAPH_COLORS.length],
    style: entry.style,
    points: entry.points,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [seriesKey, functions.length])

  const { yMin, yMax } = useMemo(() => {
    if (graph.yMin !== undefined && graph.yMax !== undefined) return { yMin: graph.yMin, yMax: graph.yMax }
    const values = [
      ...functions.flatMap((fn) => fn.points.map((point) => point.y)),
      ...plottedSeries.flatMap((entry) => entry.points.map((point) => point.y)),
    ]
    if (values.length === 0) return { yMin: -10, yMax: 10 }
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (min === max) {
      min -= 1
      max += 1
    }
    const padding = (max - min) * 0.15
    return { yMin: min - padding, yMax: max + padding }
  }, [graph.yMin, graph.yMax, functions, plottedSeries])

  const errors = functions.filter((fn): fn is PlottedFunction & { error: string } => Boolean(fn.error))

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white"><ChartNoAxesCombined className="size-5" /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Graph</p>
          <h3 className="text-lg font-semibold text-white">{graph.title}</h3>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-3 space-y-1">
          {errors.map((item, index) => <p key={index} className="text-xs text-rose-300">Could not plot {item.label}: {item.error}</p>)}
        </div>
      )}

      <div className="mt-4 h-80 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" />
            <XAxis type="number" dataKey="x" domain={[xMin, xMax]} tick={{ fill: 'rgba(226,232,240,0.55)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(226,232,240,0.25)' }} />
            <YAxis type="number" dataKey="y" domain={[yMin, yMax]} tick={{ fill: 'rgba(226,232,240,0.55)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(226,232,240,0.25)' }} width={48} />
            <Tooltip
              contentStyle={{ background: 'rgba(15,15,20,0.92)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 12, color: 'white' }}
              formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value)}
            />
            {(functions.length > 1 || plottedSeries.length > 1 || (functions.length > 0 && plottedSeries.length > 0)) && (
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(226,232,240,0.7)' }} />
            )}
            {functions.map((fn) => (
              <Line key={fn.label} data={fn.points} dataKey="y" name={fn.label} stroke={fn.color} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
            ))}
            {plottedSeries.map((entry) =>
              entry.style === 'scatter' ? (
                <Scatter key={entry.label} data={entry.points} dataKey="y" name={entry.label} fill={entry.color} />
              ) : (
                <Line key={entry.label} data={entry.points} dataKey="y" name={entry.label} stroke={entry.color} strokeWidth={2.5} dot={{ r: 3, fill: entry.color, strokeWidth: 0 }} isAnimationActive={false} />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-slate-600">x: [{xMin}, {xMax}] · y: [{yMin.toFixed(1)}, {yMax.toFixed(1)}]</p>
    </div>
  )
}

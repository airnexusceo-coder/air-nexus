'use client'

import { useState } from 'react'
import { CheckCircle2, Eye, FileBarChart, NotebookPen, TriangleAlert } from 'lucide-react'
import type { EndOfRoundReport } from '@/lib/market-masters/report'
import type { Reflection } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

type EndOfRoundReportViewProps = {
  report: EndOfRoundReport
  reflections: Reflection[]
  onAddReflection: (text: string) => void
}

const TONE_ICON = { positive: CheckCircle2, neutral: Eye, watch: TriangleAlert }
const TONE_STYLE = {
  positive: 'border-emerald-300/25 bg-emerald-400/[0.05] text-emerald-100',
  neutral: 'border-white/10 bg-white/[0.03] text-slate-200',
  watch: 'border-amber-300/25 bg-amber-400/[0.05] text-amber-100',
}

export function EndOfRoundReportView({ report, reflections, onAddReflection }: EndOfRoundReportViewProps) {
  const [draft, setDraft] = useState('')

  const submit = () => {
    if (!draft.trim()) return
    onAddReflection(draft)
    setDraft('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><FileBarChart className="size-5 text-slate-400" />End-of-Round Report</h2>
        <p className="mt-1 text-sm text-slate-400">What you did well, what risks you took, and what to try differently — not just a score.</p>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="text-lg font-semibold text-white">{report.headline}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {report.sections.map((section) => {
          const Icon = TONE_ICON[section.tone]
          return (
            <div key={section.title} className={cn('rounded-2xl border p-4', TONE_STYLE[section.tone])}>
              <p className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4" />{section.title}</p>
              <p className="mt-2 text-xs leading-5 opacity-90">{section.body}</p>
            </div>
          )
        })}
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><NotebookPen className="size-4 text-slate-400" />Reflection</h3>
        <p className="mt-1 text-xs text-slate-400">What would you do differently next time? Your reflections are visible to your teacher, if this class uses one.</p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="e.g. I'd spread my money across more industries before buying more of one stock..."
          className="glass-input mt-3 min-h-24 w-full rounded-xl px-3 py-2 text-sm outline-none placeholder:text-slate-500"
        />
        <button type="button" disabled={!draft.trim()} onClick={submit} className="primary-action mt-3 disabled:cursor-not-allowed">
          Save reflection
        </button>

        {reflections.length > 0 && (
          <div className="mt-4 space-y-2">
            {[...reflections].reverse().map((reflection, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-300">
                <span className="text-slate-500">Day {reflection.day}:</span> {reflection.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { GraduationCap, RotateCcw, Settings as SettingsIcon } from 'lucide-react'
import type { GamePreferences, LearningSupport } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type SettingsPageProps = {
  preferences: GamePreferences
  onUpdate: (partial: Partial<Pick<GamePreferences, 'learningSupport' | 'reducedMotion'>>) => void
  onRequestNewCompany: () => void
}

const LEARNING_SUPPORT_OPTIONS: { id: LearningSupport; title: string; description: string }[] = [
  { id: 'full', title: 'Full guided teaching', description: 'Tooltips, explanations, and a learning summary after every year.' },
  { id: 'occasional', title: 'Occasional hints', description: 'Light guidance — the essentials, without constant explanation.' },
  { id: 'minimal', title: 'Minimal teaching', description: 'Almost no hand-holding.' },
  { id: 'sandbox', title: 'Sandbox mode', description: 'No hints or warnings at all.' },
]

export function SettingsPage({ preferences, onUpdate, onRequestNewCompany }: SettingsPageProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><SettingsIcon className="size-5 text-amber-300" />Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Change how the game teaches without losing your cash, products, or history.</p>
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Company details</h2>
        <p className="mt-2 text-sm text-slate-300">Company name, founder name, industry, difficulty, and starting cash are fixed for this company. Start a new company below to choose different ones.</p>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><GraduationCap className="size-4 text-amber-300" />Learning support</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {LEARNING_SUPPORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onUpdate({ learningSupport: option.id })}
              aria-pressed={preferences.learningSupport === option.id}
              className={cn('rounded-xl border p-3 text-left transition', preferences.learningSupport === option.id ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
            >
              <p className="text-sm font-semibold text-white">{option.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Accessibility</h2>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <span>
            <span className="block text-sm font-medium text-white">Reduce motion</span>
            <span className="block text-xs text-slate-400">Turns off non-essential animations and transitions.</span>
          </span>
          <input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => onUpdate({ reducedMotion: event.target.checked })} aria-label="Reduce motion" className="size-5 accent-amber-300" />
        </label>
      </section>

      <section className="rounded-2xl border border-rose-300/20 bg-rose-400/[0.05] p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-100"><RotateCcw className="size-4" />Start a new company</h2>
        <p className="mt-2 text-xs leading-5 text-rose-100/80">This permanently resets your cash, products, transaction history, and lessons for this company, and lets you set up a fresh one.</p>
        {confirmingReset ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-rose-100">Are you sure? This cannot be undone.</span>
            <button type="button" onClick={onRequestNewCompany} className="rounded-lg bg-rose-400/20 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-400/30">Yes, start over</button>
            <button type="button" onClick={() => setConfirmingReset(false)} className="rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingReset(true)} className="secondary-action mt-3 border-rose-300/25 text-rose-100">Start a new company</button>
        )}
      </section>
    </div>
  )
}

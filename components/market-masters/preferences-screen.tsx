'use client'

import { useState } from 'react'
import { CalendarClock, Gauge, GraduationCap, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/market-masters/format'
import {
  DEFAULT_PREFERENCES,
  MAX_STARTING_CASH,
  MIN_STARTING_CASH,
  STARTING_CASH_STEP,
  type Difficulty,
  type GamePreferences,
  type LearningSupport,
} from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

type PreferencesScreenProps = {
  onStart: (preferences: GamePreferences) => void
  /** Shown when reopened from Settings for a fresh game rather than the very first launch. */
  onCancel?: () => void
}

const DIFFICULTIES: { id: Difficulty; title: string; description: string }[] = [
  { id: 'beginner', title: 'Beginner', description: 'More explanations, reduced price swings, helpful warnings, and simple market events.' },
  { id: 'intermediate', title: 'Intermediate', description: 'Moderate volatility, fewer hints, and more complex events.' },
  { id: 'advanced', title: 'Advanced', description: 'Higher volatility, limited hints, complex news, and harder portfolio decisions.' },
]

const LEARNING_SUPPORT_OPTIONS: { id: LearningSupport; title: string; description: string }[] = [
  { id: 'full', title: 'Full guided teaching', description: 'Tooltips, explanations, and warnings throughout the game.' },
  { id: 'occasional', title: 'Occasional hints', description: 'Light guidance — the essentials, without constant explanation.' },
  { id: 'minimal', title: 'Minimal teaching', description: 'Almost no hand-holding. You look things up in the Learning Centre yourself.' },
  { id: 'sandbox', title: 'Sandbox mode', description: 'No hints or warnings at all — pure free play.' },
]

export function PreferencesScreen({ onStart, onCancel }: PreferencesScreenProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_PREFERENCES.difficulty)
  const [startingCash, setStartingCash] = useState(DEFAULT_PREFERENCES.startingCash)
  const [learningSupport, setLearningSupport] = useState<LearningSupport>(DEFAULT_PREFERENCES.learningSupport)

  const selectedDifficulty = DIFFICULTIES.find((option) => option.id === difficulty)
  const selectedLearningSupport = LEARNING_SUPPORT_OPTIONS.find((option) => option.id === learningSupport)

  const handleStart = () => {
    onStart({ difficulty, startingCash, learningSupport, reducedMotion: false })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Create Your Investment Simulation</h1>
        <p className="mt-1 text-sm text-slate-400">Choose how you want to play. You can change most of this later in Settings without losing your progress.</p>
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Gauge className="size-4 text-slate-400" />Difficulty</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {DIFFICULTIES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setDifficulty(option.id)}
              aria-pressed={difficulty === option.id}
              className={cn('rounded-xl border p-3 text-left transition', difficulty === option.id ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
            >
              <p className="text-sm font-semibold text-white">{option.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Wallet className="size-4 text-slate-400" />Starting virtual cash</h2>
        <p className="mt-1 text-xs text-slate-500">This is virtual money only — no real money is ever involved.</p>
        <div className="mt-4 flex items-center gap-4">
          <input
            type="range"
            min={MIN_STARTING_CASH}
            max={MAX_STARTING_CASH}
            step={STARTING_CASH_STEP}
            value={startingCash}
            onChange={(event) => setStartingCash(Number(event.target.value))}
            aria-label="Starting virtual cash"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-white"
          />
          <span className="w-28 shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right text-sm font-semibold text-white">{formatCurrency(startingCash)}</span>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>{formatCurrency(MIN_STARTING_CASH)}</span>
          <span>{formatCurrency(MAX_STARTING_CASH)}</span>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><GraduationCap className="size-4 text-slate-400" />Learning support</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {LEARNING_SUPPORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLearningSupport(option.id)}
              aria-pressed={learningSupport === option.id}
              className={cn('rounded-xl border p-3 text-left transition', learningSupport === option.id ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
            >
              <p className="text-sm font-semibold text-white">{option.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-sky-300/20 bg-sky-400/[0.05] p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><CalendarClock className="size-4 text-sky-300" />Real market hours</h2>
        <p className="mt-2 text-xs leading-5 text-sky-100/90">
          This market follows real trading hours, like an actual stock exchange: <span className="font-semibold text-white">9:00 AM to 5:00 PM, Monday to Friday, in your own local time.</span> Prices update automatically about every 5 minutes while the market is open, and go quiet outside those hours and on weekends — there is no &quot;speed&quot; to pick, because this is how real markets actually work.
        </p>
      </section>

      <section className="glass-glow rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Summary</h2>
        <dl className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Difficulty</dt><dd className="font-medium text-white">{selectedDifficulty?.title}</dd></div>
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Starting cash</dt><dd className="font-medium text-white">{formatCurrency(startingCash)}</dd></div>
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Learning support</dt><dd className="font-medium text-white">{selectedLearningSupport?.title}</dd></div>
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Market hours</dt><dd className="font-medium text-white">9:00 AM–5:00 PM, Mon–Fri</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="secondary-action">Cancel</button>}
          <button type="button" onClick={handleStart} className="primary-action">Start Game</button>
        </div>
      </section>
    </div>
  )
}

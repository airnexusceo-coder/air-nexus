'use client'

import { useMemo, useState } from 'react'
import { Building2, Gauge, GraduationCap, User, Wallet } from 'lucide-react'
import { INDUSTRY_PROFILES } from '@/lib/business-empire/industries'
import { formatCurrency } from '@/lib/business-empire/format'
import { DIFFICULTY_CASH_RANGE, STARTING_CASH_STEP, type Difficulty, type GamePreferences, type Industry, type LearningSupport } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type SetupScreenProps = {
  onStart: (preferences: GamePreferences) => void
}

const DIFFICULTIES: { id: Difficulty; title: string; description: string }[] = [
  { id: 'beginner', title: 'Beginner', description: 'More guidance, lower costs, and customers who are easier to win over.' },
  { id: 'intermediate', title: 'Intermediate', description: 'Balanced costs, demand, and competition — a fair fight.' },
  { id: 'advanced', title: 'Advanced', description: 'Strong competitors, shifting customer preferences, and real financial risk.' },
]

const LEARNING_SUPPORT_OPTIONS: { id: LearningSupport; title: string; description: string }[] = [
  { id: 'full', title: 'Full guided teaching', description: 'Tooltips, explanations, and a learning summary after every year.' },
  { id: 'occasional', title: 'Occasional hints', description: 'Light guidance — the essentials, without constant explanation.' },
  { id: 'minimal', title: 'Minimal teaching', description: 'Almost no hand-holding — look things up in the Learning Centre yourself.' },
  { id: 'sandbox', title: 'Sandbox mode', description: 'No hints or warnings at all — pure free play.' },
]

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [companyName, setCompanyName] = useState('')
  const [founderName, setFounderName] = useState('')
  const [industry, setIndustry] = useState<Industry>('Clothing')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const cashRange = DIFFICULTY_CASH_RANGE[difficulty]
  const [startingCash, setStartingCash] = useState(cashRange.default)
  const [learningSupport, setLearningSupport] = useState<LearningSupport>('full')

  const industryProfile = useMemo(() => INDUSTRY_PROFILES.find((entry) => entry.industry === industry)!, [industry])
  const canStart = companyName.trim().length > 0 && founderName.trim().length > 0

  const handleDifficultyChange = (next: Difficulty) => {
    setDifficulty(next)
    setStartingCash(DIFFICULTY_CASH_RANGE[next].default)
  }

  const handleStart = () => {
    if (!canStart) return
    onStart({ companyName: companyName.trim(), founderName: founderName.trim(), industry, difficulty, startingCash, learningSupport, reducedMotion: false })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Start Your Company</h1>
        <p className="mt-1 text-sm text-slate-400">Set up your business before your first financial year begins. You can change most of this later in Settings.</p>
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Building2 className="size-4 text-amber-300" />Company details</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-slate-400">Company name</span>
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. Northbridge Apparel" maxLength={60} className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="flex items-center gap-1 text-xs text-slate-400"><User className="size-3.5" />Founder name</span>
            <input value={founderName} onChange={(event) => setFounderName(event.target.value)} placeholder="Your name" maxLength={60} className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" />
          </label>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Choose an industry</h2>
        <p className="mt-1 text-xs text-slate-500">Every industry has different customers, prices, costs, and risks.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {INDUSTRY_PROFILES.map((profile) => (
            <button
              key={profile.industry}
              type="button"
              onClick={() => setIndustry(profile.industry)}
              aria-pressed={industry === profile.industry}
              className={cn('rounded-xl border p-3 text-left transition', industry === profile.industry ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
            >
              <p className="text-sm font-semibold text-white">{profile.industry}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{profile.tagline}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
          <p><span className="text-slate-500">Average price:</span> {formatCurrency(industryProfile.averagePrice)} · <span className="text-slate-500">Competition:</span> {industryProfile.competitionLevel} · <span className="text-slate-500">Growth:</span> +{industryProfile.growthPotential}%/yr</p>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Gauge className="size-4 text-amber-300" />Difficulty</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {DIFFICULTIES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleDifficultyChange(option.id)}
              aria-pressed={difficulty === option.id}
              className={cn('rounded-xl border p-3 text-left transition', difficulty === option.id ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
            >
              <p className="text-sm font-semibold text-white">{option.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Wallet className="size-4 text-amber-300" />Starting virtual cash</h2>
        <p className="mt-1 text-xs text-slate-500">Virtual money only — no real money is ever involved. Your difficulty sets the available range.</p>
        <div className="mt-4 flex items-center gap-4">
          <input
            type="range"
            min={cashRange.min}
            max={cashRange.max}
            step={STARTING_CASH_STEP}
            value={startingCash}
            onChange={(event) => setStartingCash(Number(event.target.value))}
            aria-label="Starting virtual cash"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-300"
          />
          <span className="w-28 shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right text-sm font-semibold text-white">{formatCurrency(startingCash)}</span>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>{formatCurrency(cashRange.min)}</span>
          <span>{formatCurrency(cashRange.max)}</span>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><GraduationCap className="size-4 text-amber-300" />Learning support</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {LEARNING_SUPPORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLearningSupport(option.id)}
              aria-pressed={learningSupport === option.id}
              className={cn('rounded-xl border p-3 text-left transition', learningSupport === option.id ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
            >
              <p className="text-sm font-semibold text-white">{option.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="glass-glow rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Summary</h2>
        <dl className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Industry</dt><dd className="font-medium text-white">{industry}</dd></div>
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Difficulty</dt><dd className="font-medium text-white capitalize">{difficulty}</dd></div>
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Starting cash</dt><dd className="font-medium text-white">{formatCurrency(startingCash)}</dd></div>
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Learning support</dt><dd className="font-medium text-white">{LEARNING_SUPPORT_OPTIONS.find((o) => o.id === learningSupport)?.title}</dd></div>
        </dl>
        {!canStart && <p className="mt-3 text-xs text-amber-200">Enter a company name and founder name to continue.</p>}
        <button type="button" disabled={!canStart} onClick={handleStart} className="primary-action mt-4 disabled:cursor-not-allowed disabled:opacity-50">
          Found the Company
        </button>
      </section>
    </div>
  )
}

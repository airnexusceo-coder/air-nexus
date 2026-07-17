'use client'

import { useMemo, useState } from 'react'
import { Briefcase, Building2, Gauge, GraduationCap, School, User, Wallet } from 'lucide-react'
import { INDUSTRY_PROFILES } from '@/lib/business-empire/industries'
import { formatCurrency } from '@/lib/business-empire/format'
import {
  assignJobByDegreeQuality,
  computeCareerSavings,
  computeFoundingAge,
  DEGREE_PROFILES,
  getUniversityTierLabel,
  isDegreeRelevantToIndustry,
  MAX_YEARS_WORKED,
  scoreEntranceQuiz,
  STARTING_AGE,
  UNIVERSITY_ENTRANCE_QUIZ,
} from '@/lib/business-empire/hardcore-career'
import { DIFFICULTY_CASH_RANGE, STARTING_CASH_STEP, type CareerBackground, type Degree, type Difficulty, type GamePreferences, type Industry, type LearningSupport } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type SetupScreenProps = {
  onStart: (preferences: GamePreferences) => void
}

const DIFFICULTIES: { id: Difficulty; title: string; description: string }[] = [
  { id: 'beginner', title: 'Beginner', description: 'More guidance, lower costs, and customers who are easier to win over.' },
  { id: 'intermediate', title: 'Intermediate', description: 'Balanced costs, demand, and competition — a fair fight.' },
  { id: 'advanced', title: 'Advanced', description: 'Strong competitors, shifting customer preferences, and real financial risk.' },
  { id: 'hardcore', title: 'Hardcore', description: 'The toughest economy — and starting capital has to be earned through a real job first, not picked from a slider.' },
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

  const isHardcore = difficulty === 'hardcore'
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>(() => UNIVERSITY_ENTRANCE_QUIZ.map(() => null))
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [universityQuality, setUniversityQuality] = useState(0)
  const [degree, setDegree] = useState<Degree>('none')
  const [yearsWorked, setYearsWorked] = useState(2)

  const assignedJob = useMemo(() => (quizSubmitted ? assignJobByDegreeQuality(degree, universityQuality) : null), [quizSubmitted, degree, universityQuality])
  const projectedSavings = assignedJob ? computeCareerSavings(assignedJob, yearsWorked) : 0
  const foundingAge = computeFoundingAge(degree, yearsWorked)
  const quizComplete = quizAnswers.every((answer) => answer !== null)
  const correctCount = quizAnswers.reduce<number>((count, answer, index) => (answer === UNIVERSITY_ENTRANCE_QUIZ[index].correctIndex ? count + 1 : count), 0)

  const industryProfile = useMemo(() => INDUSTRY_PROFILES.find((entry) => entry.industry === industry)!, [industry])
  const canStart = companyName.trim().length > 0 && founderName.trim().length > 0 && (!isHardcore || (quizSubmitted && Boolean(assignedJob)))

  const handleDifficultyChange = (next: Difficulty) => {
    setDifficulty(next)
    setStartingCash(DIFFICULTY_CASH_RANGE[next].default)
  }

  const handleQuizAnswer = (questionIndex: number, optionIndex: number) => {
    if (quizSubmitted) return
    setQuizAnswers((current) => current.map((answer, index) => (index === questionIndex ? optionIndex : answer)))
  }

  const handleSubmitQuiz = () => {
    if (!quizComplete || quizSubmitted) return
    setUniversityQuality(scoreEntranceQuiz(quizAnswers))
    setQuizSubmitted(true)
  }

  const handleStart = () => {
    if (!canStart || !assignedJob) return
    const careerBackground: CareerBackground | undefined = isHardcore
      ? { universityQuality, degree, jobId: assignedJob.id, yearsWorked, totalSavings: projectedSavings, foundingAge }
      : undefined
    onStart({
      companyName: companyName.trim(),
      founderName: founderName.trim(),
      industry,
      difficulty,
      startingCash: careerBackground ? careerBackground.totalSavings : startingCash,
      learningSupport,
      reducedMotion: false,
      careerBackground,
    })
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

      {isHardcore ? (
        <section className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><School className="size-4 text-amber-300" />Life begins at 16</h2>
          <p className="mt-1 text-xs text-slate-500">
            Hardcore Mode starts your founder in high school at age {STARTING_AGE}. There is no free starting cash and no choosing a profession — you take one entrance quiz, it decides which university you place into, and your job is assigned from how strong your degree turns out to be.
          </p>

          {!quizSubmitted ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-400">Entrance quiz — one attempt, answer every question:</p>
              {UNIVERSITY_ENTRANCE_QUIZ.map((question, questionIndex) => (
                <div key={question.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-xs font-medium text-white">{questionIndex + 1}. {question.prompt}</p>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => (
                      <button
                        key={optionIndex}
                        type="button"
                        onClick={() => handleQuizAnswer(questionIndex, optionIndex)}
                        aria-pressed={quizAnswers[questionIndex] === optionIndex}
                        className={cn('rounded-lg border px-2.5 py-1.5 text-left text-xs transition', quizAnswers[questionIndex] === optionIndex ? 'border-amber-300/40 bg-amber-400/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5')}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" disabled={!quizComplete} onClick={handleSubmitQuiz} className="primary-action disabled:cursor-not-allowed disabled:opacity-50">
                Submit quiz
              </button>
              {!quizComplete && <p className="text-xs text-amber-200">Answer every question to submit.</p>}
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
                Quiz result: <span className="font-semibold text-white">{correctCount}/{UNIVERSITY_ENTRANCE_QUIZ.length} correct ({universityQuality}%)</span> — placed into <span className="font-semibold text-white">{getUniversityTierLabel(universityQuality)}</span>.
              </div>

              <div className="mt-4">
                <p className="text-xs text-slate-400">Choose a degree to study</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {DEGREE_PROFILES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDegree(option.id)}
                      aria-pressed={degree === option.id}
                      className={cn('rounded-xl border p-3 text-left transition', degree === option.id ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
                    >
                      <p className="text-sm font-semibold text-white">{option.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
                      {isDegreeRelevantToIndustry(option.id, industry) && <p className="mt-1 text-[10px] text-emerald-300">Relevant to {industry} — small reputation bonus at founding.</p>}
                    </button>
                  ))}
                </div>
              </div>

              {assignedJob && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="flex items-center gap-1.5 text-xs text-slate-400"><Briefcase className="size-3.5" />Job assigned from your degree — not chosen freely</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{assignedJob.title}</p>
                    <span className="shrink-0 text-xs text-slate-400">{formatCurrency(assignedJob.annualSalary)}/yr</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{assignedJob.employer} — {assignedJob.description}</p>
                </div>
              )}

              <div className="mt-4">
                <p className="text-xs text-slate-400">Years worked before founding the company (max {MAX_YEARS_WORKED})</p>
                <div className="mt-2 flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={MAX_YEARS_WORKED}
                    step={1}
                    value={yearsWorked}
                    onChange={(event) => setYearsWorked(Number(event.target.value))}
                    aria-label="Years worked before founding the company"
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-300"
                  />
                  <span className="w-16 shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right text-sm font-semibold text-white">{yearsWorked}</span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
                Founding at age <span className="font-semibold text-white">{foundingAge}</span> with projected starting capital of <span className="font-semibold text-white">{formatCurrency(projectedSavings)}</span>.
                {yearsWorked === 0 && <span className="ml-1">(Founding immediately after graduating — the hardest possible start.)</span>}
              </div>
            </>
          )}
        </section>
      ) : (
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
      )}

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
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Starting cash</dt><dd className="font-medium text-white">{formatCurrency(isHardcore ? projectedSavings : startingCash)}</dd></div>
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Learning support</dt><dd className="font-medium text-white">{LEARNING_SUPPORT_OPTIONS.find((o) => o.id === learningSupport)?.title}</dd></div>
          {isHardcore && quizSubmitted && assignedJob && (
            <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2 sm:col-span-2"><dt className="text-slate-500">Career</dt><dd className="font-medium text-white">{getUniversityTierLabel(universityQuality)} · {assignedJob.title} for {yearsWorked} year(s) · founding at age {foundingAge}</dd></div>
          )}
        </dl>
        {!canStart && <p className="mt-3 text-xs text-amber-200">{isHardcore && companyName.trim() && founderName.trim() ? 'Complete the entrance quiz to continue.' : 'Enter a company name and founder name to continue.'}</p>}
        <button type="button" disabled={!canStart} onClick={handleStart} className="primary-action mt-4 disabled:cursor-not-allowed disabled:opacity-50">
          Found the Company
        </button>
      </section>
    </div>
  )
}

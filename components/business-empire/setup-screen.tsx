'use client'

import { useMemo, useState } from 'react'
import { Briefcase, Building2, ClipboardCheck, Gauge, GraduationCap, ReceiptText, School, User, Wallet } from 'lucide-react'
import { BusinessEmpireLogo } from '@/components/business-empire/business-empire-logo'
import { INDUSTRY_PROFILES } from '@/lib/business-empire/industries'
import { formatCurrency } from '@/lib/business-empire/format'
import {
  computeCareerFinance,
  computeFoundingAge,
  DEGREE_PROFILES,
  evaluateJobInterview,
  getUniversityTierLabel,
  isDegreeRelevantToIndustry,
  JOB_INTERVIEW_QUESTIONS,
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
  { id: 'intermediate', title: 'Intermediate', description: 'Balanced costs, demand, and competition - a fair fight.' },
  { id: 'advanced', title: 'Advanced', description: 'Strong competitors, shifting customer preferences, and real financial risk.' },
  { id: 'hardcore', title: 'Hardcore', description: 'Start at 16, pass school, interview for work, pay life costs, then build from what you actually save.' },
]

const LEARNING_SUPPORT_OPTIONS: { id: LearningSupport; title: string; description: string }[] = [
  { id: 'full', title: 'Full guided teaching', description: 'Tooltips, explanations, and a learning summary after every year.' },
  { id: 'occasional', title: 'Occasional hints', description: 'Light guidance - the essentials, without constant explanation.' },
  { id: 'minimal', title: 'Minimal teaching', description: 'Almost no hand-holding - look things up in the Learning Centre yourself.' },
  { id: 'sandbox', title: 'Sandbox mode', description: 'No hints or warnings at all - pure free play.' },
]

function emptyInterviewAnswers(): (number | null)[] {
  return JOB_INTERVIEW_QUESTIONS.map(() => null)
}

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
  const [interviewAnswers, setInterviewAnswers] = useState<(number | null)[]>(emptyInterviewAnswers)
  const [interviewSubmitted, setInterviewSubmitted] = useState(false)
  const [yearsWorked, setYearsWorked] = useState(2)

  const interviewOutcome = useMemo(
    () => (quizSubmitted && interviewSubmitted ? evaluateJobInterview({ answers: interviewAnswers, degree, universityQuality, industry }) : null),
    [degree, industry, interviewAnswers, interviewSubmitted, quizSubmitted, universityQuality],
  )
  const offeredJob = interviewOutcome?.passed ? interviewOutcome.job : null
  const careerFinance = offeredJob ? computeCareerFinance(offeredJob, yearsWorked, degree, universityQuality) : null
  const projectedSavings = careerFinance?.netSavings ?? 0
  const foundingAge = computeFoundingAge(degree, yearsWorked)
  const quizComplete = quizAnswers.every((answer) => answer !== null)
  const interviewComplete = interviewAnswers.every((answer) => answer !== null)
  const correctCount = quizAnswers.reduce<number>((count, answer, index) => (answer === UNIVERSITY_ENTRANCE_QUIZ[index].correctIndex ? count + 1 : count), 0)

  const industryProfile = useMemo(() => INDUSTRY_PROFILES.find((entry) => entry.industry === industry)!, [industry])
  const hasNames = companyName.trim().length > 0 && founderName.trim().length > 0
  const canStart = hasNames && (!isHardcore || Boolean(quizSubmitted && interviewOutcome?.passed && offeredJob && careerFinance))
  const startHint = !hasNames
    ? 'Enter a company name and founder name to continue.'
    : isHardcore && !quizSubmitted
      ? 'Complete the entrance quiz to continue.'
      : isHardcore && !interviewSubmitted
        ? 'Complete the job interview to earn an offer first.'
        : isHardcore && !interviewOutcome?.passed
          ? 'No job offer yet - improve the interview before founding.'
          : ''

  const resetInterview = () => {
    setInterviewAnswers(emptyInterviewAnswers())
    setInterviewSubmitted(false)
  }

  const handleIndustryChange = (next: Industry) => {
    setIndustry(next)
    if (isHardcore && quizSubmitted) resetInterview()
  }

  const handleDifficultyChange = (next: Difficulty) => {
    setDifficulty(next)
    setStartingCash(DIFFICULTY_CASH_RANGE[next].default)
  }

  const handleDegreeChange = (next: Degree) => {
    setDegree(next)
    resetInterview()
  }

  const handleQuizAnswer = (questionIndex: number, optionIndex: number) => {
    if (quizSubmitted) return
    setQuizAnswers((current) => current.map((answer, index) => (index === questionIndex ? optionIndex : answer)))
  }

  const handleSubmitQuiz = () => {
    if (!quizComplete || quizSubmitted) return
    setUniversityQuality(scoreEntranceQuiz(quizAnswers))
    setQuizSubmitted(true)
    resetInterview()
  }

  const handleInterviewAnswer = (questionIndex: number, optionIndex: number) => {
    if (interviewSubmitted) return
    setInterviewAnswers((current) => current.map((answer, index) => (index === questionIndex ? optionIndex : answer)))
  }

  const handleSubmitInterview = () => {
    if (!quizSubmitted || !interviewComplete || interviewSubmitted) return
    setInterviewSubmitted(true)
  }

  const handleStart = () => {
    if (!canStart) return
    const careerBackground: CareerBackground | undefined = isHardcore && offeredJob && careerFinance && interviewOutcome
      ? {
          universityQuality,
          degree,
          jobId: offeredJob.id,
          interviewScore: interviewOutcome.score,
          interviewPassed: true,
          yearsWorked,
          totalSavings: careerFinance.netSavings,
          careerFinance,
          foundingAge,
        }
      : undefined
    if (isHardcore && !careerBackground) return
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
      <div className="glass-strong rounded-3xl p-5">
        <BusinessEmpireLogo />
        <h1 className="mt-5 text-2xl font-semibold text-white">Start Your Company</h1>
        <p className="mt-1 text-sm text-slate-400">Set up your business before your first financial year begins. Each industry uses different margins, regulation, supply chains, risks, and customer behavior.</p>
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
        <p className="mt-1 text-xs text-slate-500">Every industry has different customers, prices, costs, risks, sales cycles, and regulation pressure.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {INDUSTRY_PROFILES.map((profile) => (
            <button
              key={profile.industry}
              type="button"
              onClick={() => handleIndustryChange(profile.industry)}
              aria-pressed={industry === profile.industry}
              className={cn('rounded-xl border p-3 text-left transition', industry === profile.industry ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
            >
              <p className="text-sm font-semibold text-white">{profile.industry}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{profile.tagline}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
          <p><span className="text-slate-500">Average price:</span> {formatCurrency(industryProfile.averagePrice)} <span className="mx-1 text-slate-600">/</span> <span className="text-slate-500">Competition:</span> {industryProfile.competitionLevel} <span className="mx-1 text-slate-600">/</span> <span className="text-slate-500">Growth:</span> +{industryProfile.growthPotential}%/yr</p>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Gauge className="size-4 text-amber-300" />Difficulty</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Hardcore Mode starts your founder in high school at age {STARTING_AGE}. There is no free starting cash, no guaranteed job, and no profession picker. You take one entrance quiz, choose a path, pass an interview, work, pay life costs, then found with what you saved.
          </p>

          {!quizSubmitted ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-400">Entrance quiz - one attempt, answer every question:</p>
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
                Quiz result: <span className="font-semibold text-white">{correctCount}/{UNIVERSITY_ENTRANCE_QUIZ.length} correct ({universityQuality}%)</span> - placed into <span className="font-semibold text-white">{getUniversityTierLabel(universityQuality)}</span>.
              </div>

              <div className="mt-4">
                <p className="text-xs text-slate-400">Choose a degree or work path</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {DEGREE_PROFILES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleDegreeChange(option.id)}
                      aria-pressed={degree === option.id}
                      className={cn('rounded-xl border p-3 text-left transition', degree === option.id ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
                    >
                      <p className="text-sm font-semibold text-white">{option.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
                      {isDegreeRelevantToIndustry(option.id, industry) && <p className="mt-1 text-[10px] text-emerald-300">Relevant to {industry} - small reputation bonus at founding.</p>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-white"><ClipboardCheck className="size-3.5 text-amber-300" />Job interview</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">A strong path helps, but the offer is not guaranteed. Your answers decide whether an employer trusts you enough to hire you before you found.</p>

                {!interviewSubmitted ? (
                  <div className="mt-3 space-y-3">
                    {JOB_INTERVIEW_QUESTIONS.map((question, questionIndex) => (
                      <div key={question.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <p className="text-xs font-medium text-white">{questionIndex + 1}. {question.prompt}</p>
                        <div className="mt-2 grid gap-1.5">
                          {question.options.map((option, optionIndex) => (
                            <button
                              key={optionIndex}
                              type="button"
                              onClick={() => handleInterviewAnswer(questionIndex, optionIndex)}
                              aria-pressed={interviewAnswers[questionIndex] === optionIndex}
                              className={cn('rounded-lg border px-2.5 py-2 text-left text-xs transition', interviewAnswers[questionIndex] === optionIndex ? 'border-amber-300/40 bg-amber-400/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5')}
                            >
                              <span className="block">{option.label}</span>
                              <span className="mt-0.5 block text-[10px] text-slate-500">{option.note}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button type="button" disabled={!interviewComplete} onClick={handleSubmitInterview} className="primary-action disabled:cursor-not-allowed disabled:opacity-50">
                      Attend interview
                    </button>
                    {!interviewComplete && <p className="text-xs text-amber-200">Answer every interview question first.</p>}
                  </div>
                ) : interviewOutcome ? (
                  <div className={cn('mt-3 rounded-xl border p-3 text-xs', interviewOutcome.passed ? 'border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100' : 'border-red-300/25 bg-red-400/[0.08] text-red-100')}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-white">{interviewOutcome.passed ? 'Offer received' : 'No offer'}</p>
                      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] text-white">Score {interviewOutcome.score}/{interviewOutcome.threshold}</span>
                    </div>
                    <ul className="mt-2 space-y-1 leading-5">
                      {interviewOutcome.feedback.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    {!interviewOutcome.passed && (
                      <button type="button" onClick={resetInterview} className="mt-3 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/15">
                        Try another interview
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              {offeredJob && careerFinance && (
                <>
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="flex items-center gap-1.5 text-xs text-slate-400"><Briefcase className="size-3.5" />Job earned through interview</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{offeredJob.title}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatCurrency(offeredJob.annualSalary)}/yr</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{offeredJob.employer} - {offeredJob.description}</p>
                  </div>

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

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-white"><ReceiptText className="size-3.5 text-amber-300" />Life costs before founding</h3>
                    <dl className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                      <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Gross income</dt><dd className="font-medium text-white">{formatCurrency(careerFinance.grossIncome)}</dd></div>
                      <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Income tax</dt><dd className="font-medium text-red-200">-{formatCurrency(careerFinance.incomeTax)}</dd></div>
                      <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Housing and bills</dt><dd className="font-medium text-red-200">-{formatCurrency(careerFinance.housingAndBills)}</dd></div>
                      <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Food and transport</dt><dd className="font-medium text-red-200">-{formatCurrency(careerFinance.foodAndTransport)}</dd></div>
                      <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Student debt</dt><dd className="font-medium text-red-200">-{formatCurrency(careerFinance.studentDebtPayments)}</dd></div>
                      <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"><dt className="text-slate-500">Emergencies</dt><dd className="font-medium text-red-200">-{formatCurrency(careerFinance.emergencyExpenses)}</dd></div>
                    </dl>
                    <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
                      Founding at age <span className="font-semibold text-white">{foundingAge}</span> with saved company capital of <span className="font-semibold text-white">{formatCurrency(careerFinance.netSavings)}</span> after taxes and personal expenses.
                      {yearsWorked === 0 && <span className="ml-1">Working zero years means no savings - the hardest possible start.</span>}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Wallet className="size-4 text-amber-300" />Starting virtual cash</h2>
          <p className="mt-1 text-xs text-slate-500">Virtual money only - no real money is ever involved. Your difficulty sets the available range.</p>
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
          {isHardcore && interviewOutcome?.passed && offeredJob && (
            <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 sm:col-span-2"><dt className="text-slate-500">Career</dt><dd className="text-right font-medium text-white">{getUniversityTierLabel(universityQuality)} / interview {interviewOutcome.score} / {offeredJob.title} for {yearsWorked} year(s) / founding at age {foundingAge}</dd></div>
          )}
        </dl>
        {!canStart && startHint && <p className="mt-3 text-xs text-amber-200">{startHint}</p>}
        <button type="button" disabled={!canStart} onClick={handleStart} className="primary-action mt-4 disabled:cursor-not-allowed disabled:opacity-50">
          Found the Company
        </button>
      </section>
    </div>
  )
}

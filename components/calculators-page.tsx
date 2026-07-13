'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calculator, ChartNoAxesCombined, GraduationCap, History, LockKeyhole, Plus, RotateCcw, Save, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { compileExpression } from '@/lib/math/expression'
import { calculateAtarAutomatic, calculateGrade } from '@/lib/calculator-results'
import { getScalingTable, SUPPORTED_ATAR_CURRICULA, type AtarCurriculum } from '@/lib/atar/atar-scaling-data'
import type { NexusPlan } from '@/lib/plans'
import { cn } from '@/lib/utils'

type CalculatorTab = 'grade' | 'atar' | 'graph'

type SavedCalculation = { id: string; tool: string; result: string; createdAt: string }
const CALCULATOR_HISTORY_KEY = 'airnexus-calculator-history-v1'

type CalculatorsPageProps = {
  plan: NexusPlan
  onRequestUpgrade: (feature: string, plan: Exclude<NexusPlan, 'Free'>) => void
}

const planRank: Record<NexusPlan, number> = { Free: 0, Plus: 1, Premium: 2 }
const tabs: Array<{ id: CalculatorTab; label: string; plan: NexusPlan; icon: typeof Calculator }> = [
  { id: 'grade', label: 'Grade Calculator', plan: 'Free', icon: Calculator },
  { id: 'atar', label: 'ATAR Calculator', plan: 'Plus', icon: GraduationCap },
  { id: 'graph', label: 'Graphing Calculator', plan: 'Premium', icon: ChartNoAxesCombined },
]

export function CalculatorsPage({ plan, onRequestUpgrade }: CalculatorsPageProps) {
  const [active, setActive] = useState<CalculatorTab>('grade')
  const [history, setHistory] = useState<SavedCalculation[]>([])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(CALCULATOR_HISTORY_KEY) ?? '[]') as SavedCalculation[]
        if (Array.isArray(saved)) setHistory(saved.filter((item) => item && typeof item.id === 'string' && typeof item.result === 'string'))
      } catch {
        window.localStorage.removeItem(CALCULATOR_HISTORY_KEY)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const saveResult = (tool: string, result: string) => {
    const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, tool, result, createdAt: new Date().toISOString() }, ...history].slice(0, 20)
    setHistory(next)
    window.localStorage.setItem(CALCULATOR_HISTORY_KEY, JSON.stringify(next))
  }

  const selectTab = (tab: (typeof tabs)[number]) => {
    if (planRank[plan] < planRank[tab.plan]) {
      onRequestUpgrade(tab.label, tab.plan as Exclude<NexusPlan, 'Free'>)
      return
    }
    setActive(tab.id)
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">Estimate results and explore functions with student-friendly tools.</p>
      <div className="scrollbar-thin mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Student calculators">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const unlocked = planRank[plan] >= planRank[tab.plan]
          return <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => selectTab(tab)} className={cn('flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition', active === tab.id ? 'border-white/30 bg-white/10 text-white' : 'border-white/8 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07]')}><Icon className="size-4" />{tab.label}{!unlocked && <span className="ml-1 flex items-center gap-1 rounded-full bg-white/6 px-2 py-0.5 text-[9px]"><LockKeyhole className="size-2.5" />{tab.plan}</span>}</button>
        })}
      </div>
      <div className="mt-4">{active === 'grade' ? <GradeCalculator onSave={saveResult} /> : active === 'atar' ? <AtarCalculator onSave={saveResult} /> : <GraphingCalculator />}</div>
      <section className="glass mt-5 rounded-2xl p-4" aria-labelledby="calculator-history-heading">
        <div className="flex items-center gap-2"><History className="size-4 text-zinc-300" /><h2 id="calculator-history-heading" className="text-sm font-semibold">Saved calculator results</h2></div>
        {history.length === 0 ? <p className="mt-3 text-xs text-slate-500">No saved results yet. Use Save result after calculating.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{history.slice(0, 6).map((item) => <div key={item.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-white">{item.tool}</span><span className="text-[9px] text-slate-600">{new Date(item.createdAt).toLocaleDateString()}</span></div><p className="mt-1 text-xs text-slate-400">{item.result}</p></div>)}</div>}
      </section>
    </div>
  )
}

type Assessment = { id: number; name: string; score: string; total: string; weight: string }

function GradeCalculator({ onSave }: { onSave: (tool: string, result: string) => void }) {
  const [assessments, setAssessments] = useState<Assessment[]>([
    { id: 1, name: '', score: '', total: '100', weight: '' },
  ])
  const [target, setTarget] = useState('80')
  const calculated = useMemo(() => calculateGrade(
    assessments.map((item) => ({ score: Number(item.score), total: Number(item.total), weight: Number(item.weight) })),
    Number(target),
  ), [assessments, target])
  const hasInvalidAssessment = assessments.some((item) => {
    const score = Number(item.score); const total = Number(item.total); const weight = Number(item.weight)
    return !item.name.trim() || !Number.isFinite(score) || !Number.isFinite(total) || !Number.isFinite(weight) || score < 0 || total <= 0 || score > total || weight <= 0 || weight > 100
  })
  const gradeError = hasInvalidAssessment
    ? 'Each assessment needs a name, a score between 0 and its total, and a weighting from 0 to 100.'
    : calculated.usedWeight > 100
      ? `Assessment weightings total ${calculated.usedWeight.toFixed(1)}%. Reduce them to 100% or less.`
      : Number(target) < 0 || Number(target) > 100
        ? 'Target grade must be between 0 and 100.'
        : null

  const updateAssessment = (id: number, field: keyof Omit<Assessment, 'id'>, value: string) => setAssessments((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item))

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Free tool</p><h2 className="mt-1 text-xl font-semibold">Grade Calculator</h2></div><button type="button" onClick={() => setAssessments((items) => [...items, { id: Date.now(), name: '', score: '', total: '100', weight: '' }])} className="primary-action"><Plus className="size-4" />Add assessment</button></div>
      <div className="mt-5 space-y-3">
        {assessments.map((item) => (
          <div key={item.id} className="grid gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3 sm:grid-cols-[2fr_repeat(3,1fr)_auto]">
            <input aria-label="Assignment name" value={item.name} onChange={(event) => updateAssessment(item.id, 'name', event.target.value)} placeholder="Assignment name" className="calculator-input" />
            <input aria-label="Score received" type="number" min="0" value={item.score} onChange={(event) => updateAssessment(item.id, 'score', event.target.value)} placeholder="Score" className="calculator-input" />
            <input aria-label="Total possible score" type="number" min="1" value={item.total} onChange={(event) => updateAssessment(item.id, 'total', event.target.value)} placeholder="Out of" className="calculator-input" />
            <input aria-label="Weight percentage" type="number" min="0" max="100" value={item.weight} onChange={(event) => updateAssessment(item.id, 'weight', event.target.value)} placeholder="Weight %" className="calculator-input" />
            <button type="button" onClick={() => setAssessments((items) => items.filter((assessment) => assessment.id !== item.id))} disabled={assessments.length === 1} aria-label={'Remove ' + (item.name || 'assessment')} className="interactive-icon"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <ResultCard label="Current grade" value={calculated.current.toFixed(1) + '%'} />
        <ResultCard label="Weighted grade" value={calculated.weighted.toFixed(1) + '%'} detail={calculated.weightedPoints.toFixed(1) + ' weighted points'} />
        <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><label htmlFor="target-grade" className="text-[10px] uppercase tracking-wider text-slate-500">Target grade</label><div className="mt-2 flex items-center gap-2"><input id="target-grade" type="number" min="0" max="100" value={target} onChange={(event) => setTarget(event.target.value)} className="calculator-input min-w-0 flex-1" /><span className="text-slate-500">%</span></div></div>
      </div>
      <div className={cn('mt-4 rounded-2xl border p-4 text-sm', gradeError ? 'border-rose-300/15 bg-rose-400/[0.06] text-rose-200' : 'border-white/15 bg-white/[0.06] text-white')}>{gradeError ?? (calculated.remaining <= 0 ? 'All 100% of assessment weight is already entered.' : calculated.needed === null || !Number.isFinite(calculated.needed) ? 'Enter valid assessments and a target grade.' : calculated.needed <= 0 ? 'You have already secured your target grade.' : calculated.needed > 100 ? 'The target is not reachable with the remaining ' + calculated.remaining.toFixed(0) + '% weight.' : 'You need ' + calculated.needed.toFixed(1) + '% across the remaining ' + calculated.remaining.toFixed(0) + '% weight to reach your target.')}</div>
      <button type="button" disabled={Boolean(gradeError) || calculated.validCount === 0} onClick={() => onSave('Grade Calculator', `${calculated.current.toFixed(1)}% current · ${calculated.weighted.toFixed(1)}% weighted`)} className="secondary-action mt-4"><Save className="size-4" />Save result</button>
    </section>
  )
}

type AtarSubjectForm = { id: number; subjectId: string; score: string }

function AtarCalculator({ onSave }: { onSave: (tool: string, result: string) => void }) {
  const [curriculum, setCurriculum] = useState<AtarCurriculum>('VCE')
  const [examYear, setExamYear] = useState('2025')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjects, setSubjects] = useState<AtarSubjectForm[]>([
    { id: 1, subjectId: '', score: '' },
    { id: 2, subjectId: '', score: '' },
    { id: 3, subjectId: '', score: '' },
    { id: 4, subjectId: '', score: '' },
    { id: 5, subjectId: '', score: '' },
    { id: 6, subjectId: '', score: '' },
  ])
  const requestedYear = examYear.trim() ? Number(examYear) : undefined
  const scalingTable = getScalingTable(curriculum, requestedYear)
  const enteredSubjects = subjects.filter((subject) => subject.subjectId || subject.score.trim())
  const completeSubjects = enteredSubjects.filter((subject) => subject.subjectId && subject.score.trim())
  const result = calculateAtarAutomatic({
    curriculum,
    examYear: requestedYear,
    subjects: completeSubjects.map((subject) => ({ subjectId: subject.subjectId, rawScore: Number(subject.score) })),
  })
  const duplicateSubject = new Set(completeSubjects.map((subject) => subject.subjectId)).size !== completeSubjects.length
  const formError = requestedYear !== undefined && (!Number.isInteger(requestedYear) || requestedYear < 2000 || requestedYear > 2100)
    ? 'Exam year must be between 2000 and 2100.'
    : enteredSubjects.some((subject) => !subject.subjectId || !subject.score.trim())
      ? 'Choose a valid subject and enter its raw score for every completed row.'
      : duplicateSubject
        ? 'Each subject can only be included once.'
        : result.errors[0] ?? null
  const filteredOptions = scalingTable?.subjects.filter((subject) => {
    const query = subjectSearch.trim().toLowerCase()
    return !query || subject.name.toLowerCase().includes(query) || subject.aliases.some((alias) => alias.toLowerCase().includes(query))
  }) ?? []
  const optionsFor = (selectedId: string) => {
    const selected = scalingTable?.subjects.find((subject) => subject.id === selectedId)
    return selected && !filteredOptions.some((subject) => subject.id === selected.id) ? [selected, ...filteredOptions] : filteredOptions
  }
  const updateSubject = (id: number, field: 'subjectId' | 'score', value: string) => setSubjects((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item))

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Plus tool</p>
      <h2 className="mt-1 text-xl font-semibold">ATAR Calculator</h2>
      <p className="mt-2 text-sm text-slate-500">Choose your curriculum and subjects. AirGPT applies the stored scaling estimate automatically.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="text-[10px] uppercase tracking-wider text-slate-500">State / curriculum
          <select value={curriculum} onChange={(event) => setCurriculum(event.target.value as AtarCurriculum)} className="calculator-input mt-1 w-full">
            {SUPPORTED_ATAR_CURRICULA.map((item) => <option key={item.code} value={item.code} disabled={!item.supported} className="bg-slate-900">{item.label}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-slate-500">Exam year (optional)
          <input type="number" min="2000" max="2100" value={examYear} onChange={(event) => setExamYear(event.target.value)} placeholder="2025" className="calculator-input mt-1 w-full" />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-slate-500">Search subjects
          <input type="search" value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} placeholder="e.g. Methods" className="calculator-input mt-1 w-full" />
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {subjects.map((subject, index) => (
          <div key={subject.id} className="grid gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3 sm:grid-cols-[1.7fr_1fr]">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">{`Subject ${index + 1}${index === 5 ? ' (optional)' : ''}`}
              <select aria-label={`Subject ${index + 1}`} value={subject.subjectId} onChange={(event) => updateSubject(subject.id, 'subjectId', event.target.value)} className="calculator-input mt-1 w-full">
                <option value="" className="bg-slate-900">Select a valid subject</option>
                {optionsFor(subject.subjectId).map((option) => <option key={option.id} value={option.id} className="bg-slate-900">{option.name}</option>)}
              </select>
            </label>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Raw study score
              <input type="number" min="0" max="50" value={subject.score} onChange={(event) => updateSubject(subject.id, 'score', event.target.value)} placeholder="0-50" className="calculator-input mt-1 w-full" />
            </label>
          </div>
        ))}
      </div>

      {formError && <p role="alert" className="mt-4 rounded-xl border border-rose-300/15 bg-rose-400/[0.06] p-3 text-xs text-rose-200">{formError}</p>}
      {result.warnings.map((warning) => <p key={warning} className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.055] p-3 text-xs text-amber-100">{warning}</p>)}

      <div className="mt-5 grid gap-3 sm:grid-cols-2"><ResultCard label="Estimated aggregate" value={formError ? '--' : result.aggregate.toFixed(1)} /><ResultCard label="Estimated ATAR range" value={formError ? '--' : `${result.lower.toFixed(2)}-${result.upper.toFixed(2)}`} detail={result.scalingYear ? `Using ${result.scalingYear} scaling data` : undefined} /></div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/8">
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead className="bg-white/[0.045] text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Raw score</th><th className="px-4 py-3">Scaled score</th><th className="px-4 py-3">Scaling adjustment</th></tr></thead>
          <tbody className="divide-y divide-white/5">{result.breakdown.length === 0 ? <tr><td colSpan={4} className="px-4 py-5 text-center text-slate-500">Choose subjects and valid scores to see the automatic scaling breakdown.</td></tr> : result.breakdown.map((subject, index) => <tr key={`${subject.subjectId}-${index}`}><td className="px-4 py-3 font-medium text-slate-200">{subject.subject}</td><td className="px-4 py-3 text-slate-400">{subject.rawScore.toFixed(1)}</td><td className="px-4 py-3 font-semibold text-white">{subject.scaledScore.toFixed(1)}</td><td className={cn('px-4 py-3 font-medium', subject.adjustment >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{subject.adjustment >= 0 ? '+' : ''}{subject.adjustment.toFixed(1)}</td></tr>)}</tbody>
        </table>
      </div>

      <button type="button" disabled={Boolean(formError)} onClick={() => onSave('ATAR Calculator', `Estimated ${result.lower.toFixed(2)}-${result.upper.toFixed(2)} · aggregate ${result.aggregate.toFixed(1)}`)} className="secondary-action mt-4"><Save className="size-4" />Save estimate</button>
      <p className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] p-4 text-xs leading-relaxed text-amber-100">ATAR results are estimates. Official scaling changes each year. This tool does not replace official VTAC scaling or ATAR calculations.</p>
    </section>
  )
}
// Chart lines are the one place that stays multi-tone — flattening 4
// simultaneous functions to pure white/grey would make them unreadable.
const graphColors = ['#ffffff', '#a1a1aa', '#71717a', '#38bdf8']

function GraphingCalculator() {
  const [functions, setFunctions] = useState([''])
  const [xMin, setXMin] = useState(-10)
  const [xMax, setXMax] = useState(10)
  const [yMin, setYMin] = useState(-10)
  const [yMax, setYMax] = useState(10)
  const graph = useMemo(() => {
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) return { paths: [], errors: ['X maximum must be greater than X minimum.'] }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMax <= yMin) return { paths: [], errors: ['Y maximum must be greater than Y minimum.'] }
    const errors: string[] = []
    const paths = functions.map((expression, functionIndex) => {
      try {
        const evaluate = compileExpression(expression)
        const segments: string[] = []
        let drawing = false
        for (let pixel = 0; pixel <= 640; pixel += 2) {
          const x = xMin + (pixel / 640) * (xMax - xMin)
          const y = evaluate(x)
          const screenY = 320 - ((y - yMin) / (yMax - yMin)) * 320
          const valid = Number.isFinite(screenY) && screenY > -500 && screenY < 820
          if (valid) {
            segments.push((drawing ? 'L' : 'M') + pixel.toFixed(1) + ' ' + screenY.toFixed(1))
            drawing = true
          } else drawing = false
        }
        return { path: segments.join(' '), color: graphColors[functionIndex % graphColors.length] }
      } catch (error) {
        errors.push('Function ' + (functionIndex + 1) + ': ' + (error instanceof Error ? error.message : 'Invalid expression'))
        return { path: '', color: graphColors[functionIndex % graphColors.length] }
      }
    })
    return { paths, errors }
  }, [functions, xMax, xMin, yMax, yMin])

  const zoom = (factor: number) => {
    const xMiddle = (xMin + xMax) / 2; const xHalf = (xMax - xMin) * factor / 2
    const yMiddle = (yMin + yMax) / 2; const yHalf = (yMax - yMin) * factor / 2
    setXMin(Number((xMiddle - xHalf).toFixed(2))); setXMax(Number((xMiddle + xHalf).toFixed(2)))
    setYMin(Number((yMiddle - yHalf).toFixed(2))); setYMax(Number((yMiddle + yHalf).toFixed(2)))
  }
  const resetGraph = () => { setFunctions(['']); setXMin(-10); setXMax(10); setYMin(-10); setYMax(10) }

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Premium tool</p><h2 className="mt-1 text-xl font-semibold">Graphing Calculator</h2></div><button type="button" onClick={() => setFunctions((items) => [...items, 'sin(x)'])} className="primary-action"><Plus className="size-4" />Add function</button></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          {functions.map((expression, index) => <div key={index} className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-2"><span className="size-3 rounded-full" style={{ backgroundColor: graphColors[index % graphColors.length] }} /><span className="text-xs text-slate-500">y =</span><input aria-label={'Function ' + (index + 1)} value={expression} onChange={(event) => setFunctions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><button type="button" onClick={() => setFunctions((items) => items.length > 1 ? items.filter((_, itemIndex) => itemIndex !== index) : items)} disabled={functions.length === 1} aria-label={'Remove function ' + (index + 1)} className="interactive-icon size-8"><Trash2 className="size-3.5" /></button></div>)}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">X minimum<input type="number" value={xMin} onChange={(event) => setXMin(Number(event.target.value))} className="calculator-input mt-1 w-full" /></label><label className="text-[10px] uppercase tracking-wider text-slate-500">X maximum<input type="number" value={xMax} onChange={(event) => setXMax(Number(event.target.value))} className="calculator-input mt-1 w-full" /></label>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Y minimum<input type="number" value={yMin} onChange={(event) => setYMin(Number(event.target.value))} className="calculator-input mt-1 w-full" /></label><label className="text-[10px] uppercase tracking-wider text-slate-500">Y maximum<input type="number" value={yMax} onChange={(event) => setYMax(Number(event.target.value))} className="calculator-input mt-1 w-full" /></label>
          </div>
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => zoom(0.7)} aria-label="Zoom in" className="secondary-action"><ZoomIn className="size-4" />Zoom in</button><button type="button" onClick={() => zoom(1.4)} aria-label="Zoom out" className="secondary-action"><ZoomOut className="size-4" />Zoom out</button><button type="button" onClick={resetGraph} className="secondary-action"><RotateCcw className="size-4" />Reset</button><button type="button" onClick={() => setFunctions([''])} className="secondary-action"><Trash2 className="size-4" />Clear</button></div>
          {graph.errors.map((error) => <p key={error} className="rounded-xl border border-rose-300/15 bg-rose-400/[0.06] p-2 text-xs text-rose-200">{error}</p>)}
          <p className="text-[10px] leading-relaxed text-slate-600">Supported: +, −, ×, ÷, powers, parentheses, sin, cos, tan, sqrt, abs, log, ln, exp, π and e.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
          <svg viewBox="0 0 640 320" className="min-h-72 w-full" role="img" aria-label="Function graph">
            <defs><pattern id="airnexus-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,.12)" strokeWidth="1" /></pattern></defs>
            <rect width="640" height="320" fill="url(#airnexus-grid)" /><line x1="0" y1={yMin <= 0 && yMax >= 0 ? 320 - ((0 - yMin) / (yMax - yMin)) * 320 : -10} x2="640" y2={yMin <= 0 && yMax >= 0 ? 320 - ((0 - yMin) / (yMax - yMin)) * 320 : -10} stroke="rgba(226,232,240,.35)" /><line x1={xMin <= 0 && xMax >= 0 ? ((0 - xMin) / (xMax - xMin)) * 640 : -10} y1="0" x2={xMin <= 0 && xMax >= 0 ? ((0 - xMin) / (xMax - xMin)) * 640 : -10} y2="320" stroke="rgba(226,232,240,.35)" />
            {graph.paths.map((item, index) => <path key={index} d={item.path} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
          </svg>
        </div>
      </div>
    </section>
  )
}

function ResultCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-2xl border border-white/12 bg-white/[0.045] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p>{detail && <p className="mt-1 text-[10px] text-slate-500">{detail}</p>}</div>
}

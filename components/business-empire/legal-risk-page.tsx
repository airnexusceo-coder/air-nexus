'use client'

import { AlertTriangle, Gavel, Scale, ShieldAlert } from 'lucide-react'
import { formatCurrency } from '@/lib/business-empire/format'
import { previewLegalCaseActionCost, previewQuestionableOfferBenefit } from '@/lib/business-empire/game-state'
import { INVESTIGATION_STAGE_ORDER, type GameState, type LegalCaseAction, type OfferResponse } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type LegalRiskPageProps = {
  state: GameState
  onRespondToOffer: (offerId: string, response: OfferResponse) => { error?: string }
  onTakeCaseAction: (caseId: string, action: LegalCaseAction) => { error?: string }
}

const RISK_FIELD_LABELS: { key: keyof GameState['legalRisk']; label: string; description: string }[] = [
  { key: 'suspicion', label: 'Suspicion', description: 'How much outside attention the company\'s conduct has attracted.' },
  { key: 'availableEvidence', label: 'Available evidence', description: 'How much real, usable evidence exists if anyone looked.' },
  { key: 'civilLiability', label: 'Civil liability', description: 'Exposure to being sued or held financially responsible.' },
  { key: 'criminalExposure', label: 'Criminal exposure', description: 'How serious the underlying conduct would be if prosecuted.' },
  { key: 'publicAwareness', label: 'Public awareness', description: 'How much the public or media already knows.' },
  { key: 'employeeKnowledge', label: 'Employee knowledge', description: 'How many staff know something that could become a report.' },
]

const STAGE_LABELS: Record<string, string> = {
  'complaint-or-rumour': 'Complaint or rumour',
  'preliminary-investigation': 'Preliminary investigation',
  'evidence-collection': 'Evidence collection',
  'formal-claim-or-charges': 'Formal claim or charges',
  'court-proceedings': 'Court proceedings',
  judgment: 'Judgment',
  'penalty-or-acquittal': 'Penalty or acquittal',
}

const RESPONSE_OPTIONS: { value: OfferResponse; label: string; tone: 'accept' | 'lawful' }[] = [
  { value: 'reject', label: 'Reject', tone: 'lawful' },
  { value: 'investigate', label: 'Investigate first', tone: 'lawful' },
  { value: 'consult-lawyers', label: 'Consult lawyers', tone: 'lawful' },
  { value: 'report', label: 'Report it', tone: 'lawful' },
  { value: 'negotiate-lawful-alternative', label: 'Negotiate a lawful alternative', tone: 'lawful' },
  { value: 'accept', label: 'Accept', tone: 'accept' },
]

const CASE_ACTION_OPTIONS: { value: LegalCaseAction; label: string }[] = [
  { value: 'cooperate', label: 'Cooperate fully' },
  { value: 'hire-legal-representation', label: 'Hire legal representation' },
  { value: 'internal-investigation', label: 'Run an internal investigation' },
  { value: 'replace-executives', label: 'Replace responsible executives' },
  { value: 'compensate-customers', label: 'Compensate affected customers' },
  { value: 'contest-allegations', label: 'Contest the allegations' },
  { value: 'settle-civil-claims', label: 'Settle civil claims' },
  { value: 'improve-compliance', label: 'Improve compliance' },
]

function riskTone(value: number) {
  return value >= 60 ? 'text-rose-300' : value >= 30 ? 'text-amber-300' : 'text-emerald-300'
}

export function LegalRiskPage({ state, onRespondToOffer, onTakeCaseAction }: LegalRiskPageProps) {
  const pendingOffer = state.questionableOffers.find((offer) => offer.response === null)
  const resolvedOffers = [...state.questionableOffers].filter((offer) => offer.response !== null).reverse()
  const activeCases = state.legalCases.filter((legalCase) => legalCase.outcome === null)
  const resolvedCases = [...state.legalCases].filter((legalCase) => legalCase.outcome !== null).reverse()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Scale className="size-5 text-amber-300" />Legal &amp; Compliance Risk</h1>
        <p className="mt-1 text-sm text-slate-400">Every offer and every case shows its own reasoning. Lawful responses are always available and are never the disadvantaged choice once real risk is accounted for.</p>
      </div>

      {state.gameOverReason && (
        <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/[0.08] p-4 text-sm leading-6 text-rose-100">
          <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" />Company story ended</p>
          <p className="mt-1">{state.gameOverReason}</p>
        </div>
      )}

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Legal risk profile</h2>
        <p className="mt-1 text-xs text-slate-500">Every number here moved because of a specific past decision — never a background dice roll.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {RISK_FIELD_LABELS.map(({ key, label, description }) => {
            const value = state.legalRisk[key]
            return (
              <div key={key}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-300" title={description}>{label}</span>
                  <span className={cn('font-semibold', riskTone(value))}>{value}/100</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className={cn('h-full rounded-full', value >= 60 ? 'bg-rose-400' : value >= 30 ? 'bg-amber-400' : 'bg-emerald-400')} style={{ width: `${value}%` }} /></div>
              </div>
            )
          })}
        </div>
        {state.legalRisk.previousViolations > 0 && (
          <p className="mt-3 text-xs text-rose-300">{state.legalRisk.previousViolations} previous violation{state.legalRisk.previousViolations === 1 ? '' : 's'} on record.</p>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><AlertTriangle className="size-4 text-amber-300" />Questionable offer</h2>
        {!pendingOffer ? (
          <p className="mt-3 text-sm text-slate-500">No questionable offer is currently pending.</p>
        ) : (
          <div className="mt-3 glass rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{pendingOffer.title}</p>
              <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase',
                pendingOffer.riskLevel === 'severe' ? 'bg-rose-400/15 text-rose-200' : pendingOffer.riskLevel === 'high' ? 'bg-rose-400/10 text-rose-300' : pendingOffer.riskLevel === 'medium' ? 'bg-amber-400/10 text-amber-300' : 'bg-white/8 text-slate-300')}>
                {pendingOffer.riskLevel} risk
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{pendingOffer.description}</p>
            <p className="mt-2 text-xs leading-5 text-emerald-300">If accepted: {pendingOffer.immediateBenefit} (worth roughly {formatCurrency(previewQuestionableOfferBenefit(state, pendingOffer.id))})</p>
            <p className="mt-1 text-xs leading-5 text-sky-200">{pendingOffer.adviserRecommendation}</p>
            {pendingOffer.possibleDelayedConsequences.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-5 text-slate-500">
                {pendingOffer.possibleDelayedConsequences.map((consequence, index) => <li key={index}>{consequence}</li>)}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {RESPONSE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onRespondToOffer(pendingOffer.id, option.value)}
                  className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', option.tone === 'accept' ? 'border border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15' : 'secondary-action')}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Gavel className="size-4 text-amber-300" />Active legal cases</h2>
        {activeCases.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No legal case is currently active.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {activeCases.map((legalCase) => {
              const stageIndex = INVESTIGATION_STAGE_ORDER.indexOf(legalCase.stage)
              return (
                <div key={legalCase.id} className="glass rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{legalCase.title}</p>
                    <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase text-slate-300">{legalCase.severity}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{legalCase.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {INVESTIGATION_STAGE_ORDER.map((stage, index) => (
                      <span key={stage} className={cn('rounded-full px-2 py-0.5 text-[10px]', index <= stageIndex ? 'bg-amber-400/15 text-amber-200' : 'bg-white/6 text-slate-500')}>
                        {STAGE_LABELS[stage]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Since {legalCase.startedYear} · currently in year {legalCase.stageEnteredYear}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CASE_ACTION_OPTIONS.map((option) => {
                      const taken = legalCase.actionsTaken.includes(option.value)
                      const cost = previewLegalCaseActionCost(state, option.value)
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={taken}
                          onClick={() => onTakeCaseAction(legalCase.id, option.value)}
                          className="secondary-action text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {taken ? `${option.label} ✓` : cost > 0 ? `${option.label} (${formatCurrency(cost)})` : option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {resolvedCases.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white">Resolved cases</h2>
          <div className="mt-3 space-y-1.5">
            {resolvedCases.map((legalCase) => (
              <div key={legalCase.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
                <span>{legalCase.title}</span>
                <span className="capitalize">{legalCase.outcome?.replace(/-/g, ' ')} · {legalCase.resolvedYear}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {resolvedOffers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white">Past offers</h2>
          <div className="mt-3 space-y-1.5">
            {resolvedOffers.map((offer) => (
              <div key={offer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
                <span>{offer.title}</span>
                <span className="capitalize">{offer.response?.replace(/-/g, ' ')} · {offer.resolvedYear}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

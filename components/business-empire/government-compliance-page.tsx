'use client'

import { Landmark, Scale, ShieldCheck } from 'lucide-react'
import { COMPLIANCE_CATEGORY_INFO, COMPLIANCE_CATEGORY_ORDER, COMPLIANCE_STAFF_INFO, COMPLIANCE_STAFF_ROLE_ORDER } from '@/lib/business-empire/government'
import { previewComplianceStaffSalary } from '@/lib/business-empire/game-state'
import { REGION_PROFILES } from '@/lib/business-empire/land'
import { formatCurrency } from '@/lib/business-empire/format'
import type { ComplianceStaffRole, GameState } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type GovernmentCompliancePageProps = {
  state: GameState
  onHireStaff: (role: ComplianceStaffRole) => { error?: string }
  onReleaseStaff: (role: ComplianceStaffRole) => { error?: string }
}

function ratingTone(rating: number) {
  return rating >= 70 ? 'text-emerald-300' : rating >= 40 ? 'text-amber-300' : 'text-rose-300'
}

export function GovernmentCompliancePage({ state, onHireStaff, onReleaseStaff }: GovernmentCompliancePageProps) {
  const proposedLaws = state.laws.filter((law) => law.status === 'proposed').sort((a, b) => a.expectedStartYear - b.expectedStartYear)
  const activeLaws = state.laws.filter((law) => law.status === 'active')
  const decidedLaws = state.laws.filter((law) => law.status === 'rejected' || law.status === 'repealed').sort((a, b) => (b.decidedYear ?? 0) - (a.decidedYear ?? 0))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Landmark className="size-5 text-amber-300" />Government &amp; Compliance</h1>
        <p className="mt-1 text-sm text-slate-400">Every proposed law arrives with at least two years of advance warning, an estimated cost, a possible penalty, and an honest passage probability — never a surprise regulation.</p>
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="size-4 text-amber-300" />Compliance rating by front</h2>
        {state.unresolvedViolations > 0 && <p className="mt-1 text-xs text-rose-300">{state.unresolvedViolations} unresolved violation{state.unresolvedViolations === 1 ? '' : 's'} on record.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {COMPLIANCE_CATEGORY_ORDER.map((category) => {
            const rating = state.complianceRatings[category]
            return (
              <div key={category}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-300" title={COMPLIANCE_CATEGORY_INFO[category].description}>{COMPLIANCE_CATEGORY_INFO[category].label}</span>
                  <span className={cn('font-semibold', ratingTone(rating))}>{rating}/100</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className={cn('h-full rounded-full', rating >= 70 ? 'bg-emerald-400' : rating >= 40 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${rating}%` }} /></div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Compliance staff</h2>
        <p className="mt-1 text-xs text-slate-500">A low compliance budget saves money now but raises inspection, fine, and violation risk later. Staffing builds readiness over several years, it doesn&apos;t switch on instantly.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {COMPLIANCE_STAFF_ROLE_ORDER.map((role) => {
            const info = COMPLIANCE_STAFF_INFO[role]
            const count = state.complianceStaff[role]
            const salary = previewComplianceStaffSalary(state, role)
            return (
              <div key={role} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">{info.label}</p>
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-slate-300">{count} hired</span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{info.description}</p>
                <p className="mt-1 text-[11px] text-slate-500">{formatCurrency(salary)}/yr each · covers {info.coverage.map((c) => COMPLIANCE_CATEGORY_INFO[c].label).join(', ')}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => onHireStaff(role)} className="secondary-action text-xs">Hire</button>
                  <button type="button" onClick={() => onReleaseStaff(role)} disabled={count === 0} className="secondary-action text-xs disabled:cursor-not-allowed disabled:opacity-40">Let go</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Scale className="size-4 text-amber-300" />Proposed laws — advance warning</h2>
        {proposedLaws.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No laws are currently proposed.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {proposedLaws.map((law) => (
              <div key={law.id} className="glass rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{law.name}</p>
                  <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">Decided {law.expectedStartYear}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{law.description}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  <span className="rounded-full bg-white/6 px-2 py-0.5">{law.region === 'national' ? 'National' : REGION_PROFILES[law.region].name}</span>
                  <span className="rounded-full bg-white/6 px-2 py-0.5">Passage odds {Math.round(law.passageProbability * 100)}%</span>
                  <span className="rounded-full bg-white/6 px-2 py-0.5">Est. compliance cost {formatCurrency(law.estimatedComplianceCost)}</span>
                  <span className="rounded-full bg-white/6 px-2 py-0.5">Possible penalty {formatCurrency(law.possiblePenalty)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white">Active laws</h2>
        {activeLaws.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No laws are currently active.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {activeLaws.map((law) => (
              <div key={law.id} className="glass rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{law.name}</p>
                  <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">Active since {law.decidedYear}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{law.description}</p>
                <p className="mt-2 text-[11px] text-slate-500">{law.region === 'national' ? 'National' : REGION_PROFILES[law.region].name} · Possible fine if breached: {formatCurrency(law.possiblePenalty)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {decidedLaws.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white">Rejected or repealed</h2>
          <div className="mt-3 space-y-1.5">
            {decidedLaws.map((law) => (
              <div key={law.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
                <span>{law.name}</span>
                <span>{law.status === 'rejected' ? 'Rejected' : 'Repealed'} · {law.decidedYear}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

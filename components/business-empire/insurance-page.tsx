'use client'

import { ShieldCheck } from 'lucide-react'
import { INSURANCE_POLICY_INFO, INSURANCE_POLICY_TYPE_ORDER } from '@/lib/business-empire/insurance'
import { formatCurrency } from '@/lib/business-empire/format'
import type { GameState, InsurancePolicyType } from '@/lib/business-empire/types'

type InsurancePageProps = {
  state: GameState
  onPreviewTerms: (type: InsurancePolicyType) => { premiumPerYear: number; deductible: number; coverageLimit: number }
  onPurchase: (type: InsurancePolicyType) => { error?: string }
  onCancel: (policyId: string) => { error?: string }
}

export function InsurancePage({ state, onPreviewTerms, onPurchase, onCancel }: InsurancePageProps) {
  const activePolicies = state.insurancePolicies.filter((policy) => policy.active)
  const activeTypes = new Set(activePolicies.map((policy) => policy.type))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><ShieldCheck className="size-5 text-amber-300" />Insurance</h1>
        <p className="mt-1 text-sm text-slate-400">Insurance reduces the financial damage of a covered event down to the deductible — it never covers, or excuses, the player&apos;s own intentional misconduct.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-white">Active policies</h2>
        {activePolicies.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active insurance policies.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {activePolicies.map((policy) => (
              <div key={policy.id} className="glass rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{INSURANCE_POLICY_INFO[policy.type].label}</p>
                  <button type="button" onClick={() => onCancel(policy.id)} className="secondary-action text-xs">Cancel policy</button>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{INSURANCE_POLICY_INFO[policy.type].description}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <div className="rounded-lg bg-white/[0.03] px-2 py-1.5"><dt className="text-[10px] text-slate-500">Premium/yr</dt><dd className="font-semibold text-white">{formatCurrency(policy.premiumPerYear)}</dd></div>
                  <div className="rounded-lg bg-white/[0.03] px-2 py-1.5"><dt className="text-[10px] text-slate-500">Deductible</dt><dd className="font-semibold text-white">{formatCurrency(policy.deductible)}</dd></div>
                  <div className="rounded-lg bg-white/[0.03] px-2 py-1.5"><dt className="text-[10px] text-slate-500">Coverage limit</dt><dd className="font-semibold text-white">{formatCurrency(policy.coverageLimit)}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white">Available policies</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {INSURANCE_POLICY_TYPE_ORDER.filter((type) => !activeTypes.has(type)).map((type) => {
            const terms = onPreviewTerms(type)
            return (
              <div key={type} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                <p className="text-xs font-semibold text-white">{INSURANCE_POLICY_INFO[type].label}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{INSURANCE_POLICY_INFO[type].description}</p>
                <p className="mt-1 text-[11px] text-slate-500">{formatCurrency(terms.premiumPerYear)}/yr · {formatCurrency(terms.deductible)} deductible · up to {formatCurrency(terms.coverageLimit)} coverage</p>
                <button type="button" onClick={() => onPurchase(type)} className="secondary-action mt-2 text-xs">Buy policy</button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

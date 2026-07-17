'use client'

import { CalendarCheck2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { computeOperatingCosts, computeRent, computeWages, sumLedgerCategoryForYear } from '@/lib/business-empire/simulation'
import { getIndustryProfile } from '@/lib/business-empire/industries'
import { formatCurrency } from '@/lib/business-empire/format'
import { DIFFICULTY_PROFILES, type GameState } from '@/lib/business-empire/types'

type CompleteYearModalProps = {
  state: GameState
  onConfirm: () => void
  onCancel: () => void
}

/** The confirmation summary required before simulating a year — nothing here is hidden or committed until the player explicitly confirms. */
export function CompleteYearModal({ state, onConfirm, onCancel }: CompleteYearModalProps) {
  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const active = state.products.filter((p) => !p.discontinued)
  const unitsProduced = active.reduce((sum, p) => sum + p.unitsManufactured, 0)
  const advertisingSpending = sumLedgerCategoryForYear(state, 'ADVERTISING_COST', state.year)
  const researchSpending = sumLedgerCategoryForYear(state, 'RESEARCH_COST', state.year)
  const employeeCosts = computeWages(unitsProduced, active.length, difficulty, state.staffMorale)
  const rent = computeRent(industry, active.length, difficulty)
  const operating = computeOperatingCosts(industry, active, difficulty)
  const loanRepaymentEstimate = state.loans.reduce((sum, loan) => sum + Math.min(loan.remainingBalance, loan.principal / loan.termYears) + loan.remainingBalance * loan.interestRate, 0)

  return (
    <Modal open title="Complete Financial Year" description={`Review Year ${state.year} before it is simulated — nothing below has happened yet.`} onClose={onCancel} className="max-w-xl">
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Products being sold</h3>
          {active.length === 0 ? (
            <p className="mt-1 text-xs text-amber-200">No active products — this year will have no sales.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {active.map((product) => (
                <li key={product.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs">
                  <span className="min-w-0 truncate text-white">{product.name}</span>
                  <span className="shrink-0 text-slate-400">{product.unitsManufactured.toLocaleString()} produced this year · {formatCurrency(product.price)}/unit</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <Row label="Total units produced this year" value={unitsProduced.toLocaleString()} />
          <Row label="Advertising spending (already paid)" value={formatCurrency(advertisingSpending)} />
          <Row label="Research spending (already paid)" value={formatCurrency(researchSpending)} />
          <Row label="Employee costs (about to be paid)" value={formatCurrency(employeeCosts)} />
          <Row label="Rent (about to be paid)" value={formatCurrency(rent)} />
          <Row label="Storage, insurance & maintenance (about to be paid)" value={formatCurrency(operating.total)} />
          {state.loans.length > 0 && <Row label="Loan repayments (about to be paid)" value={formatCurrency(Math.round(loanRepaymentEstimate))} />}
          <Row label="Available cash right now" value={formatCurrency(state.cash)} />
        </section>

        <p className="text-xs leading-5 text-slate-400">
          Completing the year will calculate customer demand, record sales, pay wages/rent/operating costs/loan repayments/tax, update reputation (with a reason for every change), and generate your full Annual Report. This cannot be undone.
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onConfirm} className="primary-action"><CalendarCheck2 className="size-4" />Confirm and complete the year</button>
          <button type="button" onClick={onCancel} className="secondary-action">Go back</button>
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { Landmark } from 'lucide-react'
import { InfoTip } from '@/components/business-empire/info-tip'
import { previewLoanApplication } from '@/lib/business-empire/game-state'
import { formatCurrency, formatPercent } from '@/lib/business-empire/format'
import type { GameState, LoanPurpose } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type FundingPageProps = {
  state: GameState
  onApplyForLoan: (amount: number, purpose: LoanPurpose) => { error?: string; approved: boolean }
}

const PURPOSES: { id: LoanPurpose; label: string }[] = [
  { id: 'working-capital', label: 'Working capital' },
  { id: 'expansion', label: 'Expansion' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'recovery', label: 'Recovery' },
]

export function FundingPage({ state, onApplyForLoan }: FundingPageProps) {
  const [amount, setAmount] = useState(10_000)
  const [purpose, setPurpose] = useState<LoanPurpose>('working-capital')
  const [result, setResult] = useState<{ error?: string; approved: boolean } | null>(null)

  const preview = useMemo(() => previewLoanApplication(state, amount), [state, amount])
  const totalOwed = state.loans.reduce((sum, l) => sum + l.remainingBalance, 0)

  const handleApply = () => {
    const outcome = onApplyForLoan(amount, purpose)
    setResult(outcome)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Landmark className="size-5 text-amber-300" />Funding</h1>
        <p className="mt-1 text-sm text-slate-400">Investor and lender interest is driven by reputation, existing debt, and difficulty. Approval odds are always shown before you apply — never a hidden coin flip.</p>
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Apply for a business loan</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs text-slate-400">Amount</span>
            <input type="number" min={1000} step={500} value={amount} onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))} className="glass-input mt-1 w-36 rounded-lg px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Purpose</span>
            <select value={purpose} onChange={(event) => setPurpose(event.target.value as LoanPurpose)} className="glass-input mt-1 rounded-lg px-3 py-2 text-sm outline-none">
              {PURPOSES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
          <p className="flex items-center gap-1">Approval odds<InfoTip term="Approval odds" definition="The estimated chance this application is approved, given your reputation, existing debt, and difficulty setting." />: <span className="ml-1 font-semibold text-white">{Math.round(preview.odds * 100)}%</span></p>
          <p className="mt-1">Interest rate if approved: <span className="font-semibold text-white">{formatPercent(preview.interestRate * 100)}</span> annually, over a 5-year term</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-slate-400">
            {preview.factors.map((factor, index) => <li key={index}>{factor}</li>)}
          </ul>
        </div>

        <button type="button" onClick={handleApply} className="primary-action mt-4">Apply for loan</button>
        {result?.approved && <p className="mt-2 text-xs text-emerald-300">Loan approved — funds added to cash.</p>}
        {result && !result.approved && result.error && <p role="alert" className="mt-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{result.error}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white">Active loans</h2>
        {state.loans.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active loans.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {state.loans.map((loan) => (
              <div key={loan.id} className="glass rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white capitalize">{loan.purpose.replace('-', ' ')} loan</p>
                  <span className="shrink-0 text-xs text-slate-400">{formatPercent(loan.interestRate * 100)}/yr</span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <div className="rounded-lg bg-white/[0.03] px-2 py-1.5"><dt className="text-[10px] text-slate-500">Remaining</dt><dd className="font-semibold text-white">{formatCurrency(loan.remainingBalance)}</dd></div>
                  <div className="rounded-lg bg-white/[0.03] px-2 py-1.5"><dt className="text-[10px] text-slate-500">Years left</dt><dd className="font-semibold text-white">{loan.yearsRemaining}</dd></div>
                  <div className={cn('rounded-lg bg-white/[0.03] px-2 py-1.5')}><dt className="text-[10px] text-slate-500">Taken year</dt><dd className="font-semibold text-white">{loan.takenYear}</dd></div>
                </dl>
              </div>
            ))}
            <p className="text-xs text-slate-500">Total owed across all loans: <span className="font-semibold text-white">{formatCurrency(totalOwed)}</span></p>
          </div>
        )}
      </section>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { formatCurrency, formatSignedCurrency } from '@/lib/business-empire/format'
import type { CashTransactionCategory, GameState } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type FinancesPageProps = {
  state: GameState
}

const CATEGORY_LABEL: Record<CashTransactionCategory, string> = {
  STARTING_CAPITAL: 'Starting capital',
  RESEARCH_COST: 'Research cost',
  PRODUCTION_COST: 'Production cost',
  ADVERTISING_COST: 'Advertising cost',
  WAGES: 'Wages',
  RENT: 'Rent',
  OPERATING_COSTS: 'Operating costs',
  FACILITY_UPKEEP: 'Facility upkeep',
  FACILITY_PURCHASE: 'Facility purchase',
  FACILITY_SALE: 'Facility sale',
  COMPLIANCE_STAFF_WAGES: 'Compliance staff wages',
  LAW_COMPLIANCE_COST: 'Law compliance cost',
  REGULATORY_FINE: 'Regulatory fine',
  SALES_REVENUE: 'Sales revenue',
  TAX: 'Tax',
  REFUND: 'Refund',
  LOAN: 'Loan',
  LOAN_REPAYMENT: 'Loan repayment',
  INVESTMENT: 'Investment',
  OTHER_EXPENSE: 'Other expense',
}

export function FinancesPage({ state }: FinancesPageProps) {
  const [filter, setFilter] = useState<'all' | CashTransactionCategory>('all')
  const ordered = [...state.cashLedger].reverse()
  const filtered = (filter === 'all' ? ordered : ordered.filter((entry) => entry.category === filter)).slice(0, 200)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><BarChart3 className="size-5 text-amber-300" />Finances</h1>
        <p className="mt-1 text-sm text-slate-400">Every cash change your company has ever made, in order — this is the single record your balance is built from. Displayed cash always matches this ledger exactly.</p>
      </div>

      <div className="glass flex items-center justify-between rounded-2xl p-4">
        <span className="text-sm text-slate-400">Current cash balance</span>
        <span className="text-lg font-bold text-white">{formatCurrency(state.cash)}</span>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
          <h2 className="text-sm font-semibold text-white">Transaction ledger</h2>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filter transactions by category" className="rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-xs text-white outline-none">
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([category, label]) => <option key={category} value={category}>{label}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">No transactions of this type yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-white">{entry.description}</p>
                  <p className="text-xs text-slate-500">Year {entry.year} · {CATEGORY_LABEL[entry.category]} · Balance after: {formatCurrency(entry.balanceAfter)}</p>
                </div>
                <span className={cn('shrink-0 font-semibold', entry.amount >= 0 ? 'text-emerald-300' : 'text-slate-300')}>{formatSignedCurrency(entry.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

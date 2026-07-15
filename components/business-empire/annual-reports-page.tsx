'use client'

import { useState } from 'react'
import { Award, ChevronRight } from 'lucide-react'
import { AnnualReportView } from '@/components/business-empire/annual-report-view'
import { Modal } from '@/components/ui/modal'
import { formatSignedCurrency } from '@/lib/business-empire/format'
import type { GameState } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type AnnualReportsPageProps = {
  state: GameState
}

export function AnnualReportsPage({ state }: AnnualReportsPageProps) {
  const [openYear, setOpenYear] = useState<number | null>(null)
  const reports = [...state.annualReports].reverse()
  const openReport = reports.find((r) => r.year === openYear) ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Award className="size-5 text-amber-300" />Annual Reports</h1>
        <p className="mt-1 text-sm text-slate-400">A complete profit-or-loss report for every financial year your company has completed.</p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-slate-500">No financial years completed yet. Finish your first year from the Dashboard.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <button
              key={report.year}
              type="button"
              onClick={() => setOpenYear(report.year)}
              className="glass flex w-full items-center justify-between rounded-2xl p-4 text-left transition hover:border-white/25"
            >
              <div>
                <p className="text-sm font-semibold text-white">Financial Year {report.year}</p>
                <p className="text-xs text-slate-500">Revenue {report.totalRevenue.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} · {report.unitsSold.toLocaleString()} units sold</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('text-sm font-bold', report.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{formatSignedCurrency(report.netProfit)}</span>
                <ChevronRight className="size-4 text-slate-500" />
              </div>
            </button>
          ))}
        </div>
      )}

      {openReport && (
        <Modal open title={`Financial Year ${openReport.year} Report`} onClose={() => setOpenYear(null)} className="max-w-2xl">
          <AnnualReportView report={openReport} />
        </Modal>
      )}
    </div>
  )
}

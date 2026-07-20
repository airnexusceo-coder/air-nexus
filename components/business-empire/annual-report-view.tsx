'use client'

import { CheckCircle2, Lightbulb, Newspaper, Swords, TriangleAlert } from 'lucide-react'
import { formatCurrency, formatSignedCurrency } from '@/lib/business-empire/format'
import type { AnnualReport } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type AnnualReportViewProps = {
  report: AnnualReport
}

export function AnnualReportView({ report }: AnnualReportViewProps) {
  return (
    <div className="space-y-5">
      <div className={cn('rounded-2xl border p-4', report.netProfit >= 0 ? 'border-emerald-300/25 bg-emerald-400/[0.05]' : 'border-rose-300/25 bg-rose-400/[0.05]')}>
        <p className="text-xs uppercase tracking-wide text-slate-400">Financial Year {report.year} result</p>
        <p className={cn('mt-1 text-2xl font-bold', report.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{formatSignedCurrency(report.netProfit)}</p>
        <p className="mt-1 text-xs text-slate-400">{report.netProfit >= 0 ? 'Net profit' : 'Net loss'} for the year</p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-white">Units</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <Cell label="Produced" value={report.unitsProduced.toLocaleString()} />
          <Cell label="Sold" value={report.unitsSold.toLocaleString()} />
          <Cell label="Unsold" value={report.unsoldInventory.toLocaleString()} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-white">Revenue and expenses</h3>
        <dl className="mt-2 space-y-1.5 text-sm">
          <LedgerRow label="Opening cash balance" value={report.openingCash} signed={false} />
          <LedgerRow label="Total sales revenue" value={report.totalRevenue} positive />
          <LedgerRow label="Production costs" value={-report.productionCosts} />
          <LedgerRow label="Research costs" value={-report.researchCosts} />
          <LedgerRow label="Advertising costs" value={-report.advertisingCosts} />
          <LedgerRow label="Employee wages" value={-report.wages} />
          <LedgerRow label="Rent" value={-report.rent} />
          <LedgerRow label="Storage, insurance & maintenance" value={-report.operatingCosts} />
          {report.loanRepayments > 0 && <LedgerRow label="Loan repayments" value={-report.loanRepayments} />}
          <LedgerRow label="Taxes" value={-report.taxes} />
          <LedgerRow label="Refunds & returns" value={-report.refunds} />
          <div className="my-2 h-px bg-white/10" />
          <LedgerRow label="Total expenses" value={-report.totalExpenses} bold />
          <LedgerRow label="Gross profit" value={report.grossProfit} bold />
          <LedgerRow label="Net profit / loss" value={report.netProfit} bold large />
          <div className="my-2 h-px bg-white/10" />
          <LedgerRow label="Closing cash balance" value={report.closingCash} bold signed={false} />
        </dl>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Cell label="Company value" value={formatCurrency(report.companyValue)} />
        <Cell label="Market share" value={`${report.marketShare.toFixed(1)}%`} />
        <Cell label="Customer satisfaction" value={`${report.customerSatisfaction}/100`} />
        <Cell label="Brand reputation" value={`${report.brandReputation}/100`} />
      </section>

      {report.perProduct.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-white">By product</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[500px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-3 py-2 font-medium">Product</th>
                  <th scope="col" className="px-3 py-2 font-medium">Produced</th>
                  <th scope="col" className="px-3 py-2 font-medium">Sold</th>
                  <th scope="col" className="px-3 py-2 font-medium">Unsold</th>
                  <th scope="col" className="px-3 py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.perProduct.map((row) => (
                  <tr key={row.productId}>
                    <td className="px-3 py-2 font-medium text-white">{row.productName}</td>
                    <td className="px-3 py-2 text-slate-300">{row.unitsProduced.toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-300">{row.unitsSold.toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-300">{row.unsoldAtYearEnd.toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-300">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.factorNotes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-white">Other factors that affected this year</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">
            {report.factorNotes.map((note, index) => <li key={index}>{note}</li>)}
          </ul>
        </section>
      )}

      {report.events.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Newspaper className="size-4 text-amber-300" />What happened this year</h3>
          <div className="mt-2 space-y-2">
            {report.events.map((event) => (
              <div key={event.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-medium text-white">{event.headline}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{event.body}</p>
                <p className="mt-1 text-xs leading-5 text-amber-200/90">{event.impact}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.competitorActions.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Swords className="size-4 text-amber-300" />Competitor activity this year</h3>
          <div className="mt-2 space-y-2">
            {report.competitorActions.map((event) => (
              <div key={event.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white">{event.headline}</p>
                  {event.demandImpactPercent !== 0 && (
                    <span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold', event.demandImpactPercent < 0 ? 'bg-rose-400/10 text-rose-300' : 'bg-emerald-400/10 text-emerald-300')}>
                      {event.demandImpactPercent > 0 ? '+' : ''}{event.demandImpactPercent}% demand
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{event.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="glass rounded-2xl p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Lightbulb className="size-4 text-amber-300" />Learning summary</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{report.learningSummary.whyProfitOrLoss}</p>

        {report.learningSummary.workedWell.length > 0 && (
          <div className="mt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><CheckCircle2 className="size-3.5" />What worked well</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">
              {report.learningSummary.workedWell.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        {report.learningSummary.causedProblems.length > 0 && (
          <div className="mt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300"><TriangleAlert className="size-3.5" />What caused problems</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">
              {report.learningSummary.causedProblems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-3">
          <p className="text-xs font-semibold text-white">Consider next year</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">
            {report.learningSummary.considerNextYear.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  )
}

function LedgerRow({ label, value, positive, bold, large, signed = true }: { label: string; value: number; positive?: boolean; bold?: boolean; large?: boolean; signed?: boolean }) {
  const tone = positive || value >= 0 ? 'text-emerald-300' : 'text-rose-300'
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={cn('text-slate-400', bold && 'font-semibold text-slate-200')}>{label}</dt>
      <dd className={cn(large ? 'text-base' : 'text-sm', bold ? cn('font-bold', signed ? tone : 'text-white') : 'text-slate-300')}>{signed ? formatSignedCurrency(value) : formatCurrency(value)}</dd>
    </div>
  )
}

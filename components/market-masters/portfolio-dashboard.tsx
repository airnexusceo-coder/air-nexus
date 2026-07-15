'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { History, PieChart as PieChartIcon, ShieldCheck } from 'lucide-react'
import { TermTooltip } from '@/components/market-masters/term-tooltip'
import { computeDiversificationScore, computeIndustryAllocation } from '@/lib/market-masters/market-engine'
import { formatCurrency, formatPercent, formatSignedCurrency } from '@/lib/market-masters/format'
import type { CashTransactionType, GameState, RiskLevel, Stock } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

const INDUSTRY_COLORS = ['#34d399', '#38bdf8', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185', '#22d3ee', '#facc15', '#4ade80', '#818cf8']
const RISK_RANK: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 }
const RISK_LABEL: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' }

const TRANSACTION_TYPE_LABEL: Record<CashTransactionType, string> = {
  BUY: 'Bought shares',
  SELL: 'Sold shares',
  DIVIDEND: 'Dividend',
  MISSION_REWARD: 'Mission reward',
  QUIZ_REWARD: 'Quiz reward',
  DAILY_CHALLENGE_REWARD: 'Daily challenge reward',
  RESET: 'Starting balance',
}

type PortfolioDashboardProps = {
  state: GameState
  stocks: Stock[]
}

export function PortfolioDashboard({ state, stocks }: PortfolioDashboardProps) {
  const byTicker = useMemo(() => Object.fromEntries(stocks.map((stock) => [stock.ticker, stock])), [stocks])
  const holdings = Object.values(state.holdings).filter((holding) => holding.shares > 0)
  const diversificationScore = computeDiversificationScore(state, stocks)
  const allocation = computeIndustryAllocation(state, stocks)
  const [historyFilter, setHistoryFilter] = useState<'all' | CashTransactionType>('all')

  const overallRisk: RiskLevel | null = useMemo(() => {
    if (holdings.length === 0) return null
    let weightedSum = 0
    let totalWeight = 0
    for (const holding of holdings) {
      const stock = byTicker[holding.ticker]
      if (!stock) continue
      const value = holding.shares * (state.prices[holding.ticker] ?? 0)
      weightedSum += RISK_RANK[stock.risk] * value
      totalWeight += value
    }
    if (totalWeight === 0) return null
    const average = weightedSum / totalWeight
    return average < 1.67 ? 'low' : average < 2.34 ? 'medium' : 'high'
  }, [holdings, byTicker, state.prices])

  const ledgerHistory = [...state.cashLedger].reverse()
  const filteredHistory = (historyFilter === 'all' ? ledgerHistory : ledgerHistory.filter((entry) => entry.type === historyFilter)).slice(0, 50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Portfolio</h1>
        <p className="mt-1 text-sm text-slate-400">Your positions, how they&apos;re spread across industries, and every cash change that got you here.</p>
      </div>

      <div className="glass flex items-center gap-2 rounded-2xl p-4">
        <ShieldCheck className="size-4 text-slate-400" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Overall risk level</span>
        <TermTooltip term="Risk level" definition="A value-weighted average of the risk level of everything you currently own." />
        <span className="ml-auto text-sm font-semibold text-white">{overallRisk ? RISK_LABEL[overallRisk] : 'No holdings yet'}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Portfolio value over time</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={state.portfolioHistory} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="portfolio-value-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} width={64} domain={['auto', 'auto']} tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15,15,20,0.92)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 12, color: 'white' }}
                  labelFormatter={(day) => `Day ${day}`}
                  formatter={(value) => [formatCurrency(Number(value)), 'Value']}
                />
                <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} fill="url(#portfolio-value-fill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">
            {`Portfolio value chart with ${state.portfolioHistory.length} data points, from ${formatCurrency(state.portfolioHistory[0]?.value ?? 0)} on day 0 to ${formatCurrency(state.portfolioHistory[state.portfolioHistory.length - 1]?.value ?? 0)} on day ${state.day}.`}
          </p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><PieChartIcon className="size-4 text-slate-400" aria-hidden="true" />Industry allocation</h2>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              Diversification: {diversificationScore}/100
              <TermTooltip term="Diversification score" />
            </span>
          </div>
          {allocation.length === 0 ? (
            <p className="mt-6 text-center text-xs text-slate-500">Buy a stock to see your industry mix here.</p>
          ) : (
            <>
              <div className="mt-2 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocation} dataKey="value" nameKey="industry" innerRadius={40} outerRadius={64} paddingAngle={2} isAnimationActive={false}>
                      {allocation.map((entry, index) => (
                        <Cell key={entry.industry} fill={INDUSTRY_COLORS[index % INDUSTRY_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'rgba(15,15,20,0.92)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 12, color: 'white' }}
                      formatter={(value, name) => [formatCurrency(Number(value)), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {allocation.map((entry, index) => (
                  <li key={entry.industry} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="size-2 rounded-full" style={{ backgroundColor: INDUSTRY_COLORS[index % INDUSTRY_COLORS.length] }} aria-hidden="true" />
                      {entry.industry}
                    </span>
                    <span className="text-slate-500">{entry.percent.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 p-4">
          <h2 className="text-sm font-semibold text-white">Holdings</h2>
        </div>
        {holdings.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">You do not own any stocks yet. Visit the Market to make your first trade.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Your current stock holdings, cost basis, current value, and profit or loss.</caption>
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2 font-medium">Company</th>
                  <th scope="col" className="px-4 py-2 font-medium">Shares</th>
                  <th scope="col" className="px-4 py-2 font-medium">Avg. cost</th>
                  <th scope="col" className="px-4 py-2 font-medium">Current price</th>
                  <th scope="col" className="px-4 py-2 font-medium">Market value</th>
                  <th scope="col" className="px-4 py-2 font-medium">P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {holdings.map((holding) => {
                  const stock = byTicker[holding.ticker]
                  const price = state.prices[holding.ticker] ?? 0
                  const marketValue = holding.shares * price
                  const costValue = holding.shares * holding.averageCost
                  const pl = marketValue - costValue
                  const plPercent = costValue > 0 ? (pl / costValue) * 100 : 0
                  return (
                    <tr key={holding.ticker}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-white">{stock?.name ?? holding.ticker}</p>
                        <p className="text-xs text-slate-500">{holding.ticker}</p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">{holding.shares}</td>
                      <td className="px-4 py-2.5 text-slate-300">{formatCurrency(holding.averageCost)}</td>
                      <td className="px-4 py-2.5 text-slate-300">{formatCurrency(price)}</td>
                      <td className="px-4 py-2.5 text-slate-300">{formatCurrency(marketValue)}</td>
                      <td className={cn('px-4 py-2.5 font-medium', pl >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                        {formatSignedCurrency(pl)} ({formatPercent(plPercent)})
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><History className="size-4 text-slate-400" aria-hidden="true" />Cash History</h2>
          <select
            value={historyFilter}
            onChange={(event) => setHistoryFilter(event.target.value as typeof historyFilter)}
            aria-label="Filter cash history by type"
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-xs text-white outline-none"
          >
            <option value="all">All transactions</option>
            {Object.entries(TRANSACTION_TYPE_LABEL).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
          </select>
        </div>
        <p className="px-4 pt-3 text-xs text-slate-500">Every event that has ever changed your cash balance, in order — this is the single record your balance is built from.</p>
        {filteredHistory.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">No transactions of this type yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-white/5">
            {filteredHistory.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-white">{entry.description}</p>
                  <p className="text-xs text-slate-500">Day {entry.day} · {entry.simulatedDate} · {TRANSACTION_TYPE_LABEL[entry.type]} · Balance after: {formatCurrency(entry.balanceAfter)}</p>
                </div>
                <span className={cn('shrink-0 font-semibold', entry.amount >= 0 ? 'text-emerald-300' : 'text-slate-300')}>
                  {formatSignedCurrency(entry.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { AlertTriangle, Factory, GaugeCircle, Globe2, LineChart, Scale, Users } from 'lucide-react'
import { ADVERTISING_CHANNELS } from '@/lib/business-empire/advertising'
import { formatCurrency } from '@/lib/business-empire/format'
import { getIndustryProfile, getIndustryRealityProfile } from '@/lib/business-empire/industries'
import type { GameState } from '@/lib/business-empire/types'

type IndustryMarketPageProps = {
  state: GameState
}

export function IndustryMarketPage({ state }: IndustryMarketPageProps) {
  const industry = useMemo(() => getIndustryProfile(state.industry), [state.industry])
  const reality = useMemo(() => getIndustryRealityProfile(state.industry), [state.industry])
  const bestChannels = [...ADVERTISING_CHANNELS]
    .filter((c) => c.id !== 'none')
    .sort((a, b) => industry.advertisingEffectiveness[b.id] - industry.advertisingEffectiveness[a.id])
    .slice(0, 3)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Globe2 className="size-5 text-amber-300" />Industry Market: {state.industry}</h1>
        <p className="mt-1 text-sm text-slate-400">{industry.tagline}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Average price" value={formatCurrency(industry.averagePrice)} />
        <Stat label="Market size" value={`${industry.marketSize.toLocaleString()} customers/yr`} />
        <Stat label="Growth potential" value={`+${industry.growthPotential}%/yr`} />
        <Stat label="Competition level" value={industry.competitionLevel} capitalize />
      </div>


      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Factory className="size-4 text-amber-300" />Real-world operating model</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <RealityCard icon={GaugeCircle} label="Sales cycle" value={reality.salesCycle} detail="How quickly customers usually decide to buy." capitalize />
          <RealityCard icon={Scale} label="Capital intensity" value={reality.capitalIntensity} detail="How much cash and fixed investment this industry tends to demand." capitalize />
          <RealityCard icon={LineChart} label="Margin logic" value="Unit economics" detail={reality.marginStructure} />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supply chain</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">{reality.supplyChain}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Regulation pressure</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">{reality.regulatoryPressure}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white">What moves demand</h2>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-300">
            {reality.realWorldDrivers.map((driver) => <li key={driver} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">{driver}</li>)}
          </ul>
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white">Strategic levers</h2>
          <div className="mt-3 space-y-2">
            {reality.strategicLevers.map((lever) => (
              <div key={lever.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-xs font-semibold text-white">{lever.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{lever.tradeoff}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white">Industry KPIs</h2>
          <div className="mt-3 space-y-2">
            {reality.kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-xs text-slate-500">{kpi.label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Users className="size-4 text-amber-300" />Customer groups</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {industry.customerGroups.map((group) => (
            <div key={group.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-semibold text-white">{group.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{group.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Advertising that tends to work here</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {bestChannels.map((channel) => (
            <span key={channel.id} className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100">
              {channel.label} ({Math.round(industry.advertisingEffectiveness[channel.id] * 100)}% fit)
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.05] p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-100"><AlertTriangle className="size-4" />Common risks in this industry</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-100/90">
          {industry.commonRisks.map((risk) => <li key={risk}>{risk}</li>)}
        </ul>
        {industry.perishable && <p className="mt-3 text-xs text-amber-100/90">Unsold inventory in this industry can expire before it sells — keep production close to realistic demand.</p>}
      </section>
    </div>
  )
}

function Stat({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-lg font-bold text-white ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  )
}


function RealityCard({ icon: Icon, label, value, detail, capitalize }: { icon: typeof GaugeCircle; label: string; value: string; detail: string; capitalize?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-amber-300/80" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className={'mt-2 text-sm font-semibold text-white ' + (capitalize ? 'capitalize' : '')}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Factory } from 'lucide-react'
import { estimateCostPerUnit, suggestStarterUnits } from '@/lib/business-empire/game-state'
import { formatCurrency } from '@/lib/business-empire/format'
import type { GameState } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type ProductionPageProps = {
  state: GameState
  onManufacture: (productId: string, additionalUnits: number) => { error?: string }
}

export function ProductionPage({ state, onManufacture }: ProductionPageProps) {
  const active = state.products.filter((p) => !p.discontinued)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Factory className="size-5 text-amber-300" />Production</h1>
        <p className="mt-1 text-sm text-slate-400">Manufacturing costs cash immediately. See the exact cost per unit before you confirm.</p>
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-slate-500">Create a product first to plan production.</p>
      ) : (
        active.map((product) => <ProductionCard key={product.id} state={state} productId={product.id} onManufacture={onManufacture} />)
      )}
    </div>
  )
}

function ProductionCard({ state, productId, onManufacture }: { state: GameState; productId: string; onManufacture: ProductionPageProps['onManufacture'] }) {
  const product = state.products.find((p) => p.id === productId)!
  const [additionalUnits, setAdditionalUnits] = useState(() => Math.max(1, suggestStarterUnits(state, product)))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const projectedCostPerUnit = estimateCostPerUnit(state, product, product.unitsManufactured + additionalUnits)
  const totalCost = projectedCostPerUnit * additionalUnits
  const overBudget = totalCost > state.cash

  const handleManufacture = () => {
    const result = onManufacture(productId, additionalUnits)
    if (result.error) {
      setError(result.error)
      setSuccess(false)
      return
    }
    setError(null)
    setSuccess(true)
    window.setTimeout(() => setSuccess(false), 2000)
  }

  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm font-semibold text-white">{product.name}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
        <Stat label="Manufactured this year" value={product.unitsManufactured.toLocaleString()} />
        <Stat label="Unsold inventory" value={product.inventory.toLocaleString()} />
        <Stat label="Current cost/unit" value={formatCurrency(product.costPerUnit)} />
        <Stat label="Available cash" value={formatCurrency(state.cash)} />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-slate-400">Manufacture additional units</span>
          <input type="number" min={1} step={50} value={additionalUnits} onChange={(event) => setAdditionalUnits(Math.max(1, Number(event.target.value) || 0))} className="glass-input mt-1 w-36 rounded-lg px-3 py-2 text-sm outline-none" />
        </label>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
          <p>Estimated cost per unit: <span className="font-semibold text-white">{formatCurrency(projectedCostPerUnit)}</span></p>
          <p>Total cost: <span className={cn('font-semibold', overBudget ? 'text-rose-300' : 'text-white')}>{formatCurrency(totalCost)}</span></p>
        </div>
        <button type="button" onClick={handleManufacture} className="primary-action">Manufacture</button>
        {success && <span className="text-xs text-emerald-300">Manufactured.</span>}
      </div>
      {overBudget && !error && <p className="mt-2 text-xs text-rose-300">This exceeds your available cash ({formatCurrency(state.cash)}). Lower the quantity or raise funds first.</p>}
      {error && <p role="alert" className="mt-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  )
}

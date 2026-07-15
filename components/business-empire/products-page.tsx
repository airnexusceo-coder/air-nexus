'use client'

import { useMemo, useState } from 'react'
import { Ban, ChevronDown, ChevronUp, Layers, Plus, Tag } from 'lucide-react'
import { InfoTip } from '@/components/business-empire/info-tip'
import { estimateCostPerUnit, suggestStarterUnits, type ProductCreationInput } from '@/lib/business-empire/game-state'
import { getIndustryProfile } from '@/lib/business-empire/industries'
import { formatCurrency } from '@/lib/business-empire/format'
import { PRODUCT_FEATURE_OPTIONS } from '@/lib/business-empire/research'
import type { GameState, PackagingQuality, ProductQuality, ProductionMethod, UnsoldInventoryAction } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

const QUALITY_OPTIONS: { id: ProductQuality; label: string; description: string }[] = [
  { id: 'budget', label: 'Budget', description: 'Lowest cost, lowest quality score.' },
  { id: 'standard', label: 'Standard', description: 'Balanced cost and quality.' },
  { id: 'premium', label: 'Premium', description: 'Higher cost, stronger appeal.' },
  { id: 'luxury', label: 'Luxury', description: 'Highest cost, top-tier appeal.' },
]

const PRODUCTION_METHOD_OPTIONS: { id: ProductionMethod; label: string; description: string }[] = [
  { id: 'manual', label: 'Manual', description: 'Small-batch, more expensive, best consistency.' },
  { id: 'standard-factory', label: 'Standard Factory', description: 'Balanced cost and reliability.' },
  { id: 'automated', label: 'Automated', description: 'Cheaper at scale, slightly less "crafted" feel.' },
  { id: 'outsourced', label: 'Outsourced', description: 'Cheapest, but quality can be less consistent.' },
]

const PACKAGING_OPTIONS: { id: PackagingQuality; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'standard', label: 'Standard' },
  { id: 'premium', label: 'Premium' },
]

type ProductsPageProps = {
  state: GameState
  onCreate: (input: ProductCreationInput) => { error?: string }
  onDiscontinue: (productId: string) => void
  onInventoryAction: (productId: string, action: UnsoldInventoryAction) => { error?: string }
}

export function ProductsPage({ state, onCreate, onDiscontinue, onInventoryAction }: ProductsPageProps) {
  const industry = useMemo(() => getIndustryProfile(state.industry), [state.industry])
  const [formOpen, setFormOpen] = useState(state.products.length === 0)
  const active = state.products.filter((p) => !p.discontinued)
  const discontinued = state.products.filter((p) => p.discontinued)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Layers className="size-5 text-amber-300" />Products</h1>
          <p className="mt-1 text-sm text-slate-400">Create and manage everything your company sells.</p>
        </div>
        <button type="button" onClick={() => setFormOpen((v) => !v)} className="secondary-action shrink-0">
          <Plus className="size-4" />
          {formOpen ? 'Hide form' : 'New product'}
        </button>
      </div>

      {formOpen && <ProductCreationForm state={state} onCreate={onCreate} onCreated={() => setFormOpen(false)} />}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Active products ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500">No active products yet — create one above.</p>
        ) : (
          active.map((product) => {
            const group = industry.customerGroups.find((g) => g.id === product.targetGroupId)
            return (
              <div key={product.id} className="glass rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{product.quality} quality · {group?.label ?? 'General audience'} · {formatCurrency(product.price)}/unit</p>
                  </div>
                  <button type="button" onClick={() => onDiscontinue(product.id)} className="flex items-center gap-1 rounded-full border border-rose-300/25 bg-rose-400/10 px-2.5 py-1 text-[10px] font-semibold text-rose-200 hover:bg-rose-400/16">
                    <Ban className="size-3" />Discontinue
                  </button>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
                  <Stat label="Cost/unit" value={formatCurrency(product.costPerUnit)} />
                  <Stat label="Manufactured this year" value={product.unitsManufactured.toLocaleString()} />
                  <Stat label="Unsold inventory" value={product.inventory.toLocaleString()} />
                  <Stat label="Satisfaction" value={`${product.satisfaction}/100`} />
                </dl>
                {product.inventory > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/[0.05] p-3">
                    <Tag className="size-3.5 text-amber-300" aria-hidden="true" />
                    <span className="text-xs text-amber-100">{product.inventory.toLocaleString()} unsold — decide what to do:</span>
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      <InventoryButton label="Keep" onClick={() => onInventoryAction(product.id, 'keep')} />
                      <InventoryButton label="Discount 50%" onClick={() => onInventoryAction(product.id, 'discount')} />
                      <InventoryButton label="Dispose" onClick={() => onInventoryAction(product.id, 'dispose')} />
                      <InventoryButton label="Relaunch" onClick={() => onInventoryAction(product.id, 'relaunch')} />
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </section>

      {discontinued.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-400">Discontinued ({discontinued.length})</h2>
          {discontinued.map((product) => (
            <div key={product.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-500">{product.name} — lifetime sales: {product.lifetimeUnitsSold.toLocaleString()} units, {formatCurrency(product.lifetimeRevenue)} revenue</div>
          ))}
        </section>
      )}
    </div>
  )
}

function InventoryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200 hover:bg-white/10">
      {label}
    </button>
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

function ProductCreationForm({ state, onCreate, onCreated }: { state: GameState; onCreate: ProductsPageProps['onCreate']; onCreated: () => void }) {
  const industryProfile = useMemo(() => getIndustryProfile(state.industry), [state.industry])
  const [name, setName] = useState('')
  const [targetGroupId, setTargetGroupId] = useState(industryProfile.customerGroups[0]?.id ?? '')
  const [quality, setQuality] = useState<ProductQuality>('standard')
  const [features, setFeatures] = useState<string[]>([])
  const [rndBudget, setRndBudget] = useState(0)
  const [unitsToManufacture, setUnitsToManufacture] = useState(() => suggestStarterUnits(state, { quality: 'standard', features: [], rndBudget: 0, productionMethod: 'standard-factory', packagingQuality: 'standard' }))
  const [productionMethod, setProductionMethod] = useState<ProductionMethod>('standard-factory')
  const [packagingQuality, setPackagingQuality] = useState<PackagingQuality>('standard')
  const [price, setPrice] = useState(Math.round(industryProfile.averagePrice))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const draft = { quality, features, rndBudget, productionMethod, packagingQuality }
  const costPerUnit = estimateCostPerUnit(state, draft, unitsToManufacture)
  const totalUpfront = costPerUnit * unitsToManufacture + rndBudget

  const toggleFeature = (feature: string) => {
    setFeatures((current) => (current.includes(feature) ? current.filter((f) => f !== feature) : current.length >= 5 ? current : [...current, feature]))
  }

  const handleSubmit = () => {
    const result = onCreate({ name, targetGroupId, quality, features, rndBudget, unitsToManufacture, productionMethod, packagingQuality, price })
    if (result.error) {
      setError(result.error)
      return
    }
    setError(null)
    setName('')
    onCreated()
  }

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-white">Create a product</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-slate-400">Product name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Everyday Comfort Tee" maxLength={60} className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">Target customer group</span>
          <select value={targetGroupId} onChange={(event) => setTargetGroupId(event.target.value)} className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none">
            {industryProfile.customerGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3">
        <p className="text-xs text-slate-400">Product quality</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {QUALITY_OPTIONS.map((option) => (
            <button key={option.id} type="button" onClick={() => setQuality(option.id)} aria-pressed={quality === option.id} className={cn('rounded-xl border p-2.5 text-left transition', quality === option.id ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}>
              <p className="text-xs font-semibold text-white">{option.label}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="mt-4 flex items-center gap-1 text-xs font-medium text-amber-200">
        {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {showAdvanced ? 'Hide' : 'Show'} features, R&D, production method, and packaging
      </button>

      {showAdvanced && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs text-slate-400">Features (up to 5) <InfoTip term="Features" definition="Extra qualities that raise a product's appeal score, at the cost of a slightly higher price point matching that appeal." /></p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRODUCT_FEATURE_OPTIONS.map((feature) => (
                <button key={feature} type="button" onClick={() => toggleFeature(feature)} aria-pressed={features.includes(feature)} className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium transition', features.includes(feature) ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10')}>
                  {feature}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="flex items-center gap-1 text-xs text-slate-400">Research &amp; development budget <InfoTip term="Research & development (R&D)" /></span>
            <input type="number" min={0} step={50} value={rndBudget} onChange={(event) => setRndBudget(Math.max(0, Number(event.target.value) || 0))} className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" />
          </label>

          <div>
            <p className="text-xs text-slate-400">Production method</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {PRODUCTION_METHOD_OPTIONS.map((option) => (
                <button key={option.id} type="button" onClick={() => setProductionMethod(option.id)} aria-pressed={productionMethod === option.id} className={cn('rounded-xl border p-2.5 text-left transition', productionMethod === option.id ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}>
                  <p className="text-xs font-semibold text-white">{option.label}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400">Packaging quality</p>
            <div className="mt-2 flex gap-2">
              {PACKAGING_OPTIONS.map((option) => (
                <button key={option.id} type="button" onClick={() => setPackagingQuality(option.id)} aria-pressed={packagingQuality === option.id} className={cn('flex-1 rounded-xl border p-2 text-center text-xs font-semibold transition', packagingQuality === option.id ? 'border-amber-300/40 bg-amber-400/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5')}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-slate-400">Units to manufacture</span>
          <input type="number" min={0} step={50} value={unitsToManufacture} onChange={(event) => setUnitsToManufacture(Math.max(0, Number(event.target.value) || 0))} className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">Selling price</span>
          <input type="number" min={1} step={1} value={price} onChange={(event) => setPrice(Math.max(1, Number(event.target.value) || 0))} className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" />
        </label>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs sm:grid-cols-3">
        <div><span className="text-slate-500">Estimated cost/unit</span><p className="font-semibold text-white">{formatCurrency(costPerUnit)}</p></div>
        <div><span className="text-slate-500">Production cost total</span><p className="font-semibold text-white">{formatCurrency(costPerUnit * unitsToManufacture)}</p></div>
        <div><span className="text-slate-500">Total upfront (production + R&amp;D)</span><p className={cn('font-semibold', totalUpfront > state.cash ? 'text-rose-300' : 'text-white')}>{formatCurrency(totalUpfront)}</p></div>
      </div>
      {totalUpfront > state.cash && (
        <p className="mt-2 text-xs leading-5 text-amber-200">
          That is {formatCurrency(totalUpfront - state.cash)} more than your available cash ({formatCurrency(state.cash)}). Lower the units, quality, or R&amp;D budget to fit your budget.
        </p>
      )}

      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

      <button type="button" onClick={handleSubmit} className="primary-action mt-4">
        Confirm production
      </button>
    </section>
  )
}

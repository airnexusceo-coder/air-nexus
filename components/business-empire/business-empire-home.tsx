'use client'

import { useEffect, useState } from 'react'
import { Award, TrendingUp } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { BusinessEmpireLogo } from '@/components/business-empire/business-empire-logo'
import { SidebarNav } from '@/components/business-empire/sidebar-nav'
import { BottomNav } from '@/components/business-empire/bottom-nav'
import { SetupScreen } from '@/components/business-empire/setup-screen'
import { SettingsPage } from '@/components/business-empire/settings-page'
import { DashboardPage } from '@/components/business-empire/dashboard-page'
import { IndustryMarketPage } from '@/components/business-empire/industry-market-page'
import { ResearchPage } from '@/components/business-empire/research-page'
import { ProductsPage } from '@/components/business-empire/products-page'
import { ProductionPage } from '@/components/business-empire/production-page'
import { PricingPage } from '@/components/business-empire/pricing-page'
import { AdvertisingPage } from '@/components/business-empire/advertising-page'
import { CompetitorsPage } from '@/components/business-empire/competitors-page'
import { ReputationPage } from '@/components/business-empire/reputation-page'
import { LandFacilitiesPage } from '@/components/business-empire/land-facilities-page'
import { FundingPage } from '@/components/business-empire/funding-page'
import { FinancesPage } from '@/components/business-empire/finances-page'
import { AnnualReportsPage } from '@/components/business-empire/annual-reports-page'
import { AnnualReportView } from '@/components/business-empire/annual-report-view'
import { LearningCentre } from '@/components/business-empire/learning-centre'
import { CompleteYearModal } from '@/components/business-empire/complete-year-modal'
import type { BusinessEmpireView } from '@/components/business-empire/nav-items'
import {
  applyForLoan,
  applyUnsoldInventoryAction,
  buildFacility,
  completeFinancialYear,
  completeLesson,
  createInitialState,
  createProduct,
  discontinueProduct,
  investInCommunityProject,
  launchAdvertisingCampaign,
  launchStrategicInitiative,
  manufactureMoreUnits,
  purchaseResearch,
  sellFacility,
  updatePreferences,
  updateProductPrice,
  upgradeFacility,
  vacateLease,
  verifyLedgerIntegrity,
  type ProductCreationInput,
} from '@/lib/business-empire/game-state'
import { clearGameState, hasSavedGame, loadGameState, saveGameState } from '@/lib/business-empire/storage'
import { formatCurrency, formatSignedCurrency } from '@/lib/business-empire/format'
import type { AdvertisingChannel, AnnualReport, FacilityOwnership, FacilityType, FacilityUpgradeId, GamePreferences, GameState, LoanPurpose, Region, ResearchLevel, StrategicInitiativeId, UnsoldInventoryAction } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type NoticeTone = 'success' | 'info' | 'warning'

type BusinessEmpireHomeProps = {
  userId: string
  notify?: (message: string, tone?: NoticeTone) => void
  onEarnNexusPoints?: (amount: number, description: string, actionId: string) => void
}

type Phase = 'loading' | 'setup' | 'playing'

export function BusinessEmpireHome({ userId, notify, onEarnNexusPoints }: BusinessEmpireHomeProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [gameState, setGameState] = useState<GameState>(() => createInitialState({ companyName: '', founderName: '', industry: 'Clothing', difficulty: 'beginner', startingCash: 25_000, learningSupport: 'full', reducedMotion: false }))
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const [view, setView] = useState<BusinessEmpireView>('dashboard')
  const [showSetupForReset, setShowSetupForReset] = useState(false)
  const [completeYearOpen, setCompleteYearOpen] = useState(false)
  const [latestReport, setLatestReport] = useState<AnnualReport | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!hasSavedGame(userId)) {
        setPhase('setup')
        return
      }
      const { state: loaded, resetNotice: notice } = loadGameState(userId)
      if (loaded) {
        setGameState(loaded)
        setPhase('playing')
      } else {
        setPhase('setup')
      }
      setResetNotice(notice)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [userId])

  useEffect(() => {
    if (phase !== 'playing') return
    saveGameState(userId, gameState)
  }, [phase, userId, gameState])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || phase !== 'playing') return
    const result = verifyLedgerIntegrity(gameState)
    if (!result.ok) console.error('[Business Empire] Cash ledger mismatch — something changed cash outside appendTransaction.', result)
  }, [phase, gameState])

  const handleFirstStart = (preferences: GamePreferences) => {
    const fresh = createInitialState(preferences)
    setGameState(fresh)
    setPhase('playing')
    notify?.(`${preferences.companyName} is founded with ${formatCurrency(preferences.startingCash)} in starting capital.`, 'success')
  }

  const handleRequestNewCompany = () => setShowSetupForReset(true)

  const handleStartNewCompany = (preferences: GamePreferences) => {
    clearGameState(userId)
    const fresh = createInitialState(preferences)
    setGameState(fresh)
    setView('dashboard')
    setShowSetupForReset(false)
    notify?.(`Started fresh with ${preferences.companyName}.`, 'info')
  }

  const handleCreateProduct = (input: ProductCreationInput) => {
    const result = createProduct(gameState, input)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    notify?.(`${input.name} created and put into production.`, 'success')
    return {}
  }

  const handleManufacture = (productId: string, additionalUnits: number) => {
    const result = manufactureMoreUnits(gameState, productId, additionalUnits)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    notify?.(`Manufactured ${additionalUnits.toLocaleString()} more units.`, 'success')
    return {}
  }

  const handleUpdatePrice = (productId: string, price: number) => {
    const result = updateProductPrice(gameState, productId, price)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    return {}
  }

  const handleDiscontinue = (productId: string) => {
    setGameState((current) => discontinueProduct(current, productId))
    notify?.('Product discontinued.', 'info')
  }

  const handleInventoryAction = (productId: string, action: UnsoldInventoryAction) => {
    const result = applyUnsoldInventoryAction(gameState, productId, action)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    if (action !== 'keep') notify?.('Inventory action applied.', 'success')
    return {}
  }

  const handlePurchaseResearch = (level: ResearchLevel, targetGroupId: string) => {
    const result = purchaseResearch(gameState, level, targetGroupId)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    notify?.('Research report purchased.', 'success')
    return {}
  }

  const handleLaunchAdvertising = (productId: string, channel: AdvertisingChannel, budget: number) => {
    const result = launchAdvertisingCampaign(gameState, productId, channel, budget)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    notify?.('Advertising campaign launched.', 'success')
    return {}
  }

  const handleCompleteLesson = (lessonId: string) => {
    setGameState((current) => completeLesson(current, lessonId))
  }

  const handleUpdatePreferences = (partial: Partial<Pick<GamePreferences, 'learningSupport' | 'reducedMotion'>>) => {
    setGameState((current) => updatePreferences(current, partial))
  }

  const handleInvestInCommunity = (budget: number) => {
    const result = investInCommunityProject(gameState, budget)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    notify?.('Community and environmental initiative funded.', 'success')
    return {}
  }

  const handleLaunchInitiative = (initiativeId: StrategicInitiativeId) => {
    const result = launchStrategicInitiative(gameState, initiativeId)
    if (result.error) {
      notify?.(result.error, 'warning')
      return { error: result.error }
    }
    setGameState(result.state)
    notify?.('Boardroom decision launched. Its effects now feed into the simulation.', 'success')
    return {}
  }

  const handleApplyForLoan = (amount: number, purpose: LoanPurpose) => {
    const result = applyForLoan(gameState, amount, purpose)
    if (result.approved) {
      setGameState(result.state)
      notify?.(`Loan of ${formatCurrency(amount)} approved.`, 'success')
    } else if (result.error) {
      notify?.(result.error, 'warning')
    }
    return { error: result.error, approved: result.approved }
  }

  const handleBuildFacility = (type: FacilityType, region: Region, ownership: FacilityOwnership) => {
    const result = buildFacility(gameState, type, region, ownership)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    notify?.(`New facility ${ownership === 'owned' ? 'purchased' : 'leased'}.`, 'success')
    return {}
  }

  const handleUpgradeFacility = (facilityId: string, upgradeId: FacilityUpgradeId) => {
    const result = upgradeFacility(gameState, facilityId, upgradeId)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    notify?.('Facility upgrade installed.', 'success')
    return {}
  }

  const handleSellFacility = (facilityId: string) => {
    const result = sellFacility(gameState, facilityId)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    notify?.('Facility sold.', 'info')
    return {}
  }

  const handleVacateLease = (facilityId: string) => {
    const result = vacateLease(gameState, facilityId)
    if (result.error) return { error: result.error }
    setGameState(result.state)
    notify?.('Lease vacated.', 'info')
    return {}
  }

  const handleConfirmCompleteYear = () => {
    const { state: next, report } = completeFinancialYear(gameState)
    setGameState(next)
    setCompleteYearOpen(false)
    setLatestReport(report)
    notify?.(`Financial Year ${report.year} complete: ${report.netProfit >= 0 ? 'net profit' : 'net loss'} of ${formatSignedCurrency(report.netProfit)}.`, report.netProfit >= 0 ? 'success' : 'warning')
    onEarnNexusPoints?.(15, `Business Empire: completed Financial Year ${report.year}`, `business-empire-year-${report.year}`)
  }

  if (phase === 'loading') {
    return <div className="premium-skeleton h-96 rounded-3xl" role="status" aria-label="Loading Business Empire" />
  }

  if (phase === 'setup') {
    return <SetupScreen onStart={handleFirstStart} />
  }

  if (showSetupForReset) {
    return <SetupScreen onStart={handleStartNewCompany} />
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      {resetNotice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-sky-300/20 bg-sky-400/[0.06] px-4 py-2.5 text-xs leading-5 text-sky-100">
          <span>{resetNotice}</span>
          <button type="button" onClick={() => setResetNotice(null)} className="shrink-0 font-semibold underline underline-offset-2">Dismiss</button>
        </div>
      )}
      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] px-4 py-2.5 text-xs leading-5 text-amber-100">
        This game is for educational purposes only. All companies, industries, and figures are simulated — no real money is involved.
      </div>

      <div className="flex gap-5">
        <SidebarNav companyName={gameState.companyName} year={gameState.year} active={view} onNavigate={setView} />

        <div className="min-w-0 flex-1 space-y-5">
          <div className="glass-strong flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4">
            <BusinessEmpireLogo />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                <TrendingUp className="size-3.5 text-amber-300" aria-hidden="true" />
                <span className="text-xs text-slate-400">Cash</span>
                <span className="text-sm font-semibold text-white">{formatCurrency(gameState.cash)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                <Award className="size-3.5 text-amber-300" aria-hidden="true" />
                <span className="text-xs text-slate-400">Company value</span>
                <span className="text-sm font-semibold text-white">{formatCurrency(gameState.companyValue)}</span>
              </div>
            </div>
          </div>
          <div>
            {view === 'dashboard' && <DashboardPage state={gameState} onNavigate={setView} onOpenCompleteYear={() => setCompleteYearOpen(true)} onLaunchInitiative={handleLaunchInitiative} />}
            {view === 'industry-market' && <IndustryMarketPage state={gameState} />}
            {view === 'research' && <ResearchPage state={gameState} onPurchase={handlePurchaseResearch} />}
            {view === 'products' && <ProductsPage state={gameState} onCreate={handleCreateProduct} onDiscontinue={handleDiscontinue} onInventoryAction={handleInventoryAction} />}
            {view === 'production' && <ProductionPage state={gameState} onManufacture={handleManufacture} />}
            {view === 'pricing' && <PricingPage state={gameState} onUpdatePrice={handleUpdatePrice} />}
            {view === 'advertising' && <AdvertisingPage state={gameState} onLaunch={handleLaunchAdvertising} />}
            {view === 'competitors' && <CompetitorsPage state={gameState} />}
            {view === 'reputation' && <ReputationPage state={gameState} onInvestInCommunity={handleInvestInCommunity} />}
            {view === 'land-facilities' && <LandFacilitiesPage state={gameState} onBuild={handleBuildFacility} onUpgrade={handleUpgradeFacility} onSell={handleSellFacility} onVacate={handleVacateLease} />}
            {view === 'funding' && <FundingPage state={gameState} onApplyForLoan={handleApplyForLoan} />}
            {view === 'finances' && <FinancesPage state={gameState} />}
            {view === 'annual-reports' && <AnnualReportsPage state={gameState} />}
            {view === 'learn' && <LearningCentre completedLessonIds={gameState.completedLessonIds} onCompleteLesson={handleCompleteLesson} />}
            {view === 'settings' && <SettingsPage preferences={gameState.preferences} onUpdate={handleUpdatePreferences} onRequestNewCompany={handleRequestNewCompany} />}
          </div>
        </div>
      </div>

      <BottomNav active={view} onNavigate={setView} />

      {completeYearOpen && <CompleteYearModal state={gameState} onConfirm={handleConfirmCompleteYear} onCancel={() => setCompleteYearOpen(false)} />}

      {latestReport && (
        <Modal open title={`Financial Year ${latestReport.year} Complete`} description="Here is exactly what happened and why." onClose={() => setLatestReport(null)} className="max-w-2xl">
          <AnnualReportView report={latestReport} />
          <button type="button" onClick={() => setLatestReport(null)} className={cn('primary-action mt-5 w-full')}>Continue to Year {gameState.year}</button>
        </Modal>
      )}
    </div>
  )
}

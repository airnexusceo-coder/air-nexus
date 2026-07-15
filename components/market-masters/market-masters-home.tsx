'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Flame, Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { SidebarNav } from '@/components/market-masters/sidebar-nav'
import { BottomNav } from '@/components/market-masters/bottom-nav'
import { PreferencesScreen } from '@/components/market-masters/preferences-screen'
import { SettingsPage } from '@/components/market-masters/settings-page'
import { DashboardPage } from '@/components/market-masters/dashboard-page'
import { StockMarketView } from '@/components/market-masters/stock-market-view'
import { StockDetailView } from '@/components/market-masters/stock-detail-view'
import { WatchlistPage } from '@/components/market-masters/watchlist-page'
import { PortfolioDashboard } from '@/components/market-masters/portfolio-dashboard'
import { LearningCentre } from '@/components/market-masters/learning-centre'
import { MissionsPanel } from '@/components/market-masters/missions-panel'
import { AchievementsPage } from '@/components/market-masters/achievements-page'
import { NewsFeed } from '@/components/market-masters/news-feed'
import { EndOfRoundReportView } from '@/components/market-masters/end-of-round-report'
import { GlossaryModal } from '@/components/market-masters/glossary-modal'
import { GameTutorial } from '@/components/market-masters/game-tutorial'
import { TeachingHelpButton } from '@/components/market-masters/teaching-help-button'
import { FirstPurchaseExplainer } from '@/components/market-masters/first-purchase-explainer'
import { getAchievement } from '@/lib/market-masters/achievements'
import { DECISION_CHALLENGES } from '@/lib/market-masters/decision-challenges'
import {
  addReflection,
  applyAchievementProgress,
  applyMissionProgress,
  buyStock,
  completeLesson,
  createInitialState,
  evaluateBuyRiskFeedback,
  flagNewsItem,
  levelFromXp,
  markDailyChallengeProgress,
  markFirstPurchaseExplainerSeen,
  markTutorialCompleted,
  processDueTicks,
  recordDecision,
  refreshDailyChallenge,
  refreshStreak,
  sellStock,
  toggleWatchlist,
  updatePreferences,
  verifyLedgerIntegrity,
  xpProgressIntoLevel,
} from '@/lib/market-masters/game-state'
import { computeDiversificationScore, computePortfolioValue, computeProfitLoss } from '@/lib/market-masters/market-engine'
import { formatMarketDate, isMarketOpenAt, nextMarketOpen } from '@/lib/market-masters/market-hours'
import { getLesson, LESSONS } from '@/lib/market-masters/lessons'
import { getMission, MISSION_DEFINITIONS } from '@/lib/market-masters/missions'
import { generateEndOfRoundReport } from '@/lib/market-masters/report'
import { clearGameState, hasSavedGame, loadGameState, saveGameState } from '@/lib/market-masters/storage'
import { STOCKS, getStock } from '@/lib/market-masters/stocks'
import { formatCurrency, formatPercent, formatSignedCurrency } from '@/lib/market-masters/format'
import type { MarketMastersView } from '@/components/market-masters/nav-items'
import { MARKET_TICK_INTERVAL_MS, type DecisionOptionQuality, type GamePreferences, type GameState, type MarketStatus } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

type NoticeTone = 'success' | 'info' | 'warning'

type MarketMastersHomeProps = {
  userId: string
  notify?: (message: string, tone?: NoticeTone) => void
  onEarnNexusPoints?: (amount: number, description: string, actionId: string) => void
}

type Phase = 'loading' | 'preferences' | 'playing'

export function MarketMastersHome({ userId, notify, onEarnNexusPoints }: MarketMastersHomeProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [gameState, setGameState] = useState<GameState>(() => createInitialState())
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const [view, setView] = useState<MarketMastersView>('dashboard')
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [initialLessonId, setInitialLessonId] = useState<string | null>(null)
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [showPreferencesForReset, setShowPreferencesForReset] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [marketStatus, setMarketStatus] = useState<MarketStatus>('closed')
  const [firstPurchaseTicker, setFirstPurchaseTicker] = useState<string | null>(null)

  const gameStateRef = useRef(gameState)
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  const syncTimeoutRef = useRef<number | null>(null)

  // One-time hydration: brand new players go to the preferences screen; returning
  // players load straight in, silently catching up on any real trading ticks
  // missed while the game was closed. Ticks never touch cash, so this catch-up
  // needs no confirmation — it is exactly what a real stock app does when you
  // reopen it and see the current price, not a replay you have to approve.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!hasSavedGame(userId)) {
        setPhase('preferences')
        return
      }
      const { state: loaded, resetNotice: notice } = loadGameState(userId)
      const withStreak = refreshDailyChallenge(refreshStreak(loaded))
      const { state: caughtUp } = processDueTicks(withStreak, STOCKS, Math.random, new Date(), 100)
      setGameState(caughtUp)
      setResetNotice(notice)
      setPhase('playing')
      if (!caughtUp.tutorialCompleted) setTutorialOpen(true)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [userId])

  useEffect(() => {
    if (phase !== 'playing') return
    saveGameState(userId, gameState)
  }, [phase, userId, gameState])

  useEffect(() => {
    if (phase !== 'playing') return
    if (syncTimeoutRef.current != null) window.clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = window.setTimeout(() => {
      const strongDecisions = gameState.decisionLog.filter((entry) => entry.quality === 'strong').length
      void fetch('/api/market-masters/progress', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: gameState.day,
          portfolioValue: computePortfolioValue(gameState),
          returnPercent: computeProfitLoss(gameState).percent,
          lessonsCompleted: gameState.completedLessonIds.length,
          lessonsTotal: LESSONS.length,
          missionsCompleted: gameState.completedMissionIds.length,
          missionsTotal: MISSION_DEFINITIONS.length,
          achievementsUnlocked: gameState.unlockedAchievementIds.length,
          diversificationScore: computeDiversificationScore(gameState, STOCKS),
          decisionQualityRate: gameState.decisionLog.length > 0 ? (strongDecisions / gameState.decisionLog.length) * 100 : null,
          misleadingNewsIdentified: gameState.identifiedMisleadingNewsIds.length,
          reflections: gameState.reflections.map((reflection) => ({ day: reflection.day, text: reflection.text })),
          mode: gameState.preferences.learningSupport,
        }),
      }).catch(() => undefined)
    }, 1500)
    return () => {
      if (syncTimeoutRef.current != null) window.clearTimeout(syncTimeoutRef.current)
    }
  }, [phase, userId, gameState])

  // Dev-only safety net: the displayed cash balance must always equal the sum of the ledger.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || phase !== 'playing') return
    const result = verifyLedgerIntegrity(gameState)
    if (!result.ok) {
      console.error('[Market Masters] Cash ledger mismatch — something changed cash outside appendCashTransaction.', result)
    }
  }, [phase, gameState])

  const announceMissions = (ids: string[]) => {
    for (const id of ids) {
      const mission = getMission(id)
      if (!mission) continue
      notify?.(`Mission complete: ${mission.title} (+${mission.xpReward} XP${mission.cashReward > 0 ? `, +${formatCurrency(mission.cashReward)}` : ''})`, 'success')
      onEarnNexusPoints?.(10, `Market Masters: completed mission "${mission.title}"`, `market-masters-mission-${id}`)
    }
  }

  const announceAchievements = (ids: string[]) => {
    for (const id of ids) {
      const achievement = getAchievement(id)
      if (!achievement) continue
      notify?.(`Achievement unlocked: ${achievement.title} (+${achievement.xpReward} XP)`, 'success')
      onEarnNexusPoints?.(10, `Market Masters: unlocked "${achievement.title}"`, `market-masters-achievement-${id}`)
    }
  }

  const applyProgressLayers = (previous: GameState, candidate: GameState): GameState => {
    const missionResult = applyMissionProgress(previous, candidate, STOCKS)
    const achievementResult = applyAchievementProgress(previous, missionResult.state, STOCKS)
    setGameState(achievementResult.state)
    announceMissions(missionResult.newlyCompletedIds)
    announceAchievements(achievementResult.newlyUnlockedIds)
    return achievementResult.state
  }

  const applyDailyChallenge = (actionId: string) => {
    setGameState((current) => {
      const { state: next, task } = markDailyChallengeProgress(current, actionId)
      if (task) notify?.(`Daily challenge complete: ${task.title} (+${task.xpReward} XP${task.bonusCash > 0 ? `, +${formatCurrency(task.bonusCash)}` : ''})`, 'success')
      return next
    })
  }

  const handleBuy = (ticker: string, shares: number) => {
    const previous = gameState
    const { state: afterBuy, error } = buyStock(previous, ticker, shares, STOCKS)
    if (error) return { error }
    const isFirstEverPurchase = !previous.cashLedger.some((transaction) => transaction.type === 'BUY')
    const feedback = evaluateBuyRiskFeedback(afterBuy, ticker, STOCKS)
    applyProgressLayers(previous, afterBuy)
    applyDailyChallenge('trade')
    if (isFirstEverPurchase && !previous.hasSeenFirstPurchaseExplainer) setFirstPurchaseTicker(ticker)
    return feedback ? { feedback } : {}
  }

  const handleSell = (ticker: string, shares: number) => {
    const previous = gameState
    const { state: afterSell, error } = sellStock(previous, ticker, shares, STOCKS)
    if (error) return { error }
    applyProgressLayers(previous, afterSell)
    applyDailyChallenge('trade')
    return {}
  }

  const handleToggleWatchlist = (ticker: string) => {
    setGameState((current) => toggleWatchlist(current, ticker))
  }

  const handleCompleteLesson = (lessonId: string, quizResult?: { correct: number; total: number }) => {
    if (gameState.completedLessonIds.includes(lessonId)) return
    const previous = gameState
    const afterLesson = completeLesson(previous, lessonId, quizResult)
    const lesson = getLesson(lessonId)
    if (lesson) {
      notify?.(`Lesson complete: +${lesson.xpReward} XP${lesson.bonusCash > 0 ? `, +${formatCurrency(lesson.bonusCash)}` : ''}`, 'success')
      onEarnNexusPoints?.(15, `Market Masters: completed "${lesson.title}"`, `market-masters-lesson-${lessonId}`)
    }
    applyProgressLayers(previous, afterLesson)
  }

  const handleFlagNews = (newsId: string): boolean => {
    const { state: next, wasMisleading } = flagNewsItem(gameState, newsId)
    if (next !== gameState) applyProgressLayers(gameState, next)
    return wasMisleading
  }

  const handleAnswerChallenge = (challengeId: string, optionId: string, quality: DecisionOptionQuality) => {
    const next = recordDecision(gameState, challengeId, optionId, quality)
    applyProgressLayers(gameState, next)
  }

  const handleAddReflection = (text: string) => {
    setGameState((current) => addReflection(current, text))
    notify?.('Reflection saved.', 'success')
  }

  const handleCloseTutorial = () => {
    setTutorialOpen(false)
    setGameState((current) => markTutorialCompleted(current))
  }

  const handleCloseFirstPurchaseExplainer = () => {
    setFirstPurchaseTicker(null)
    setGameState((current) => markFirstPurchaseExplainerSeen(current))
  }

  const handleNavigate = (nextView: MarketMastersView) => {
    setInitialLessonId(null)
    setView(nextView)
    if (nextView === 'learn') applyDailyChallenge('visit-learning')
    if (nextView === 'portfolio') applyDailyChallenge('check-portfolio')
  }

  const handleContinueLearning = (lessonId: string | null) => {
    handleNavigate('learn')
    setInitialLessonId(lessonId)
  }

  const handleOpenDetail = (ticker: string) => {
    setSelectedTicker(ticker)
    applyDailyChallenge('read-news')
  }

  const handleGlobalSearch = (query: string) => {
    const trimmed = query.trim().toLowerCase()
    if (trimmed.length > 0) {
      const matches = STOCKS.filter((stock) => stock.name.toLowerCase().includes(trimmed) || stock.ticker.toLowerCase().includes(trimmed))
      if (matches.length === 1) setSelectedTicker(matches[0].ticker)
    }
    handleNavigate('market')
  }

  const handleFirstStart = (preferences: GamePreferences) => {
    const fresh = refreshDailyChallenge(refreshStreak(createInitialState(preferences)))
    setGameState(fresh)
    setPhase('playing')
    setTutorialOpen(true)
  }

  const handleRequestNewGame = () => setShowPreferencesForReset(true)

  const handleStartNewGame = (preferences: GamePreferences) => {
    clearGameState(userId)
    const fresh = refreshDailyChallenge(refreshStreak(createInitialState(preferences)))
    setGameState(fresh)
    setSelectedTicker(null)
    setView('dashboard')
    setShowPreferencesForReset(false)
    notify?.(`Market Masters has been reset — starting fresh with ${formatCurrency(preferences.startingCash)}.`, 'info')
  }

  // The single, central real-time market clock. Follows real local trading
  // hours (9am-5pm, Monday-Friday) — there is no player-selectable speed to
  // restart on, so this effect mounts once per active game and never tears
  // down and recreates itself the way the old speed-based timer did. A
  // Strict Mode double-invoke still only ever leaves one live interval,
  // since cleanup always clears the previous one before a new one starts.
  const gameStarted = phase === 'playing'
  useEffect(() => {
    if (!gameStarted) return

    const tick = () => {
      const now = new Date()
      if (isMarketOpenAt(now)) {
        const previous = gameStateRef.current
        const { state: advanced, news, ticksProcessed } = processDueTicks(previous, STOCKS, Math.random, now, 1)
        if (ticksProcessed > 0) {
          const finalState = applyProgressLayers(previous, advanced)
          gameStateRef.current = finalState
          if (news.length > 0) notify?.(`${news.length} new market update${news.length === 1 ? '' : 's'}`, 'info')
        }
        const nextTickAt = new Date(gameStateRef.current.lastTickAt).getTime() + MARKET_TICK_INTERVAL_MS
        setSecondsRemaining(Math.max(0, Math.round((nextTickAt - Date.now()) / 1000)))
        setMarketStatus('open')
      } else {
        const opensAt = nextMarketOpen(now)
        setSecondsRemaining(Math.max(0, Math.round((opensAt.getTime() - Date.now()) / 1000)))
        setMarketStatus('closed')
      }
    }

    // Deferred into a callback (rather than called synchronously in the effect
    // body) so the first paint isn't a forced synchronous state update.
    const initialId = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(initialId)
      window.clearInterval(id)
    }
    // applyProgressLayers/notify intentionally excluded: they close over
    // gameStateRef, not stale state, and including them would tear this
    // singleton timer down on every render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted])

  const activeChallenge = useMemo(() => {
    if (gameState.day < 1) return null
    return DECISION_CHALLENGES.find((challenge) => !gameState.dismissedChallengeIds.includes(challenge.id)) ?? null
  }, [gameState.day, gameState.dismissedChallengeIds])

  const report = useMemo(() => generateEndOfRoundReport(gameState, STOCKS), [gameState])

  const level = levelFromXp(gameState.xp)
  const xpProgress = xpProgressIntoLevel(gameState.xp)
  const portfolioValue = computePortfolioValue(gameState)
  const profitLoss = computeProfitLoss(gameState)
  const selectedStock = selectedTicker ? getStock(selectedTicker) : undefined
  const simulatedDate = formatMarketDate(new Date())

  if (phase === 'loading') {
    return <div className="premium-skeleton h-96 rounded-3xl" role="status" aria-label="Loading Market Masters" />
  }

  if (phase === 'preferences') {
    return <PreferencesScreen onStart={handleFirstStart} />
  }

  if (showPreferencesForReset) {
    return <PreferencesScreen onStart={handleStartNewGame} onCancel={() => setShowPreferencesForReset(false)} />
  }

  return (
    <div className={cn('space-y-5 pb-24 lg:pb-0', gameState.preferences.reducedMotion && 'mm-reduce-motion')}>
      {resetNotice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-sky-300/20 bg-sky-400/[0.06] px-4 py-2.5 text-xs leading-5 text-sky-100">
          <span>{resetNotice}</span>
          <button type="button" onClick={() => setResetNotice(null)} className="shrink-0 font-semibold underline underline-offset-2">Dismiss</button>
        </div>
      )}
      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] px-4 py-2.5 text-xs leading-5 text-amber-100">
        This game is for educational purposes and does not provide financial advice. All companies, prices, and news are simulated — no real money is involved.
      </div>

      <div className="flex gap-5">
        <SidebarNav active={view} onNavigate={handleNavigate} onSearch={handleGlobalSearch} />

        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white"><Sparkles className="size-4 text-amber-300" aria-hidden="true" /></span>
              <div>
                <p className="text-xs text-slate-500">Level {level}</p>
                <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-100" style={{ width: `${(xpProgress.current / xpProgress.needed) * 100}%` }} />
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-slate-400"><Flame className="size-4 text-orange-300" aria-hidden="true" />{gameState.streakDays}-day learning streak</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatChip label="Cash" value={formatCurrency(gameState.cash)} />
              <StatChip label="Portfolio value" value={formatCurrency(portfolioValue)} />
              <StatChip
                label="Total return"
                value={`${formatSignedCurrency(profitLoss.value)} (${formatPercent(profitLoss.percent)})`}
                tone={profitLoss.value >= 0 ? 'positive' : 'negative'}
              />
            </div>
          </div>

          <div>
            {view === 'dashboard' && (
              <DashboardPage
                state={gameState}
                day={gameState.day}
                simulatedDate={simulatedDate}
                secondsRemaining={secondsRemaining}
                marketStatus={marketStatus}
                onNavigate={handleNavigate}
                onContinueLearning={handleContinueLearning}
                onOpenReport={() => setReportOpen(true)}
              />
            )}
            {view === 'market' && (
              <StockMarketView stocks={STOCKS} state={gameState} onOpenDetail={handleOpenDetail} onToggleWatchlist={handleToggleWatchlist} />
            )}
            {view === 'portfolio' && <PortfolioDashboard state={gameState} stocks={STOCKS} />}
            {view === 'watchlist' && (
              <WatchlistPage stocks={STOCKS} state={gameState} onOpenDetail={handleOpenDetail} onToggleWatchlist={handleToggleWatchlist} />
            )}
            {view === 'news' && (
              <NewsFeed
                news={gameState.news}
                identifiedMisleadingNewsIds={gameState.identifiedMisleadingNewsIds}
                onFlagNews={handleFlagNews}
                activeChallenge={activeChallenge}
                onAnswerChallenge={handleAnswerChallenge}
              />
            )}
            {view === 'learn' && (
              <LearningCentre lessons={LESSONS} completedLessonIds={gameState.completedLessonIds} onCompleteLesson={handleCompleteLesson} initialLessonId={initialLessonId} />
            )}
            {view === 'missions' && <MissionsPanel missions={MISSION_DEFINITIONS} completedMissionIds={gameState.completedMissionIds} />}
            {view === 'achievements' && <AchievementsPage unlockedAchievementIds={gameState.unlockedAchievementIds} />}
            {view === 'settings' && (
              <SettingsPage
                preferences={gameState.preferences}
                onUpdate={(partial) => setGameState((current) => updatePreferences(current, partial))}
                onRequestNewGame={handleRequestNewGame}
              />
            )}
          </div>
        </div>
      </div>

      <BottomNav active={view} onNavigate={handleNavigate} />

      {selectedStock && (
        <StockDetailView
          stock={selectedStock}
          state={gameState}
          onClose={() => setSelectedTicker(null)}
          onBuy={handleBuy}
          onSell={handleSell}
          onToggleWatchlist={handleToggleWatchlist}
        />
      )}

      {reportOpen && (
        <Modal open title="Performance Report" description="A snapshot of your investing so far — check in any time, not just at a fixed round end." onClose={() => setReportOpen(false)} className="max-w-2xl">
          <EndOfRoundReportView report={report} reflections={gameState.reflections} onAddReflection={handleAddReflection} />
        </Modal>
      )}

      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      <GameTutorial open={tutorialOpen} onClose={handleCloseTutorial} />
      <TeachingHelpButton view={view} onOpenGlossary={() => setGlossaryOpen(true)} onOpenLearningCentre={() => handleNavigate('learn')} onOpenTutorial={() => setTutorialOpen(true)} />
      {firstPurchaseTicker && <FirstPurchaseExplainer ticker={firstPurchaseTicker} state={gameState} onClose={handleCloseFirstPurchaseExplainer} />}
    </div>
  )
}

function StatChip({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('text-sm font-semibold', tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : 'text-white')}>{value}</p>
    </div>
  )
}

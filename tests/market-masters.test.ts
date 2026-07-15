import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import * as marketEngine from '../lib/market-masters/market-engine'
import { advanceTick, computeHoldingsValue, computePortfolioValue, sumCashLedger } from '../lib/market-masters/market-engine'
import { isMarketOpenAt, nextMarketOpen } from '../lib/market-masters/market-hours'
import {
  applyMissionProgress,
  buyStock,
  completeLesson,
  createInitialState,
  processDueTicks,
  sellStock,
  verifyLedgerIntegrity,
} from '../lib/market-masters/game-state'
import { STOCKS } from '../lib/market-masters/stocks'
import { DEFAULT_PREFERENCES, MARKET_TICK_INTERVAL_MS, type GameState } from '../lib/market-masters/types'

// Deterministic stand-in for Math.random so price drift/events are stable across runs.
const rng = () => 0.5

// Monday 8 January 2024 09:00 local time — a known weekday to build fixed test clocks from.
const MONDAY_OPEN = new Date(2024, 0, 8, 9, 0, 0)

// ============================================================================
// Cash ledger integrity — 10 scenarios from the spec
// ============================================================================

// 1. Buying reduces cash correctly.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const price = state.prices.NIMB
  const { state: afterBuy, error } = buyStock(state, 'NIMB', 10, STOCKS)
  assert.equal(error, undefined)
  assert.equal(afterBuy.cash, state.cash - price * 10, 'buying reduces cash by exactly shares x price')
  assert.equal(afterBuy.holdings.NIMB?.shares, 10)
}

// 2. Selling increases cash correctly.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const price = state.prices.NIMB
  const { state: afterBuy } = buyStock(state, 'NIMB', 10, STOCKS)
  const cashAfterBuy = afterBuy.cash
  const { state: afterSell, error } = sellStock(afterBuy, 'NIMB', 4, STOCKS)
  assert.equal(error, undefined)
  assert.equal(afterSell.cash, cashAfterBuy + price * 4, 'selling increases cash by exactly shares x price')
  assert.equal(afterSell.holdings.NIMB?.shares, 6)
}

// 3. A rising share price changes portfolio value, never cash.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const { state: afterBuy } = buyStock(state, 'NIMB', 10, STOCKS)
  const cashBefore = afterBuy.cash
  const withHigherPrice: GameState = { ...afterBuy, prices: { ...afterBuy.prices, NIMB: afterBuy.prices.NIMB * 1.5 } }
  assert.equal(withHigherPrice.cash, cashBefore, 'cash is untouched when a held stock price increases')
  assert.ok(computePortfolioValue(withHigherPrice) > computePortfolioValue(afterBuy), 'portfolio value rises with the share price instead')
}

// 4. Advancing one real market tick does not auto-add cash.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const cashBefore = state.cash
  const { state: afterAdvance } = advanceTick(state, STOCKS, rng, MONDAY_OPEN)
  assert.equal(afterAdvance.cash, cashBefore, 'advancing a market tick never changes cash on its own')
  assert.equal(afterAdvance.day, 1, 'the first tick of a new trading session advances the trading day')
}

// 5. A dividend is paid exactly once when its interval is reached, not again the very next tick.
{
  let state = createInitialState(DEFAULT_PREFERENCES)
  state = buyStock(state, 'BASE', 20, STOCKS).state // BASE pays a dividend; NIMB does not.
  // Each advanceTick call here lands on a new calendar day (spaced 24h apart) so `day` advances once per call, mirroring "20 trading days".
  let clock = MONDAY_OPEN
  for (let i = 0; i < 20; i++) {
    state = advanceTick(state, STOCKS, rng, clock).state
    clock = new Date(clock.getTime() + 24 * 60 * 60 * 1000)
  }
  assert.equal(state.day, 20)
  const dividendCount = (s: GameState) => s.cashLedger.filter((t) => t.type === 'DIVIDEND').length
  assert.equal(dividendCount(state), 1, 'the dividend interval (trading day 20) pays exactly once')
  const dayAfter = advanceTick(state, STOCKS, rng, clock).state
  assert.equal(dividendCount(dayAfter), 1, 'the dividend is not paid again on the very next tick')
}

// 6. A mission reward is claimed only once.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const { state: afterBuy } = buyStock(state, 'NIMB', 1, STOCKS)
  const first = applyMissionProgress(state, afterBuy, STOCKS)
  assert.ok(first.newlyCompletedIds.includes('first-stock'), 'the first-purchase mission completes on the first buy')
  const rewardCount = (s: GameState) => s.cashLedger.filter((t) => t.type === 'MISSION_REWARD' && t.relatedId === 'first-stock').length
  assert.equal(rewardCount(first.state), 1)
  const second = applyMissionProgress(first.state, first.state, STOCKS)
  assert.equal(second.newlyCompletedIds.length, 0, 'a mission already recorded as completed is never re-evaluated as newly complete')
  assert.equal(rewardCount(second.state), 1, 'the mission reward is only ever paid once')
}

// 7. A quiz/lesson reward is claimed only once.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const lessonId = 'what-is-a-stock'
  const first = completeLesson(state, lessonId, { correct: 3, total: 3 })
  const rewardCount = (s: GameState) => s.cashLedger.filter((t) => t.type === 'QUIZ_REWARD' && t.relatedId === lessonId).length
  assert.equal(rewardCount(first), 1, 'completing a lesson pays its bonus cash exactly once')
  const second = completeLesson(first, lessonId, { correct: 3, total: 3 })
  assert.equal(second, first, 'completing an already-completed lesson is a no-op')
  assert.equal(rewardCount(second), 1, 'the quiz reward is never paid twice for the same lesson')
}

// 8. Refreshing/reloading (a serialize + deserialize round trip) never duplicates money.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const { state: afterBuy } = buyStock(state, 'NIMB', 5, STOCKS)
  const reloaded = JSON.parse(JSON.stringify(afterBuy)) as GameState
  assert.equal(reloaded.cash, afterBuy.cash, 'serializing and reloading state does not change the cash value')
  assert.equal(sumCashLedger(reloaded), reloaded.cash, 'reloaded state still satisfies cash === sum(ledger)')
}

// 9. Cash always equals the starting balance plus every ledger transaction.
{
  let state = createInitialState(DEFAULT_PREFERENCES)
  state = buyStock(state, 'NIMB', 3, STOCKS).state
  state = sellStock(state, 'NIMB', 1, STOCKS).state
  state = advanceTick(state, STOCKS, rng, MONDAY_OPEN).state
  assert.equal(state.cash, sumCashLedger(state))
  assert.ok(verifyLedgerIntegrity(state).ok, 'the dev-mode ledger checker reports no mismatch')
}

// 10. Portfolio value always equals cash plus the current value of holdings.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const { state: afterBuy } = buyStock(state, 'NIMB', 4, STOCKS)
  assert.equal(computePortfolioValue(afterBuy), afterBuy.cash + computeHoldingsValue(afterBuy))
}

console.log('Market Masters cash ledger tests passed')

// ============================================================================
// Real-time, real-clock market — 10 scenarios
// ============================================================================

// tsc's outDir only mirrors the tests/ and lib/market-masters/ trees it was
// asked to compile, so __dirname at runtime (.test-build/tests) does not sit
// two levels under the real project root the way the source tests/ dir does.
// Read this as plain text straight from the actual source tree instead.
const projectRoot = path.join(__dirname, '..', '..')
const homeShellPath = path.join(projectRoot, 'components', 'market-masters', 'market-masters-home.tsx')
const homeShellSource = readFileSync(homeShellPath, 'utf8')

// 1. No manual advance-time control exists anywhere in the game shell or engine, and there is no player-selectable speed.
assert.equal('advanceWeek' in marketEngine, false, 'the manual advanceWeek control has been removed from the market engine')
assert.equal(existsSync(path.join(projectRoot, 'components', 'market-masters', 'sim-controls.tsx')), false, 'the manual sim-controls component has been deleted')
assert.equal(existsSync(path.join(projectRoot, 'components', 'market-masters', 'offline-catchup-modal.tsx')), false, 'the manual catch-up confirmation modal has been deleted — catch-up is now silent since ticks never touch cash')
assert.ok(!/Advance 1 day|Advance one day|Advance 1 week|Advance one week|onAdvanceDay|onAdvanceWeek/.test(homeShellSource), 'no manual advance-time button or handler exists in the game shell')
assert.equal('simulationSpeed' in DEFAULT_PREFERENCES, false, 'there is no player-selectable simulation speed — the market runs on real trading hours instead')

// 2. The market follows real trading hours: 9:00 AM to 5:00 PM, Monday to Friday, in local time.
assert.equal(isMarketOpenAt(new Date(2024, 0, 8, 9, 0)), true, 'exactly 9:00am on a weekday is open')
assert.equal(isMarketOpenAt(new Date(2024, 0, 8, 8, 59)), false, '8:59am is not yet open')
assert.equal(isMarketOpenAt(new Date(2024, 0, 8, 16, 59)), true, '4:59pm is still open')
assert.equal(isMarketOpenAt(new Date(2024, 0, 8, 17, 0)), false, '5:00pm on the dot is closed')
assert.equal(isMarketOpenAt(new Date(2024, 0, 13, 10, 0)), false, 'Saturday is always closed, regardless of the hour')
assert.equal(isMarketOpenAt(new Date(2024, 0, 14, 10, 0)), false, 'Sunday is always closed, regardless of the hour')
{
  const fridayEvening = new Date(2024, 0, 12, 18, 0)
  const open = nextMarketOpen(fridayEvening)
  assert.equal(open.getDay(), 1, 'the next open after Friday evening is Monday, skipping the weekend')
  assert.equal(open.getHours(), 9)
}

// 3. Prices update automatically about every 5 real minutes while open — far slower than the old 5-60 second "speed" options.
assert.equal(MARKET_TICK_INTERVAL_MS, 5 * 60 * 1000, 'the market ticks every 5 real minutes')

// 4. Only one timer can ever run at once (a single setInterval call drives everything).
const setIntervalCount = (homeShellSource.match(/window\.setInterval\(/g) ?? []).length
assert.equal(setIntervalCount, 1, 'exactly one setInterval call exists — a second one would risk duplicate market updates')
assert.ok(homeShellSource.includes('window.clearInterval(id)'), 'the timer effect always cleans up its interval, so re-renders and Strict Mode double-invocation cannot leave two timers running')

// 5. The timer effect depends only on whether the game has started — never on navigation or any per-render value that would cause spurious restarts.
const depsMatch = homeShellSource.match(/\}, \[(gameStarted[^\]]*)]\)/)
assert.ok(depsMatch, 'the market clock effect has a dependency array')
assert.equal(depsMatch![1].trim(), 'gameStarted', 'the market clock effect depends on nothing but whether the game has started — there is no speed or view to restart it on')

// 6. The tick callback is scheduled via setInterval, never invoked synchronously when the effect (re)starts.
const timerEffectMatch = homeShellSource.match(/useEffect\(\(\) => \{\s*if \(!gameStarted\)[\s\S]*?\}, \[gameStarted]\)/)
assert.ok(timerEffectMatch, 'the market clock effect body can be located')
const timerEffectBody = timerEffectMatch![0]
const beforeCallbackDefined = timerEffectBody.split('const tick = () =>')[0]
assert.ok(!beforeCallbackDefined.includes('processDueTicks'), 'processDueTicks is not called before the tick callback is even defined')
assert.ok(!timerEffectBody.includes('tick()'), 'the tick callback is never invoked directly/synchronously — only passed by reference to setInterval')
assert.ok(/window\.setInterval\(tick,/.test(timerEffectBody), 'the tick callback is scheduled via setInterval rather than called immediately')

// 7. Each real 5-minute tick is processed only once: a second check at the same moment (or before the interval has elapsed) is a no-op.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const withTick: GameState = { ...state, lastTickAt: MONDAY_OPEN.toISOString() }
  const threeMinutesLater = new Date(MONDAY_OPEN.getTime() + 3 * 60 * 1000)
  const tooSoon = processDueTicks(withTick, STOCKS, rng, threeMinutesLater, 5)
  assert.equal(tooSoon.ticksProcessed, 0, 'no tick is due yet before a full 5-minute interval has elapsed')

  const fiveMinutesLater = new Date(MONDAY_OPEN.getTime() + MARKET_TICK_INTERVAL_MS)
  const due = processDueTicks(withTick, STOCKS, rng, fiveMinutesLater, 5)
  assert.equal(due.ticksProcessed, 1, 'exactly one tick is due once the interval has elapsed')
  const checkAgainSameMoment = processDueTicks(due.state, STOCKS, rng, fiveMinutesLater, 5)
  assert.equal(checkAgainSameMoment.ticksProcessed, 0, 'checking again at the same moment does not reprocess the tick that just happened')
}

// 8. Reloading a saved game does not duplicate the most recent tick.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const withTick: GameState = { ...state, lastTickAt: MONDAY_OPEN.toISOString() }
  const now = new Date(MONDAY_OPEN.getTime() + MARKET_TICK_INTERVAL_MS)
  const first = processDueTicks(withTick, STOCKS, rng, now, 5)
  assert.equal(first.ticksProcessed, 1)
  const reloaded = JSON.parse(JSON.stringify(first.state)) as GameState
  const afterReload = processDueTicks(reloaded, STOCKS, rng, now, 5)
  assert.equal(afterReload.ticksProcessed, 0, 'reloading and checking again at the same moment does not reprocess the tick')
}

// 9. Missed ticks while the game was closed are caught up automatically and silently, and never touch cash — including across a closed weekend.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const fridayNearClose = new Date(2024, 0, 12, 16, 55)
  const withTick: GameState = { ...state, lastTickAt: fridayNearClose.toISOString(), currentSessionKey: '2024-01-12' }
  const mondayMorning = new Date(2024, 0, 15, 9, 20)
  const cashBefore = withTick.cash
  const caughtUp = processDueTicks(withTick, STOCKS, rng, mondayMorning, 50)
  assert.ok(caughtUp.ticksProcessed > 0, 'at least one tick is processed once the market reopens Monday')
  assert.equal(caughtUp.state.cash, cashBefore, 'catching up on missed ticks never changes cash')
  assert.ok(verifyLedgerIntegrity(caughtUp.state).ok)
  const lastTick = new Date(caughtUp.state.lastTickAt)
  assert.equal(lastTick.getDay(), 1, 'catch-up resumes on Monday, never simulating a tick during the closed weekend')
}

// 10. Catch-up is bounded by maxTicks even when far more ticks are technically due, so a long absence can never trigger an unbounded loop.
{
  const state = createInitialState(DEFAULT_PREFERENCES)
  const withTick: GameState = { ...state, lastTickAt: MONDAY_OPEN.toISOString() }
  const muchLater = new Date(2024, 0, 8, 16, 55) // ~8 trading hours later — roughly 95 ticks would technically be due
  const bounded = processDueTicks(withTick, STOCKS, rng, muchLater, 10)
  assert.equal(bounded.ticksProcessed, 10, 'catch-up stops at maxTicks rather than processing everything technically due')
}

console.log('Market Masters real-time market tests passed')

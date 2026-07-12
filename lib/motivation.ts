export const MOTIVATION_UPDATED_EVENT = 'airnexus:motivation-updated'

export type MotivationEvent = {
  id: string
  xp: number
  description: string
  createdAt: string
  room?: string
}

export type MotivationState = {
  version: 1
  lifetimeXp: number
  dailyGoalXp: number
  weeklyGoalXp: number
  events: MotivationEvent[]
  unlockedAchievements: string[]
}

export type MotivationAchievement = {
  id: string
  title: string
  description: string
  badge: string
}

export type MotivationStats = {
  level: number
  levelXp: number
  nextLevelXp: number
  levelProgress: number
  dailyXp: number
  weeklyXp: number
  dailyProgress: number
  weeklyProgress: number
  currentStreak: number
  longestStreak: number
  unlockedAchievementIds: string[]
}

export type MotivationCelebration = {
  title: string
  detail: string
}

export const MOTIVATION_ACHIEVEMENTS: MotivationAchievement[] = [
  { id: 'first-step', title: 'First Step', description: 'Earn your first 10 XP', badge: 'Starter' },
  { id: 'daily-goal', title: 'Daily Momentum', description: 'Reach a daily study goal', badge: 'Goal Getter' },
  { id: 'weekly-goal', title: 'Strong Week', description: 'Reach a weekly study goal', badge: 'Week Builder' },
  { id: 'streak-3', title: 'Three-Day Rhythm', description: 'Study for 3 days in a row', badge: 'Momentum' },
  { id: 'streak-7', title: 'Seven-Day Streak', description: 'Study for 7 days in a row', badge: 'Consistency' },
  { id: 'tasks-5', title: 'Task Tamer', description: 'Complete 5 study tasks', badge: 'Task Tamer' },
  { id: 'ai-10', title: 'Curious Mind', description: 'Complete 10 AI study sessions', badge: 'Curious Mind' },
  { id: 'level-5', title: 'Level Five', description: 'Reach level 5', badge: 'Scholar' },
]

const DEFAULT_STATE: MotivationState = {
  version: 1,
  lifetimeXp: 0,
  dailyGoalXp: 40,
  weeklyGoalXp: 200,
  events: [],
  unlockedAchievements: [],
}

const XP_PER_LEVEL = 200
/** Bounds the locally-stored event log. lifetimeXp and unlockedAchievements are each persisted as their own running-total field (not re-derived from the full event history), so trimming old events never loses XP or un-earns a badge — the one accuracy tradeoff is that a longestStreak set further back than this many events can become invisible, which is a far better failure mode than the unbounded array eventually hitting the browser's localStorage quota and throwing on every future write. */
const MAX_STORED_EVENTS = 1000

export function motivationStorageKey(userId: string) {
  return `airnexus-motivation-v1:${userId}`
}

export function createMotivationState(): MotivationState {
  return { ...DEFAULT_STATE, events: [], unlockedAchievements: [] }
}

function validEvent(value: unknown): value is MotivationEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<MotivationEvent>
  return typeof event.id === 'string'
    && typeof event.xp === 'number'
    && Number.isFinite(event.xp)
    && event.xp > 0
    && typeof event.description === 'string'
    && typeof event.createdAt === 'string'
}

export function parseMotivationState(raw: string | null): MotivationState {
  if (!raw) return createMotivationState()
  try {
    const value = JSON.parse(raw) as Partial<MotivationState>
    const events = Array.isArray(value.events) ? value.events.filter(validEvent) : []
    const eventXp = events.reduce((sum, event) => sum + event.xp, 0)
    return {
      version: 1,
      lifetimeXp: typeof value.lifetimeXp === 'number' && Number.isFinite(value.lifetimeXp)
        ? Math.max(eventXp, Math.round(value.lifetimeXp))
        : eventXp,
      dailyGoalXp: clampGoal(value.dailyGoalXp, 40, 10, 500),
      weeklyGoalXp: clampGoal(value.weeklyGoalXp, 200, 50, 3000),
      events,
      unlockedAchievements: Array.isArray(value.unlockedAchievements)
        ? value.unlockedAchievements.filter((id): id is string => typeof id === 'string')
        : [],
    }
  } catch {
    return createMotivationState()
  }
}

function clampGoal(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date: Date) {
  const start = new Date(date)
  const day = start.getDay()
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
  start.setHours(0, 0, 0, 0)
  return start
}

function studyDateKeys(events: MotivationEvent[]) {
  return new Set(events.map((event) => localDateKey(new Date(event.createdAt))))
}

function streaks(events: MotivationEvent[], now: Date) {
  const dates = studyDateKeys(events)
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)

  let current = 0
  while (dates.has(localDateKey(cursor))) {
    current += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  const ordered = Array.from(dates).sort()
  let longest = 0
  let run = 0
  let previous: Date | null = null
  for (const key of ordered) {
    const date = new Date(`${key}T12:00:00`)
    if (previous) {
      const expected = new Date(previous)
      expected.setDate(expected.getDate() + 1)
      run = localDateKey(expected) === key ? run + 1 : 1
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    previous = date
  }
  return { current, longest }
}

function achievementIds(state: MotivationState, stats: Omit<MotivationStats, 'unlockedAchievementIds'>) {
  const completedTasks = state.events.filter((event) => event.description.toLowerCase().startsWith('completed task')).length
  const aiSessions = state.events.filter((event) => event.description.toLowerCase().includes('ai study')).length
  const earned = [
    state.lifetimeXp >= 10 && 'first-step',
    stats.dailyXp >= state.dailyGoalXp && 'daily-goal',
    stats.weeklyXp >= state.weeklyGoalXp && 'weekly-goal',
    stats.longestStreak >= 3 && 'streak-3',
    stats.longestStreak >= 7 && 'streak-7',
    completedTasks >= 5 && 'tasks-5',
    aiSessions >= 10 && 'ai-10',
    stats.level >= 5 && 'level-5',
  ].filter((id): id is string => Boolean(id))
  return Array.from(new Set([...state.unlockedAchievements, ...earned]))
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Real per-weekday XP totals for the current week (Monday-start, matching startOfWeek), for charting actual study activity instead of invented numbers. */
export function getWeeklyXpBreakdown(state: MotivationState, now = new Date()): Array<{ day: string; xp: number }> {
  const start = startOfWeek(now)
  const totals = WEEKDAY_LABELS.map((day, index) => {
    const date = new Date(start)
    date.setDate(date.getDate() + index)
    return { day, key: localDateKey(date), xp: 0 }
  })
  for (const event of state.events) {
    const key = localDateKey(new Date(event.createdAt))
    const bucket = totals.find((entry) => entry.key === key)
    if (bucket) bucket.xp += event.xp
  }
  return totals.map(({ day, xp }) => ({ day, xp }))
}

export function getMotivationStats(state: MotivationState, now = new Date()): MotivationStats {
  const today = localDateKey(now)
  const weekStart = startOfWeek(now).getTime()
  const dailyXp = state.events.reduce((sum, event) => localDateKey(new Date(event.createdAt)) === today ? sum + event.xp : sum, 0)
  const weeklyXp = state.events.reduce((sum, event) => new Date(event.createdAt).getTime() >= weekStart ? sum + event.xp : sum, 0)
  const level = Math.floor(state.lifetimeXp / XP_PER_LEVEL) + 1
  const levelXp = state.lifetimeXp % XP_PER_LEVEL
  const streak = streaks(state.events, now)
  const base = {
    level,
    levelXp,
    nextLevelXp: XP_PER_LEVEL,
    levelProgress: Math.min(100, (levelXp / XP_PER_LEVEL) * 100),
    dailyXp,
    weeklyXp,
    dailyProgress: Math.min(100, (dailyXp / state.dailyGoalXp) * 100),
    weeklyProgress: Math.min(100, (weeklyXp / state.weeklyGoalXp) * 100),
    currentStreak: streak.current,
    longestStreak: streak.longest,
  }
  return { ...base, unlockedAchievementIds: achievementIds(state, base) }
}

/** Never lets a storage failure (quota exceeded, private-browsing restrictions) throw into the calling UI action — XP recording degrades to "not saved this time" instead of crashing whatever triggered it (task completion, chat reply, etc.). */
function writeState(userId: string, state: MotivationState) {
  try {
    window.localStorage.setItem(motivationStorageKey(userId), JSON.stringify(state))
  } catch (error) {
    console.warn('Could not save study progress locally:', error instanceof Error ? error.message : error)
    return
  }
  window.dispatchEvent(new CustomEvent(MOTIVATION_UPDATED_EVENT, { detail: { userId } }))
}

export function loadMotivationState(userId: string) {
  if (typeof window === 'undefined') return createMotivationState()
  return parseMotivationState(window.localStorage.getItem(motivationStorageKey(userId)))
}

export function recordMotivationActivity(
  userId: string,
  activity: { id: string; xp: number; description: string; room?: string },
): { state: MotivationState; celebration: MotivationCelebration | null; recorded: boolean } {
  const current = loadMotivationState(userId)
  if (!activity.id || !Number.isFinite(activity.xp) || activity.xp <= 0 || current.events.some((event) => event.id === activity.id)) {
    return { state: current, celebration: null, recorded: false }
  }

  const before = getMotivationStats(current)
  const event: MotivationEvent = {
    id: activity.id,
    xp: Math.round(activity.xp),
    description: activity.description,
    createdAt: new Date().toISOString(),
    room: activity.room,
  }
  const pending: MotivationState = {
    ...current,
    lifetimeXp: current.lifetimeXp + event.xp,
    events: [event, ...current.events].slice(0, MAX_STORED_EVENTS),
  }
  const after = getMotivationStats(pending)
  const newAchievements = after.unlockedAchievementIds.filter((id) => !before.unlockedAchievementIds.includes(id))
  const next = { ...pending, unlockedAchievements: after.unlockedAchievementIds }
  writeState(userId, next)

  let celebration: MotivationCelebration | null = null
  if (after.level > before.level) {
    celebration = { title: `Level ${after.level} reached`, detail: `Your steady work added ${event.xp} XP.` }
  } else if (newAchievements.length > 0) {
    const achievement = MOTIVATION_ACHIEVEMENTS.find((item) => item.id === newAchievements[0])
    if (achievement) celebration = { title: achievement.title, detail: `Badge unlocked: ${achievement.badge}` }
  }
  return { state: next, celebration, recorded: true }
}

export function updateMotivationGoals(userId: string, dailyGoalXp: number, weeklyGoalXp: number) {
  const current = loadMotivationState(userId)
  const next = {
    ...current,
    dailyGoalXp: clampGoal(dailyGoalXp, current.dailyGoalXp, 10, 500),
    weeklyGoalXp: clampGoal(weeklyGoalXp, current.weeklyGoalXp, 50, 3000),
  }
  writeState(userId, next)
  return next
}

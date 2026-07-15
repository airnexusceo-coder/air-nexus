export type DailyChallengeTask = {
  id: string
  title: string
  description: string
  xpReward: number
  bonusCash: number
}

export const DAILY_CHALLENGE_TASKS: DailyChallengeTask[] = [
  { id: 'trade', title: 'Make a trade', description: 'Buy or sell any stock today.', xpReward: 15, bonusCash: 50 },
  { id: 'read-news', title: 'Read the news', description: 'Open a stock and review its recent news today.', xpReward: 10, bonusCash: 30 },
  { id: 'visit-learning', title: 'Visit the Learning Centre', description: 'Check out the Learning Centre today.', xpReward: 10, bonusCash: 30 },
  { id: 'check-portfolio', title: 'Check your portfolio', description: "Review your Portfolio dashboard today.", xpReward: 10, bonusCash: 30 },
]

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function todayDateKey(): string {
  return dateKey(new Date())
}

/** Deterministic per-calendar-day pick — same task for everyone on the same date, no server round-trip needed. */
export function pickDailyChallengeTask(forDateKey: string): DailyChallengeTask {
  let hash = 0
  for (let i = 0; i < forDateKey.length; i++) hash = (hash * 31 + forDateKey.charCodeAt(i)) >>> 0
  return DAILY_CHALLENGE_TASKS[hash % DAILY_CHALLENGE_TASKS.length]
}

export function getDailyChallengeTask(id: string): DailyChallengeTask | undefined {
  return DAILY_CHALLENGE_TASKS.find((task) => task.id === id)
}

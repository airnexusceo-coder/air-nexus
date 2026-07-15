import { computeDiversificationScore, computeIndustryAllocation, computeProfitLoss } from '@/lib/market-masters/market-engine'
import { LESSONS } from '@/lib/market-masters/lessons'
import { MISSION_DEFINITIONS } from '@/lib/market-masters/missions'
import { STOCKS } from '@/lib/market-masters/stocks'
import type { GameState, Stock } from '@/lib/market-masters/types'

export type ReportSection = {
  title: string
  body: string
  tone: 'positive' | 'neutral' | 'watch'
}

export type EndOfRoundReport = {
  headline: string
  sections: ReportSection[]
}

/**
 * Deliberately does not lead with "you made $X" — the brief asks for
 * feedback on decision quality and risk awareness, with performance as one
 * input among several rather than the sole judgment.
 */
export function generateEndOfRoundReport(state: GameState, stocks: Stock[] = STOCKS): EndOfRoundReport {
  const profitLoss = computeProfitLoss(state)
  const diversificationScore = computeDiversificationScore(state, stocks)
  const allocation = computeIndustryAllocation(state, stocks)
  const holdingCount = Object.values(state.holdings).filter((h) => h.shares > 0).length

  const sections: ReportSection[] = []

  sections.push({
    title: 'Diversification',
    tone: diversificationScore >= 60 ? 'positive' : diversificationScore >= 30 ? 'neutral' : 'watch',
    body:
      holdingCount === 0
        ? 'You have not bought any stocks yet, so there is nothing to diversify. Visit the Stock Market to make your first trade.'
        : diversificationScore >= 60
          ? `Strong spread — your holdings are diversified across ${allocation.length} industr${allocation.length === 1 ? 'y' : 'ies'}, which limits how much damage any single company's bad news can do.`
          : diversificationScore >= 30
            ? `Your portfolio has some spread across ${allocation.length} industr${allocation.length === 1 ? 'y' : 'ies'}, but a large share still sits in one or two positions. Consider spreading further.`
            : 'Your money is concentrated in very few positions. That can produce a bigger return if things go well, but it also means one bad result can hurt your whole portfolio.',
  })

  const strongDecisions = state.decisionLog.filter((entry) => entry.quality === 'strong').length
  const totalDecisions = state.decisionLog.length
  sections.push({
    title: 'Decision quality',
    tone: totalDecisions === 0 ? 'neutral' : strongDecisions / totalDecisions >= 0.6 ? 'positive' : 'watch',
    body:
      totalDecisions === 0
        ? 'No decision challenges answered yet — these appear in the News Feed and are a good way to practice thinking through hype and hard headlines.'
        : `You made the strongest choice in ${strongDecisions} of ${totalDecisions} decision challenges. ${strongDecisions / totalDecisions >= 0.6 ? 'That shows good instincts for slowing down and checking the substance behind a headline.' : 'Revisit the News Feed challenges to practice spotting hype and overreaction.'}`,
  })

  const identifiedCount = state.identifiedMisleadingNewsIds.length
  sections.push({
    title: 'Reading the news',
    tone: identifiedCount > 0 ? 'positive' : 'neutral',
    body: identifiedCount > 0
      ? `You correctly flagged ${identifiedCount} exaggerated headline${identifiedCount === 1 ? '' : 's'} in the News Feed. That skill — checking substance over drama — is one of the most useful investing habits there is.`
      : 'Try using the "Looks like hype?" flag on News Feed stories. Some headlines are written to sound bigger than the actual news.',
  })

  sections.push({
    title: 'Learning progress',
    tone: state.completedLessonIds.length === LESSONS.length ? 'positive' : 'neutral',
    body: `You have completed ${state.completedLessonIds.length} of ${LESSONS.length} lessons and ${state.completedMissionIds.length} of ${MISSION_DEFINITIONS.length} missions.`,
  })

  sections.push({
    title: 'Performance so far',
    tone: profitLoss.value >= 0 ? 'positive' : 'watch',
    body: `Your portfolio is ${profitLoss.value >= 0 ? 'up' : 'down'} ${Math.abs(profitLoss.percent).toFixed(1)}% since you started. Remember: a short simulated stretch like this says little about long-term investing skill — the habits above matter more than any single number.`,
  })

  const headline = profitLoss.value >= 0
    ? `Day ${state.day}: your portfolio is up ${profitLoss.percent.toFixed(1)}%`
    : `Day ${state.day}: your portfolio is down ${Math.abs(profitLoss.percent).toFixed(1)}%`

  return { headline, sections }
}

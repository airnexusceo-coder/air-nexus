import type { BoardMember, BoardRiskTolerance } from '@/lib/business-empire/types'

/** Board seats appear as real thresholds of outside ownership are crossed — a visible, explained consequence of raising capital, never a random event or a hidden mechanic. */
export const BOARD_SEAT_OWNERSHIP_THRESHOLDS = [20, 40, 60, 80]
export const MAX_BOARD_SEATS = BOARD_SEAT_OWNERSHIP_THRESHOLDS.length

/** The lowest founder ownership `sellShares` will ever allow — control can be diluted a great deal, but never sold away entirely through this one action. */
export const MIN_FOUNDER_OWNERSHIP_PERCENT = 10

const BOARD_ROLES = ['Investor Representative', 'Independent Director', 'Finance Director', 'Strategy Advisor']
const BOARD_NAMES = ['A. Whitfield', 'R. Delacroix', 'M. Okonkwo', 'S. Lindqvist', 'J. Marchetti', 'P. Sundaram']
const RISK_TOLERANCES: BoardRiskTolerance[] = ['cautious', 'balanced', 'aggressive']

export function generateBoardMember(id: string, year: number, seatIndex: number): BoardMember {
  return {
    id,
    name: BOARD_NAMES[seatIndex % BOARD_NAMES.length],
    role: BOARD_ROLES[seatIndex % BOARD_ROLES.length],
    riskTolerance: RISK_TOLERANCES[seatIndex % RISK_TOLERANCES.length],
    joinedYear: year,
  }
}

/** A simplified, explainable stand-in for a real share price: company value divided by a fixed nominal share count, so the number moves exactly in step with the valuation the player already sees everywhere else. */
const NOMINAL_SHARE_COUNT = 10_000

export function computeImpliedSharePrice(companyValue: number): number {
  return Math.round((companyValue / NOMINAL_SHARE_COUNT) * 100) / 100
}

export function computeOutsideOwnershipPercent(founderOwnershipPercent: number): number {
  return Math.round((100 - founderOwnershipPercent) * 100) / 100
}

/** How many board seats a given outside-ownership level has earned, capped at `MAX_BOARD_SEATS`. */
export function computeEarnedBoardSeats(outsideOwnershipPercent: number): number {
  return Math.min(MAX_BOARD_SEATS, BOARD_SEAT_OWNERSHIP_THRESHOLDS.filter((threshold) => outsideOwnershipPercent >= threshold).length)
}

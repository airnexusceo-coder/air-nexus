import type {
  DifficultyProfile,
  IndustryProfile,
  LawCategory,
  LegalCase,
  LegalCaseAction,
  LegalCaseOutcome,
  LegalCaseSeverity,
  LegalRiskProfile,
  OfferRiskLevel,
  QuestionableOffer,
  QuestionableOfferId,
} from '@/lib/business-empire/types'
import { INVESTIGATION_STAGE_ORDER } from '@/lib/business-empire/types'

/**
 * Every offer here is fictional and deliberately abstract — described only
 * by the decision it presents and the risk it carries, never by any
 * operational detail of how it would actually be carried out. The lawful
 * options (reject, investigate, consult lawyers, report, negotiate a lawful
 * alternative) are always at least as visible as accepting.
 */
type OfferTemplate = {
  offerId: QuestionableOfferId
  title: string
  description: string
  immediateBenefit: string
  riskLevel: OfferRiskLevel
  adviserRecommendation: string
  legalCategoriesAffected: LawCategory[]
  possibleDelayedConsequences: string[]
  benefitFactor: number
}

const OFFER_TEMPLATES: OfferTemplate[] = [
  {
    offerId: 'suspicious-supplier-discount', title: 'A Supplier Offers an Unusually Steep Discount',
    description: 'A supplier offers materials far below market rate, on the condition that the arrangement stays off the usual paperwork.',
    immediateBenefit: 'Lower production costs this year.', riskLevel: 'medium',
    adviserRecommendation: 'Your accountant recommends declining or insisting on a fully documented contract.',
    legalCategoriesAffected: ['financial-reporting', 'corporate-tax'], possibleDelayedConsequences: ['An audit could uncover the undocumented arrangement.', 'The supplier relationship could sour if the arrangement is later exposed.'],
    benefitFactor: 8,
  },
  {
    offerId: 'unreported-payment', title: 'An Unreported Payment Is Suggested',
    description: 'A business contact suggests a payment arranged outside normal financial reporting to speed up an approval.',
    immediateBenefit: 'A faster approval this year.', riskLevel: 'high',
    adviserRecommendation: 'Your lawyer strongly recommends against this — financial reporting laws exist for a reason.',
    legalCategoriesAffected: ['financial-reporting', 'anti-monopoly'], possibleDelayedConsequences: ['Financial reporting violations carry serious penalties if discovered.', 'Employees who process the payment may later become witnesses.'],
    benefitFactor: 10,
  },
  {
    offerId: 'insider-information', title: 'Non-Public Information Is Offered',
    description: 'A contact offers early, non-public information about a competitor\'s upcoming move.',
    immediateBenefit: 'A head start on a competitive decision.', riskLevel: 'medium',
    adviserRecommendation: 'Your lawyer notes that acting on non-public information carries real legal exposure.',
    legalCategoriesAffected: ['anti-monopoly'], possibleDelayedConsequences: ['If the source is investigated, your use of the information could be traced.'],
    benefitFactor: 6,
  },
  {
    offerId: 'safety-shortcut', title: 'A Safety Testing Shortcut Is Proposed',
    description: 'A production manager proposes skipping a round of safety testing to hit a launch deadline.',
    immediateBenefit: 'An earlier product launch.', riskLevel: 'high',
    adviserRecommendation: 'Your safety inspector strongly recommends keeping the full testing schedule.',
    legalCategoriesAffected: ['product-safety'], possibleDelayedConsequences: ['A safety defect reaching customers could trigger a recall and injuries.', 'Regulators treat skipped safety testing especially seriously.'],
    benefitFactor: 7,
  },
  {
    offerId: 'false-environmental-certification', title: 'A Shortcut to an Environmental Certification',
    description: 'A consultant offers to secure an environmental certification without the usual site audit.',
    immediateBenefit: 'A marketable environmental certification this year.', riskLevel: 'high',
    adviserRecommendation: 'Your environmental specialist recommends the real audit process instead.',
    legalCategoriesAffected: ['environmental-standards', 'advertising-claims'], possibleDelayedConsequences: ['A false certification discovered later becomes both an environmental and an advertising violation.'],
    benefitFactor: 6,
  },
  {
    offerId: 'price-fixing-invitation', title: 'Competitors Suggest Coordinating Prices',
    description: 'Representatives from competing companies suggest informally coordinating prices instead of competing on them.',
    immediateBenefit: 'More predictable pricing and margins.', riskLevel: 'severe',
    adviserRecommendation: 'Your lawyer says this is exactly what anti-monopoly law exists to prevent — decline and consider reporting it.',
    legalCategoriesAffected: ['anti-monopoly'], possibleDelayedConsequences: ['Price-fixing is among the most aggressively investigated and penalised forms of misconduct.'],
    benefitFactor: 12,
  },
  {
    offerId: 'improper-political-favour', title: 'A Favour Is Suggested in Exchange for a Permit',
    description: 'An official suggests a personal favour could smooth the way for a pending building permit.',
    immediateBenefit: 'A faster building permit.', riskLevel: 'severe',
    adviserRecommendation: 'Your lawyer recommends reporting this rather than engaging with it.',
    legalCategoriesAffected: ['building-permits', 'zoning'], possibleDelayedConsequences: ['Improper dealings with officials are treated as serious misconduct if uncovered.'],
    benefitFactor: 9,
  },
  {
    offerId: 'misleading-advertising-proposal', title: 'An Agency Proposes Exaggerated Claims',
    description: 'Your advertising agency proposes marketing claims that go beyond what your product can actually back up.',
    immediateBenefit: 'Stronger short-term advertising reach.', riskLevel: 'medium',
    adviserRecommendation: 'Your lawyer recommends claims that can be substantiated.',
    legalCategoriesAffected: ['advertising-claims'], possibleDelayedConsequences: ['Regulators and journalists both check advertising claims against reality.'],
    benefitFactor: 5,
  },
  {
    offerId: 'hidden-product-defect', title: 'A Known Defect Could Stay Quiet',
    description: 'Testing reveals a minor defect in a shipped product. A manager suggests it is unlikely to be noticed.',
    immediateBenefit: 'Avoiding the cost of a recall this year.', riskLevel: 'high',
    adviserRecommendation: 'Your safety inspector recommends full disclosure and a proactive response.',
    legalCategoriesAffected: ['product-safety', 'product-warranties'], possibleDelayedConsequences: ['A defect that surfaces publicly after being known about internally is treated far more seriously than one reported early.'],
    benefitFactor: 7,
  },
  {
    offerId: 'questionable-tax-scheme', title: 'An Aggressive Tax Scheme Is Pitched',
    description: 'An advisor pitches a tax arrangement that pushes well past the usual interpretation of the rules.',
    immediateBenefit: 'A significantly lower tax bill this year.', riskLevel: 'high',
    adviserRecommendation: 'Your accountant recommends a conventional filing instead.',
    legalCategoriesAffected: ['corporate-tax', 'financial-reporting'], possibleDelayedConsequences: ['Aggressive tax schemes are a common audit trigger.'],
    benefitFactor: 9,
  },
]

const RISK_WEIGHT: Record<OfferRiskLevel, number> = { low: 1, medium: 2, high: 3, severe: 5 }

function unitCost(industry: IndustryProfile): number {
  return Math.max(20, industry.averagePrice)
}

export function computeLegalCaseActionCost(action: LegalCaseAction, industry: IndustryProfile, difficulty: DifficultyProfile): number {
  const base = unitCost(industry) * difficulty.costMultiplier
  switch (action) {
    case 'hire-legal-representation': return Math.round(base * 15)
    case 'internal-investigation': return Math.round(base * 10)
    case 'compensate-customers': return Math.round(base * 20)
    case 'settle-civil-claims': return Math.round(base * 30)
    case 'replace-executives': return Math.round(base * 12)
    case 'improve-compliance': return Math.round(base * 8)
    case 'cooperate':
    case 'contest-allegations':
    default: return 0
  }
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** A small yearly chance of a new offer appearing — never more than one pending at a time, so the player is never asked to juggle several at once. */
export function generateQuestionableOffer(hasPendingOffer: boolean, difficulty: DifficultyProfile, year: number, rng: () => number): QuestionableOffer | null {
  if (hasPendingOffer) return null
  const chance = 0.06 * difficulty.volatility
  if (rng() >= chance) return null
  const template = OFFER_TEMPLATES[Math.floor(rng() * OFFER_TEMPLATES.length)]
  return {
    id: createId('offer'),
    offerId: template.offerId,
    title: template.title,
    description: template.description,
    immediateBenefit: template.immediateBenefit,
    riskLevel: template.riskLevel,
    adviserRecommendation: template.adviserRecommendation,
    legalCategoriesAffected: template.legalCategoriesAffected,
    possibleDelayedConsequences: template.possibleDelayedConsequences,
    yearOffered: year,
    resolvedYear: null,
    response: null,
  }
}

export function computeOfferBenefit(offer: QuestionableOffer, industry: IndustryProfile, difficulty: DifficultyProfile): number {
  const template = OFFER_TEMPLATES.find((item) => item.offerId === offer.offerId)
  if (!template) return 0
  return Math.round((unitCost(industry) * template.benefitFactor * difficulty.costMultiplier) / 50) * 50
}

/**
 * Applies the consequences of a response to the company's legal-risk
 * profile. Accepting always raises risk in proportion to how severe the
 * offer was; every lawful response (reject, investigate, consult lawyers,
 * report, negotiate a lawful alternative) either leaves risk unchanged or
 * lowers it slightly — never a shortcut that also happens to be safe.
 */
export function applyOfferResponseToLegalRisk(risk: LegalRiskProfile, offer: QuestionableOffer, response: QuestionableOffer['response']): LegalRiskProfile {
  const weight = RISK_WEIGHT[offer.riskLevel]
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
  switch (response) {
    case 'accept':
      return {
        ...risk,
        suspicion: clamp(risk.suspicion + weight * 4),
        availableEvidence: clamp(risk.availableEvidence + weight * 3),
        civilLiability: clamp(risk.civilLiability + weight * 3),
        criminalExposure: clamp(risk.criminalExposure + weight * (offer.riskLevel === 'severe' ? 6 : 3)),
        employeeKnowledge: clamp(risk.employeeKnowledge + weight * 5),
        previousViolations: risk.previousViolations + 1,
      }
    case 'consult-lawyers':
      return { ...risk, suspicion: clamp(risk.suspicion - 1) }
    case 'report':
      return { ...risk, suspicion: clamp(risk.suspicion - 4), availableEvidence: clamp(risk.availableEvidence - 2) }
    case 'investigate':
    case 'reject':
    case 'negotiate-lawful-alternative':
    default:
      return risk
  }
}

/** Weak compliance, real evidence, repeated violations, and public/employee awareness all genuinely raise the odds — never a pure coin flip disconnected from the company's actual conduct. */
export function computeInvestigationTriggerChance(risk: LegalRiskProfile, averageComplianceRating: number, difficulty: DifficultyProfile): number {
  const base = (risk.suspicion * 0.4 + risk.availableEvidence * 0.35 + risk.employeeKnowledge * 0.15 + risk.publicAwareness * 0.1) / 100
  const violationPressure = Math.min(0.25, risk.previousViolations * 0.05)
  const complianceRelief = (averageComplianceRating / 100) * 0.15
  return Math.max(0, Math.min(0.6, (base + violationPressure - complianceRelief) * 0.5 * difficulty.volatility))
}

export function classifyCaseSeverity(risk: LegalRiskProfile): LegalCaseSeverity {
  const score = risk.criminalExposure * 0.5 + risk.civilLiability * 0.3 + risk.previousViolations * 5
  if (score >= 70) return 'severe'
  if (score >= 45) return 'serious'
  if (score >= 20) return 'moderate'
  return 'minor'
}

/** Every active case advances exactly one stage per year it remains open — predictable pacing, not a hidden dice roll on top of an already-uncertain outcome. */
export function advanceCaseStage(legalCase: LegalCase, year: number): LegalCase {
  const currentIndex = INVESTIGATION_STAGE_ORDER.indexOf(legalCase.stage)
  if (currentIndex >= INVESTIGATION_STAGE_ORDER.length - 1) return legalCase
  return { ...legalCase, stage: INVESTIGATION_STAGE_ORDER[currentIndex + 1], stageEnteredYear: year }
}

/**
 * Resolves a case once it reaches judgment. Cooperation, legal
 * representation, compensating customers, and improving compliance all
 * push the outcome toward leniency; contesting strong evidence despite
 * severe exposure and repeated violations is the only path that can reach
 * founder-imprisonment — matching "only after serious/repeated decisions,
 * strong evidence, ignored warnings, and a failed defence."
 */
export function resolveCaseOutcome(legalCase: LegalCase, risk: LegalRiskProfile, rng: () => number): LegalCaseOutcome {
  const actions = new Set(legalCase.actionsTaken)
  let leniency = 0
  if (actions.has('cooperate')) leniency += 15
  if (actions.has('hire-legal-representation')) leniency += 10
  if (actions.has('internal-investigation')) leniency += 8
  if (actions.has('compensate-customers')) leniency += 10
  if (actions.has('improve-compliance')) leniency += 8
  if (actions.has('replace-executives')) leniency += 6
  if (actions.has('settle-civil-claims')) leniency += 12
  const contested = actions.has('contest-allegations')
  const severityScore = risk.criminalExposure * 0.5 + risk.civilLiability * 0.3 + risk.previousViolations * 6 - leniency
  const strongEvidence = risk.availableEvidence >= 65

  if (severityScore < 10 && !contested) return 'acquitted'
  if (legalCase.severity === 'severe' && contested && strongEvidence && risk.previousViolations >= 2 && risk.criminalExposure >= 70) {
    return rng() < 0.5 ? 'founder-imprisonment' : 'company-dissolution'
  }
  if (severityScore >= 70) return contested && strongEvidence ? 'trading-restriction' : 'facility-closure'
  if (severityScore >= 50) return 'contract-cancellation'
  if (severityScore >= 35) return 'product-recall'
  if (severityScore >= 20) return 'fine'
  return 'warning'
}

export function computeCaseFinancialImpact(outcome: LegalCaseOutcome, industry: IndustryProfile, difficulty: DifficultyProfile): number {
  const base = unitCost(industry) * difficulty.costMultiplier
  switch (outcome) {
    case 'acquitted': return 0
    case 'warning': return Math.round(base * 3)
    case 'fine': return Math.round(base * 25)
    case 'product-recall': return Math.round(base * 60)
    case 'contract-cancellation': return Math.round(base * 40)
    case 'facility-closure': return Math.round(base * 90)
    case 'executive-removal': return Math.round(base * 20)
    case 'trading-restriction': return Math.round(base * 70)
    case 'company-dissolution': return Math.round(base * 150)
    case 'founder-imprisonment': return Math.round(base * 100)
  }
}

export function computeCaseReputationImpact(outcome: LegalCaseOutcome): number {
  switch (outcome) {
    case 'acquitted': return 2
    case 'warning': return -3
    case 'fine': return -6
    case 'product-recall': return -12
    case 'contract-cancellation': return -8
    case 'facility-closure': return -18
    case 'executive-removal': return -10
    case 'trading-restriction': return -20
    case 'company-dissolution': return -30
    case 'founder-imprisonment': return -35
  }
}

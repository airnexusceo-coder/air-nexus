import {
  getScalingAdjustment,
  getScalingTable,
  type AtarCurriculum,
} from './atar/atar-scaling-data'

export type GradeAssessmentInput = {
  score: number
  total: number
  weight: number
}

export type AtarSubjectInput = {
  subjectId: string
  rawScore: number
}

export type AutomaticAtarInput = {
  curriculum: AtarCurriculum
  examYear?: number
  subjects: AtarSubjectInput[]
}

export function calculateGrade(assessments: GradeAssessmentInput[], target: number) {
  const valid = assessments.filter((item) =>
    Number.isFinite(item.score) && Number.isFinite(item.total) && Number.isFinite(item.weight) &&
    item.total > 0 && item.score >= 0 && item.score <= item.total && item.weight > 0 && item.weight <= 100,
  )
  const scoreTotal = valid.reduce((sum, item) => sum + item.score, 0)
  const possibleTotal = valid.reduce((sum, item) => sum + item.total, 0)
  const usedWeight = valid.reduce((sum, item) => sum + item.weight, 0)
  const weightedPoints = valid.reduce((sum, item) => sum + (item.score / item.total) * item.weight, 0)
  const remaining = Math.max(0, 100 - usedWeight)
  const needed = remaining > 0 && Number.isFinite(target) ? ((target - weightedPoints) / remaining) * 100 : null
  return {
    current: possibleTotal ? (scoreTotal / possibleTotal) * 100 : 0,
    weighted: usedWeight ? (weightedPoints / usedWeight) * 100 : 0,
    weightedPoints,
    usedWeight,
    remaining,
    needed,
    validCount: valid.length,
  }
}

export function calculateAtarAutomatic(input: AutomaticAtarInput) {
  const table = getScalingTable(input.curriculum, input.examYear)
  const warnings: string[] = []
  const errors: string[] = []
  if (!table) {
    return { aggregate: 0, lower: 0, upper: 0, breakdown: [], warnings, errors: [`Scaling data is not available for ${input.curriculum}.`], scalingYear: null }
  }
  if (input.examYear && input.examYear !== table.examYear) {
    warnings.push(`Scaling data for ${input.examYear} is unavailable; using the ${table.examYear} estimate.`)
  }
  if (table.status !== 'official') {
    warnings.push(`${table.sourceLabel} are placeholders and are not official VTAC scaling data.`)
  }

  const breakdown = input.subjects.flatMap((inputSubject, index) => {
    if (!Number.isFinite(inputSubject.rawScore) || inputSubject.rawScore < 0 || inputSubject.rawScore > 50) {
      errors.push(`Subject ${index + 1} has an invalid score. Enter a value from 0 to 50.`)
      return []
    }
    const subject = table.subjects.find((candidate) => candidate.id === inputSubject.subjectId)
    if (!subject) {
      warnings.push(`No scaling data was found for ${inputSubject.subjectId || `subject ${index + 1}`}; it was excluded from this estimate.`)
      return []
    }
    const adjustment = getScalingAdjustment(subject, inputSubject.rawScore)
    if (adjustment === null) {
      warnings.push(`No scaling points were found for ${subject.name}; it was excluded from this estimate.`)
      return []
    }
    return [{
      subjectId: subject.id,
      subject: subject.name,
      rawScore: inputSubject.rawScore,
      scaledScore: Math.max(0, Math.min(55, inputSubject.rawScore + adjustment)),
      adjustment,
      isEnglish: Boolean(subject.isEnglish),
    }]
  })

  if (!breakdown.some((subject) => subject.isEnglish)) errors.push('Select at least one English-group subject.')
  if (breakdown.length < 4) errors.push('Enter an English-group subject and at least three other valid subjects.')

  const selectedEnglish = breakdown.filter((subject) => subject.isEnglish).sort((a, b) => b.scaledScore - a.scaledScore)[0]
  const english = selectedEnglish?.scaledScore ?? 0
  const others = breakdown.filter((subject) => subject !== selectedEnglish).sort((a, b) => b.scaledScore - a.scaledScore)
  const primary = others.slice(0, 3).reduce((sum, subject) => sum + subject.scaledScore, 0)
  const increments = others.slice(3, 5).reduce((sum, subject) => sum + subject.scaledScore * 0.1, 0)
  const aggregate = english + primary + increments
  const midpoint = Math.max(0, Math.min(99.95, 40 + (aggregate - 80) * 0.46))
  return {
    aggregate,
    lower: Math.max(0, midpoint - 3),
    upper: Math.min(99.95, midpoint + 3),
    breakdown,
    warnings,
    errors,
    scalingYear: table.examYear,
  }
}
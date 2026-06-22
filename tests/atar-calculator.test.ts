import assert from 'node:assert/strict'
import { calculateAtarAutomatic } from '../lib/calculator-results'

const baseSubjects = [
  { subjectId: 'vce-english', rawScore: 35 },
  { subjectId: 'vce-mathematical-methods', rawScore: 40 },
  { subjectId: 'vce-chemistry', rawScore: 35 },
  { subjectId: 'vce-biology', rawScore: 32 },
  { subjectId: 'vce-business-management', rawScore: 30 },
]

const automatic = calculateAtarAutomatic({ curriculum: 'VCE', examYear: 2025, subjects: baseSubjects })
const methods = automatic.breakdown.find((subject) => subject.subjectId === 'vce-mathematical-methods')
assert.equal(methods?.rawScore, 40, 'keeps the raw score')
assert.equal(methods?.adjustment, 5, 'applies the stored Methods adjustment automatically')
assert.equal(methods?.scaledScore, 45, 'returns the automatically scaled score')

const missing = calculateAtarAutomatic({
  curriculum: 'VCE',
  examYear: 2025,
  subjects: [...baseSubjects, { subjectId: 'vce-subject-not-in-table', rawScore: 35 }],
})
assert.ok(missing.warnings.some((warning) => warning.includes('No scaling data')), 'warns when subject scaling is missing')

const invalid = calculateAtarAutomatic({
  curriculum: 'VCE',
  examYear: 2025,
  subjects: [{ subjectId: 'vce-english', rawScore: 51 }, ...baseSubjects.slice(1)],
})
assert.ok(invalid.errors.some((error) => error.includes('invalid score')), 'rejects scores outside 0-50')

assert.equal(automatic.errors.length, 0, 'valid ATAR inputs have no calculation errors')
assert.equal(Number(automatic.aggregate.toFixed(1)), 153.7, 'calculates the expected aggregate')
assert.ok(automatic.lower > 0 && automatic.upper <= 99.95 && automatic.lower < automatic.upper, 'returns a valid estimated ATAR range')

console.log('ATAR automatic scaling tests passed')

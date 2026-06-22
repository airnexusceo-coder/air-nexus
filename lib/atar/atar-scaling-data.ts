export type AtarCurriculum = 'VCE' | 'HSC' | 'QCE' | 'SACE' | 'WACE'

export type ScalingPoint = {
  rawScore: number
  adjustment: number
}

export type AtarScalingSubject = {
  id: string
  name: string
  aliases: string[]
  isEnglish?: boolean
  points: ScalingPoint[]
}

export type AtarScalingTable = {
  curriculum: AtarCurriculum
  state: string
  examYear: number
  status: 'placeholder-estimate' | 'official'
  sourceLabel: string
  subjects: AtarScalingSubject[]
}

const points = (...adjustments: number[]): ScalingPoint[] =>
  [20, 25, 30, 35, 40, 45, 50].map((rawScore, index) => ({ rawScore, adjustment: adjustments[index] ?? 0 }))

// Replace this table with the published VTAC data for a new exam year. The
// calculator reads the table generically, so yearly updates require no UI or
// calculation changes. These values are illustrative estimates, not VTAC data.
export const VCE_SCALING_2025: AtarScalingTable = {
  curriculum: 'VCE',
  state: 'Victoria',
  examYear: 2025,
  status: 'placeholder-estimate',
  sourceLabel: 'AirGPT illustrative VCE scaling estimates',
  subjects: [
    { id: 'vce-english', name: 'English', aliases: ['English'], isEnglish: true, points: points(-2, -2, -1, 0, 1, 1, 0) },
    { id: 'vce-english-language', name: 'English Language', aliases: ['EngLang'], isEnglish: true, points: points(1, 1, 2, 2, 3, 3, 0) },
    { id: 'vce-literature', name: 'Literature', aliases: ['Lit'], isEnglish: true, points: points(0, 0, 1, 1, 2, 2, 0) },
    { id: 'vce-mathematical-methods', name: 'Mathematical Methods', aliases: ['Methods'], points: points(3, 4, 5, 5, 5, 4, 0) },
    { id: 'vce-specialist-mathematics', name: 'Specialist Mathematics', aliases: ['Specialist', 'Spesh'], points: points(6, 7, 8, 9, 10, 8, 0) },
    { id: 'vce-general-mathematics', name: 'General Mathematics', aliases: ['General Maths'], points: points(-4, -3, -2, -2, -1, 0, 0) },
    { id: 'vce-chemistry', name: 'Chemistry', aliases: [], points: points(1, 2, 3, 3, 4, 3, 0) },
    { id: 'vce-physics', name: 'Physics', aliases: [], points: points(1, 1, 2, 2, 3, 2, 0) },
    { id: 'vce-biology', name: 'Biology', aliases: [], points: points(0, 0, 1, 1, 1, 1, 0) },
    { id: 'vce-economics', name: 'Economics', aliases: [], points: points(0, 1, 2, 2, 3, 2, 0) },
    { id: 'vce-accounting', name: 'Accounting', aliases: [], points: points(-2, -2, -1, -1, 0, 0, 0) },
    { id: 'vce-business-management', name: 'Business Management', aliases: ['Business'], points: points(-4, -4, -3, -2, -1, 0, 0) },
    { id: 'vce-legal-studies', name: 'Legal Studies', aliases: ['Legal'], points: points(-3, -3, -2, -2, -1, 0, 0) },
    { id: 'vce-psychology', name: 'Psychology', aliases: ['Psych'], points: points(-3, -3, -2, -2, -1, 0, 0) },
    { id: 'vce-history-revolutions', name: 'History: Revolutions', aliases: ['Revolutions'], points: points(0, 0, 1, 1, 2, 1, 0) },
    { id: 'vce-health-human-development', name: 'Health and Human Development', aliases: ['HHD'], points: points(-5, -5, -4, -3, -2, -1, 0) },
    { id: 'vce-physical-education', name: 'Physical Education', aliases: ['PE'], points: points(-4, -4, -3, -2, -1, 0, 0) },
    { id: 'vce-french', name: 'French', aliases: [], points: points(4, 5, 6, 6, 7, 6, 0) },
  ],
}

export const ATAR_SCALING_TABLES: AtarScalingTable[] = [VCE_SCALING_2025]

export const SUPPORTED_ATAR_CURRICULA = [
  { code: 'VCE' as const, label: 'VCE · Victoria', supported: true },
  { code: 'HSC' as const, label: 'HSC · New South Wales (coming soon)', supported: false },
  { code: 'QCE' as const, label: 'QCE · Queensland (coming soon)', supported: false },
  { code: 'SACE' as const, label: 'SACE · South Australia (coming soon)', supported: false },
  { code: 'WACE' as const, label: 'WACE · Western Australia (coming soon)', supported: false },
]

export function getScalingTable(curriculum: AtarCurriculum, examYear?: number) {
  const matching = ATAR_SCALING_TABLES
    .filter((table) => table.curriculum === curriculum)
    .sort((a, b) => b.examYear - a.examYear)
  if (matching.length === 0) return null
  return matching.find((table) => table.examYear === examYear) ?? matching[0]
}

export function getScalingAdjustment(subject: AtarScalingSubject, rawScore: number) {
  const sorted = [...subject.points].sort((a, b) => a.rawScore - b.rawScore)
  if (sorted.length === 0) return null
  if (rawScore <= sorted[0].rawScore) return sorted[0].adjustment
  if (rawScore >= sorted[sorted.length - 1].rawScore) return sorted[sorted.length - 1].adjustment
  const upperIndex = sorted.findIndex((point) => point.rawScore >= rawScore)
  const lower = sorted[upperIndex - 1]
  const upper = sorted[upperIndex]
  const ratio = (rawScore - lower.rawScore) / (upper.rawScore - lower.rawScore)
  return lower.adjustment + (upper.adjustment - lower.adjustment) * ratio
}

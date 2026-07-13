import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

import { VCE_STUDY_DESIGN_SOURCE, type VceCourse } from '@/lib/courses/vce-catalog'
import { inferVcaaCommandTermsFromText } from '@/lib/courses/vcaa-command-terms'
import type { AiLessonCommandTerm } from '@/lib/courses/lesson-pack-types'

const INDEX_URL = VCE_STUDY_DESIGN_SOURCE.url
const MAX_STUDY_DESIGN_CHARACTERS = 80_000
const MAX_SECTION_ITEMS = 18

export type VcaaStudyDesignArea = {
  title: string
  outcome: string
  keyKnowledge: string[]
  keySkills: string[]
}

export type VcaaStudyDesignUnitSource = {
  sourceTitle: string
  sourceUrl: string
  documentUrl?: string
  text: string
  unitTitle: string
  areas: VcaaStudyDesignArea[]
  commandTerms: AiLessonCommandTerm[]
}

const COURSE_INDEX_ALIASES: Record<string, string[]> = {
  english: ['English and English as an Additional Language', 'English'],
  'english-eal': ['English and English as an Additional Language', 'English as an Additional Language'],
  'data-analytics': ['Applied Computing'],
  'software-development': ['Applied Computing'],
  'history-ancient': ['History'],
  'history-australian': ['History'],
  'history-revolutions': ['History'],
  french: ['Languages', 'French'],
  german: ['Languages', 'German'],
  italian: ['Languages', 'Italian'],
  'japanese-second-language': ['Languages', 'Japanese Second Language'],
  'chinese-second-language': ['Languages', 'Chinese Second Language'],
  spanish: ['Languages', 'Spanish'],
}

const COURSE_UNIT_HEADING_ALIASES: Record<string, string[]> = {
  'foundation-mathematics': ['Foundation Mathematics'],
  'general-mathematics': ['General Mathematics'],
  'mathematical-methods': ['Mathematical Methods'],
  'specialist-mathematics': ['Specialist Mathematics'],
  'data-analytics': ['Data Analytics'],
  'software-development': ['Software Development'],
  'history-ancient': ['Ancient History'],
  'history-australian': ['Australian History'],
  'history-revolutions': ['Revolutions'],
}

const DOCUMENT_REJECT_TERMS = [
  'administrative information',
  'authentication',
  'assessment report',
  'record form',
  'performance descriptors',
  'sample learning activities',
  'advice for teachers',
  'developing a program',
]

function normaliseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normaliseForMatch(value: string) {
  return normaliseWhitespace(decodeHtml(value)).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
}

function stripTags(value: string) {
  return normaliseWhitespace(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
}

function absoluteUrl(href: string, baseUrl: string) {
  const decoded = decodeHtml(href)
  if (/^sites\//i.test(decoded)) return new URL(`/${decoded}`, baseUrl).toString()
  return new URL(decoded, baseUrl).toString()
}

function courseAliases(course: VceCourse) {
  return [course.name, ...(COURSE_INDEX_ALIASES[course.id] ?? [])]
}

function anchorMatchesCourse(anchorText: string, course: VceCourse) {
  const text = normaliseForMatch(anchorText)
  return courseAliases(course).some((alias) => {
    const candidate = normaliseForMatch(alias)
    return text === candidate || text.includes(candidate)
  })
}

function looksLikeDocument(url: string) {
  return /\.(docx?|pdf)(?:[?#].*)?$/i.test(url)
}

async function fetchText(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal, cache: 'force-cache' })
  if (!response.ok) throw new Error(`Could not fetch VCAA source (${response.status})`)
  return response.text()
}

async function fetchArrayBuffer(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal, cache: 'force-cache' })
  if (!response.ok) throw new Error(`Could not fetch VCAA study design (${response.status})`)
  return response.arrayBuffer()
}

function anchorLinks(html: string, baseUrl: string) {
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  return Array.from(html.matchAll(anchorPattern)).map((match) => ({
    url: absoluteUrl(match[1] ?? '', baseUrl),
    text: stripTags(match[2] ?? ''),
  }))
}

async function findSubjectPageFromIndex(course: VceCourse, signal?: AbortSignal) {
  const html = await fetchText(INDEX_URL, signal)
  const match = anchorLinks(html, INDEX_URL).find((link) => !looksLikeDocument(link.url) && anchorMatchesCourse(link.text, course))
  return match?.url ?? INDEX_URL
}

function findNestedLanguagePageUrl(course: VceCourse, subjectHtml: string, subjectUrl: string) {
  if (course.category !== 'Languages') return null

  const courseName = normaliseForMatch(course.name)
  return anchorLinks(subjectHtml, subjectUrl).find((link) => {
    if (looksLikeDocument(link.url)) return false
    const text = normaliseForMatch(link.text)
    return text === courseName || text.includes(courseName)
  })?.url ?? null
}

async function findSubjectPageUrl(course: VceCourse, signal?: AbortSignal) {
  const initialUrl = course.studyDesign.sourceUrl !== INDEX_URL ? course.studyDesign.sourceUrl : await findSubjectPageFromIndex(course, signal)
  const initialHtml = await fetchText(initialUrl, signal)
  return findNestedLanguagePageUrl(course, initialHtml, initialUrl) ?? initialUrl
}

function documentScore(course: VceCourse, text: string, url: string) {
  const haystack = normaliseForMatch(`${text} ${url}`)
  if (DOCUMENT_REJECT_TERMS.some((term) => haystack.includes(normaliseForMatch(term)))) return -100

  let score = 0
  if (haystack.includes('study design')) score += 60
  if (haystack.includes('vce')) score += 10
  for (const alias of courseAliases(course)) {
    const candidate = normaliseForMatch(alias)
    if (candidate && haystack.includes(candidate)) score += 25
  }

  if ((course.id === 'data-analytics' || course.id === 'software-development') && haystack.includes('applied computing')) score += 30
  if (course.id.startsWith('history-') && haystack.includes('history')) score += 30
  if (course.category === 'Languages' && haystack.includes(normaliseForMatch(course.name))) score += 35
  return score
}

function findStudyDesignDocumentUrl(course: VceCourse, subjectHtml: string, subjectUrl: string) {
  const candidates = anchorLinks(subjectHtml, subjectUrl)
    .filter((link) => looksLikeDocument(link.url))
    .map((link) => ({ ...link, score: documentScore(course, link.text, link.url) }))
    .sort((a, b) => b.score - a.score)

  return candidates.find((candidate) => candidate.score > -100)?.url ?? null
}

function cleanExtractedText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\r\n]{2,}/g, ' ')
    .trim()
}

function normaliseLine(value: string) {
  return normaliseWhitespace(value.replace(/^[\u2022\-*\u2013\u2014]+\s*/, '').replace(/^o\s+/, ''))
}

function splitLines(value: string) {
  return cleanExtractedText(value).split('\n').map(normaliseLine).filter(Boolean)
}

function lineIsUnitHeading(line: string, unit?: 1 | 2 | 3 | 4) {
  const unitPart = unit ? `${unit}` : '[1-4]'
  return new RegExp(`^\\s*Unit\\s+${unitPart}\\b.{0,180}$`, 'i').test(line)
}

function lineMatchesPreferredUnitHeading(line: string, course: VceCourse, unit: 1 | 2 | 3 | 4) {
  if (!lineIsUnitHeading(line, unit)) return false
  const aliases = COURSE_UNIT_HEADING_ALIASES[course.id] ?? []
  if (aliases.length === 0) return true
  if (unit <= 2 && !course.id.includes('mathematics') && course.id !== 'mathematical-methods') return true
  const normalisedLine = normaliseForMatch(line)
  return aliases.some((alias) => normalisedLine.includes(normaliseForMatch(alias)))
}

function lineIsAreaHeading(line: string) {
  return /^Area of Study\s+\d+/i.test(line)
}

function lineStartsSection(line: string) {
  return lineIsAreaHeading(line) || /^Outcome\s+\d+/i.test(line) || /^Key knowledge$/i.test(line) || /^Key skills$/i.test(line) || /^Assessment/i.test(line) || lineIsUnitHeading(line)
}

function sectionTitle(lines: string[], index: number) {
  const current = lines[index] ?? 'Area of Study'
  const next = lines[index + 1]
  if (next && !lineStartsSection(next) && next.length <= 160) return `${current}: ${next}`
  return current
}

function collectUntilSection(lines: string[], startIndex: number, endPatterns: RegExp[]) {
  const items: string[] = []
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) continue
    if (endPatterns.some((pattern) => pattern.test(line))) break
    if (/^(Key knowledge|Key skills)$/i.test(line)) continue
    if (/^Area of Study\s+\d+/i.test(line)) break
    if (/^Outcome\s+\d+/i.test(line)) break
    if (/^Assessment/i.test(line)) break
    if (line.length < 4) continue
    items.push(line)
    if (items.length >= MAX_SECTION_ITEMS) break
  }
  return items
}

function firstOutcome(lines: string[]) {
  const outcomeIndex = lines.findIndex((line) => /^Outcome\s+\d+/i.test(line))
  if (outcomeIndex === -1) return ''
  const collected = [lines[outcomeIndex]]
  for (let index = outcomeIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line || /^Key knowledge$/i.test(line) || /^Key skills$/i.test(line) || lineIsAreaHeading(line) || lineIsUnitHeading(line) || /^Assessment/i.test(line)) break
    collected.push(line)
    if (collected.join(' ').length > 360) break
  }
  return normaliseWhitespace(collected.join(' '))
}

function extractNamedSection(lines: string[], heading: 'Key knowledge' | 'Key skills') {
  const index = lines.findIndex((line) => new RegExp(`^${heading}$`, 'i').test(line))
  if (index === -1) return []
  return collectUntilSection(lines, index + 1, [/^Key knowledge$/i, /^Key skills$/i, /^Outcome\s+\d+/i, /^Assessment/i])
}

function parseStudyDesignUnit(text: string, unit: 1 | 2 | 3 | 4) {
  const lines = splitLines(text)
  const unitTitle = lines.find((line) => lineIsUnitHeading(line, unit)) ?? `Unit ${unit}`
  const areaIndexes = lines.map((line, index) => ({ line, index })).filter((item) => lineIsAreaHeading(item.line)).map((item) => item.index)

  const areas = areaIndexes.map((startIndex, areaNumber) => {
    const nextAreaIndex = areaIndexes[areaNumber + 1] ?? lines.length
    const areaLines = lines.slice(startIndex, nextAreaIndex)
    return {
      title: sectionTitle(lines, startIndex),
      outcome: firstOutcome(areaLines),
      keyKnowledge: extractNamedSection(areaLines, 'Key knowledge'),
      keySkills: extractNamedSection(areaLines, 'Key skills'),
    }
  }).filter((area) => area.keyKnowledge.length > 0 || area.keySkills.length > 0 || area.outcome)

  return { unitTitle, areas }
}

function nextUnitHeadingIndex(lines: string[], startIndex: number) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lineIsUnitHeading(lines[index])) return index
  }
  return lines.length
}

function unitCandidateScore(lines: string[], startIndex: number) {
  const endIndex = nextUnitHeadingIndex(lines, startIndex)
  const window = lines.slice(startIndex, endIndex).join('\n')
  let score = 0
  if (/\bOutcome\s+\d+/i.test(window)) score += 30
  if (/\bKey knowledge\b/i.test(window)) score += 45
  if (/\bKey skills\b/i.test(window)) score += 45
  if (/\bArea of Study\s+\d+/i.test(window)) score += 15
  if (/\bAssessment\b/i.test(window)) score += 5
  if (/\bIntroduction\b|\bScope of study\b|\bStructure\b/i.test(window)) score -= 20
  if (endIndex - startIndex <= 20) score -= 100
  return score
}

function extractUnitText(fullText: string, course: VceCourse, unit: 1 | 2 | 3 | 4) {
  const lines = splitLines(fullText)
  const candidates = lines
    .map((line, index) => ({ line, index }))
    .filter((candidate) => lineMatchesPreferredUnitHeading(candidate.line, course, unit))
    .map((candidate) => ({ ...candidate, score: unitCandidateScore(lines, candidate.index) }))
    .sort((a, b) => b.score - a.score)

  const fallbackCandidates = lines
    .map((line, index) => ({ line, index }))
    .filter((candidate) => lineIsUnitHeading(candidate.line, unit))
    .map((candidate) => ({ ...candidate, score: unitCandidateScore(lines, candidate.index) }))
    .sort((a, b) => b.score - a.score)

  const startIndex = candidates[0]?.index ?? fallbackCandidates[0]?.index ?? -1
  if (startIndex === -1) return fullText.slice(0, MAX_STUDY_DESIGN_CHARACTERS)

  let endIndex = lines.length
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lineIsUnitHeading(lines[index]) && unitCandidateScore(lines, index) >= 40) {
      endIndex = index
      break
    }
  }

  return lines.slice(startIndex, endIndex).join('\n').slice(0, MAX_STUDY_DESIGN_CHARACTERS)
}

async function extractPdfText(arrayBuffer: ArrayBuffer) {
  const parser = new PDFParse({ data: Buffer.from(arrayBuffer) })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}

async function extractDocumentText(url: string, signal?: AbortSignal) {
  const arrayBuffer = await fetchArrayBuffer(url, signal)
  if (/\.docx(?:[?#].*)?$/i.test(url)) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) })
    return result.value
  }
  if (/\.pdf(?:[?#].*)?$/i.test(url)) {
    return extractPdfText(arrayBuffer)
  }
  return ''
}

function buildSource(course: VceCourse, unit: 1 | 2 | 3 | 4, subjectPageUrl: string, documentUrl: string | null, rawText: string): VcaaStudyDesignUnitSource {
  const unitText = extractUnitText(cleanExtractedText(rawText), course, unit)
  const parsed = parseStudyDesignUnit(unitText, unit)
  const commandText = [unitText, parsed.areas.map((area) => `${area.outcome}\n${area.keySkills.join('\n')}`).join('\n')].join('\n')

  return {
    sourceTitle: documentUrl ? `${course.name} VCE Study Design` : `${course.name} VCE study design page`,
    sourceUrl: subjectPageUrl,
    documentUrl: documentUrl ?? undefined,
    text: unitText,
    unitTitle: parsed.unitTitle,
    areas: parsed.areas,
    commandTerms: inferVcaaCommandTermsFromText(commandText, course.studyDesign.commandTerms),
  }
}

export async function loadVcaaStudyDesignUnitText(course: VceCourse, unit: 1 | 2 | 3 | 4, signal?: AbortSignal): Promise<VcaaStudyDesignUnitSource> {
  const subjectPageUrl = await findSubjectPageUrl(course, signal)
  const subjectHtml = await fetchText(subjectPageUrl, signal)
  const documentUrl = findStudyDesignDocumentUrl(course, subjectHtml, subjectPageUrl)

  if (!documentUrl) {
    return buildSource(course, unit, subjectPageUrl, null, stripTags(subjectHtml))
  }

  const documentText = await extractDocumentText(documentUrl, signal).catch(() => '')
  return buildSource(course, unit, subjectPageUrl, documentUrl, documentText || stripTags(subjectHtml))
}
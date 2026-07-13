import type { AiLessonCommandTerm } from '@/lib/courses/lesson-pack-types'
import type { VceCommandTerm } from '@/lib/courses/vce-catalog'

export const VCAA_COMMAND_TERMS_SOURCE = {
  label: 'VCAA Glossary of command terms',
  url: 'https://www.vcaa.vic.edu.au/assessment/vce/glossary-command-terms',
}

const OFFICIAL_COMMAND_TERMS: AiLessonCommandTerm[] = [
  { term: 'Analyse', meaning: 'Identify parts, relationships and implications in evidence, data, texts or ideas.', responseMove: 'Break the material into parts, explain the relationship, then state what it shows.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Apply', meaning: 'Use knowledge, a process or a rule in a particular situation.', responseMove: 'Name the relevant idea, connect it to the scenario and explain the result.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Assess', meaning: 'Make a judgement about value, quality, outcome, significance or extent.', responseMove: 'Use criteria, weigh the evidence and make the judgement explicit.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Calculate', meaning: 'Use mathematical processes to determine a numerical result from given information.', responseMove: 'Show the relevant stages of working, state the result and include units when needed.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Compare', meaning: 'Recognise similarities and differences and explain why they matter.', responseMove: 'Pair the evidence, name the similarity or difference and explain its significance.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Construct', meaning: 'Build or arrange ideas, information, an argument, artefact or solution.', responseMove: 'Organise the required parts logically and make the structure visible.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Contrast', meaning: 'Show how ideas, evidence, data or artefacts are different.', responseMove: 'State the points of difference and support each with specific evidence.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Define', meaning: 'Give the precise meaning and essential qualities of a term or concept.', responseMove: 'Use a concise definition and include the features that distinguish it.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Demonstrate', meaning: 'Show how something works or that something is true using examples or application.', responseMove: 'Show the process, example or evidence clearly enough that the claim is proven.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Describe', meaning: 'Provide accurate features, characteristics or qualities.', responseMove: 'State the relevant features in clear sequence and use subject vocabulary.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Discuss', meaning: 'Present a considered account that shows issues, strengths and weaknesses or points for and against.', responseMove: 'Develop both sides or factors, support them and keep the line of argument clear.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Distinguish', meaning: 'Make the differences between two or more things clear.', responseMove: 'Name each item, state the difference and avoid blending the concepts.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Evaluate', meaning: 'Make a judgement using information, criteria and evidence for and against.', responseMove: 'Set criteria, weigh strengths and limitations, then give a supported judgement.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Examine', meaning: 'Consider material closely to identify assumptions, possibilities or relationships.', responseMove: 'Look at the evidence from more than one angle and explain what is revealed.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Explain', meaning: 'Give a detailed account of why or how, including causes, effects, reasons or mechanisms.', responseMove: 'Link cause, process and result so the relationship is clear.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Extract', meaning: 'Select relevant details from a source, argument, issue or artefact.', responseMove: 'Choose only the information needed and connect it to the task.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Extrapolate', meaning: 'Infer or extend information by assuming an existing trend or pattern continues.', responseMove: 'Identify the trend, extend it carefully and state the assumption.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Identify', meaning: 'Recognise, name or select an event, feature, element or part.', responseMove: 'Give the precise item requested and avoid unsupported extra detail.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Infer', meaning: 'Derive a conclusion from evidence or reasoning rather than direct statement.', responseMove: 'Point to the evidence, explain the reasoning and state the conclusion.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Interpret', meaning: 'Draw meaning and significance from information, text, image, data or artwork in context.', responseMove: 'State the meaning, support it with evidence and explain the context.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Investigate', meaning: 'Observe, study or examine to establish facts and reach conclusions.', responseMove: 'Frame the question, gather evidence, analyse it and state what can be concluded.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Justify', meaning: 'Show, prove or defend a view or decision with reasoning and evidence.', responseMove: 'Make the claim clear, use evidence and explain why the evidence supports it.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Outline', meaning: 'Provide an overview or main features.', responseMove: 'Give the main points in order without overdeveloping minor detail.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Predict', meaning: 'State what is expected to happen based on evidence, patterns or reasoning.', responseMove: 'Use the pattern or principle, state the expected result and explain why.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Propose', meaning: 'Put forward an idea, action, explanation or solution for consideration.', responseMove: 'State the proposal, connect it to the problem and support its suitability.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Recommend', meaning: 'Put forward an advised option or course of action based on evidence.', responseMove: 'Name the option, justify it and acknowledge a key trade-off or condition.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Select', meaning: 'Choose the most relevant or appropriate item from options or information.', responseMove: 'Choose deliberately and give the reason if the task requires it.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Summarise', meaning: 'Express the main points briefly.', responseMove: 'Keep the central ideas and remove examples or minor details.', source: VCAA_COMMAND_TERMS_SOURCE.url },
  { term: 'Synthesise', meaning: 'Combine ideas, evidence or parts into a connected whole.', responseMove: 'Bring sources or concepts together and explain the new relationship or conclusion.', source: VCAA_COMMAND_TERMS_SOURCE.url },
]

const TERM_BY_LOWER = new Map(OFFICIAL_COMMAND_TERMS.map((term) => [term.term.toLowerCase(), term]))

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toOfficialTerm(term: VceCommandTerm): AiLessonCommandTerm {
  const official = TERM_BY_LOWER.get(term.term.toLowerCase())
  return official ?? { ...term, source: VCAA_COMMAND_TERMS_SOURCE.url }
}

export function getVcaaCommandTerm(term: string) {
  return TERM_BY_LOWER.get(term.toLowerCase()) ?? null
}

export function inferVcaaCommandTermsFromText(text: string, fallback: VceCommandTerm[], maxTerms = 8): AiLessonCommandTerm[] {
  const found = OFFICIAL_COMMAND_TERMS.filter((term) => new RegExp(`\\b${escapeRegExp(term.term)}\\b`, 'i').test(text))
  const withFallback = [...found, ...fallback.map(toOfficialTerm)]
  const seen = new Set<string>()

  return withFallback.filter((term) => {
    const key = term.term.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, maxTerms)
}

export function formatCommandTermsForPrompt(terms: AiLessonCommandTerm[]) {
  return terms.map((term) => `${term.term}: ${term.meaning} Response move: ${term.responseMove}`).join('\n')
}
import { GroqApiError, GroqConfigurationError } from '@/lib/ai/groq'
import { createTutorReplyWithFallback } from '@/lib/ai/text-fallback'
import { ProviderApiError, ProviderConfigurationError } from '@/lib/ai/providers/types'
import type { AiLessonCommandTerm, AiLessonSlide, AiLessonSlideKind, AiUnitLessonPack } from '@/lib/courses/lesson-pack-types'
import type { VceCourse, VceCourseLevel } from '@/lib/courses/vce-catalog'
import { VCE_STUDY_DESIGN_SOURCE } from '@/lib/courses/vce-catalog'
import { formatCommandTermsForPrompt, inferVcaaCommandTermsFromText, VCAA_COMMAND_TERMS_SOURCE } from '@/lib/courses/vcaa-command-terms'
import { loadVcaaStudyDesignUnitText, type VcaaStudyDesignArea, type VcaaStudyDesignUnitSource } from '@/lib/courses/vcaa-study-design'

const MIN_SLIDES = 45
const MAX_SLIDES = 55
const FALLBACK_SLIDES = 50

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter(Boolean).slice(0, 5)
}

function asParagraphArray(value: unknown, fallback: string) {
  const paragraphs = Array.isArray(value)
    ? value.map((item) => asString(item)).filter((item) => item.length >= 80).slice(0, 5)
    : []
  return paragraphs.length > 0 ? paragraphs : [fallback]
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function isTeachingKind(kind: AiLessonSlideKind) {
  return kind === 'teach' || kind === 'example' || kind === 'activity' || kind === 'checkpoint'
}

function asSlideKind(value: unknown): AiLessonSlideKind {
  return value === 'teach' || value === 'example' || value === 'activity' || value === 'question' || value === 'answer' || value === 'checkpoint'
    ? value
    : 'teach'
}

function extractJsonObject(value: string) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(value)
  const candidate = fenced?.[1] ?? value
  const first = candidate.indexOf('{')
  const last = candidate.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) throw new Error('AI lesson pack did not include JSON')
  return JSON.parse(candidate.slice(first, last + 1)) as unknown
}

function normaliseCommandTerm(value: unknown, fallbackTerms: AiLessonCommandTerm[]): AiLessonCommandTerm | undefined {
  const record = asRecord(value)
  const term = asString(record?.term)
  if (!term) return undefined
  const matched = fallbackTerms.find((item) => item.term.toLowerCase() === term.toLowerCase())
  if (matched) return matched
  return {
    term,
    meaning: asString(record?.meaning, 'Use the command term in context and answer the exact task.'),
    responseMove: asString(record?.responseMove, 'Identify what the term asks you to do, then structure the response around that action.'),
    source: asString(record?.source, VCAA_COMMAND_TERMS_SOURCE.url),
  }
}

function normaliseCommandTerms(value: unknown, fallbackTerms: AiLessonCommandTerm[]) {
  const parsed = Array.isArray(value) ? value.map((item) => normaliseCommandTerm(item, fallbackTerms)).filter((term): term is AiLessonCommandTerm => Boolean(term)) : []
  const seen = new Set<string>()
  return [...parsed, ...fallbackTerms].filter((term) => {
    const key = term.term.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 10)
}

function normaliseSlides(value: unknown, commandTerms: AiLessonCommandTerm[]): AiLessonSlide[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_SLIDES).map((item, index): AiLessonSlide | null => {
    const record = asRecord(item)
    if (!record) return null
    const title = asString(record.title)
    const body = asString(record.body)
    if (!title || !body) return null
    const commandTerm = normaliseCommandTerm(record.commandTerm, commandTerms)
    return {
      id: asString(record.id, `slide-${index + 1}`),
      kind: asSlideKind(record.kind),
      title,
      minutes: typeof record.minutes === 'number' && Number.isFinite(record.minutes) ? Math.max(1, Math.min(15, Math.round(record.minutes))) : 4,
      body,
      paragraphs: asParagraphArray(record.paragraphs, body),
      bullets: asStringArray(record.bullets),
      commandTerm,
      activity: asString(record.activity) || undefined,
      question: asString(record.question) || undefined,
      answerGuide: asString(record.answerGuide) || undefined,
    }
  }).filter((slide): slide is AiLessonSlide => slide !== null)
}

function normalisePack(value: unknown, course: VceCourse, level: VceCourseLevel, source: VcaaStudyDesignUnitSource): AiUnitLessonPack | null {
  const record = asRecord(value)
  if (!record) return null
  const commandTerms = normaliseCommandTerms(record.commandTerms, source.commandTerms)
  const slides = normaliseSlides(record.slides, commandTerms)
  if (slides.length < MIN_SLIDES || slides.length > MAX_SLIDES) return null
  const teachingSlideCount = slides.filter((slide) => isTeachingKind(slide.kind)).length
  const assessmentSlideCount = slides.filter((slide) => slide.kind === 'question' || slide.kind === 'answer').length
  const thinTeachingSlides = slides.filter((slide) => isTeachingKind(slide.kind) && wordCount(slide.paragraphs.join(' ')) < 95).length
  if (teachingSlideCount < 34 || assessmentSlideCount > 16 || thinTeachingSlides > 6) return null
  return {
    id: asString(record.id, `${course.id}-unit-${level.unit}-ai-pack`),
    courseId: course.id,
    courseName: course.name,
    unit: level.unit,
    unitTitle: source.unitTitle || level.title,
    sourceTitle: source.sourceTitle,
    sourceUrl: source.documentUrl ?? source.sourceUrl,
    sourcePageUrl: source.sourceUrl,
    sourceDocumentUrl: source.documentUrl,
    generatedBy: 'ai',
    commandTerms,
    slides,
  }
}

type TeachingItem = {
  areaTitle: string
  outcome: string
  point: string
  skill: string
}

function shortText(value: string, max = 220) {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trim()}...` : trimmed
}

function areaTeachingItems(areas: VcaaStudyDesignArea[]) {
  return areas.flatMap((area) => {
    const skills = area.keySkills.length > 0 ? area.keySkills : ['use the study design skill required by the outcome']
    return area.keyKnowledge.map((point, index): TeachingItem => ({
      areaTitle: area.title,
      outcome: area.outcome,
      point: shortText(point),
      skill: shortText(skills[index % skills.length] ?? skills[0]),
    }))
  })
}

function catalogTeachingItems(course: VceCourse, level: VceCourseLevel): TeachingItem[] {
  const lessonPoints = level.chapters.flatMap((chapter) =>
    chapter.lessons.flatMap((lesson) =>
      lesson.keyKnowledge.map((point, index): TeachingItem => ({
        areaTitle: chapter.title,
        outcome: chapter.outcome,
        point: shortText(point.detail),
        skill: shortText(lesson.practice[index % lesson.practice.length] ?? lesson.objective),
      })),
    ),
  )

  if (lessonPoints.length > 0) return lessonPoints
  return course.studyDesign.keyKnowledge.map((point): TeachingItem => ({
    areaTitle: level.title,
    outcome: level.focus,
    point: shortText(point.detail),
    skill: shortText(point.checkQuestion),
  }))
}

function teachingItemsFor(course: VceCourse, level: VceCourseLevel, source: VcaaStudyDesignUnitSource) {
  const fromStudyDesign = areaTeachingItems(source.areas)
  return fromStudyDesign.length > 0 ? fromStudyDesign : catalogTeachingItems(course, level)
}

function catalogSource(course: VceCourse, level: VceCourseLevel): VcaaStudyDesignUnitSource {
  const areas = level.chapters.map((chapter): VcaaStudyDesignArea => ({
    title: chapter.title,
    outcome: chapter.outcome,
    keyKnowledge: chapter.lessons.flatMap((lesson) => lesson.keyKnowledge.map((point) => point.detail)),
    keySkills: chapter.lessons.flatMap((lesson) => lesson.practice),
  }))
  const text = areas.map((area) => `${area.title}\n${area.outcome}\nKey knowledge\n${area.keyKnowledge.join('\n')}\nKey skills\n${area.keySkills.join('\n')}`).join('\n\n')
  return {
    sourceTitle: `${course.name} VCE Study Design`,
    sourceUrl: course.studyDesign.sourceUrl || VCE_STUDY_DESIGN_SOURCE.url,
    documentUrl: undefined,
    text,
    unitTitle: level.title,
    areas,
    commandTerms: inferVcaaCommandTermsFromText(text, course.studyDesign.commandTerms),
  }
}

function commandTermForSlide(commandTerms: AiLessonCommandTerm[], index: number) {
  return commandTerms[index % Math.max(1, commandTerms.length)] ?? {
    term: 'Explain',
    meaning: 'Give a detailed account of why or how.',
    responseMove: 'Link cause, process and result so the relationship is clear.',
    source: VCAA_COMMAND_TERMS_SOURCE.url,
  }
}

type RichSlidePhase = 'roadmap' | 'learn' | 'example' | 'activity' | 'command' | 'connect' | 'model' | 'checkpoint' | 'question' | 'answer'

function richSlideParagraphs(
  phase: RichSlidePhase,
  course: VceCourse,
  level: VceCourseLevel,
  source: VcaaStudyDesignUnitSource,
  item: TeachingItem,
  point: string,
  commandTerm: AiLessonCommandTerm,
) {
  const area = item.areaTitle || source.unitTitle || level.title
  const outcome = shortText(item.outcome || level.focus, 220)
  const skill = shortText(item.skill, 220)

  if (phase === 'roadmap') {
    return [
      `This unit is not meant to be studied as a list of dot points. In ${course.name}, the study design tells you what ideas, skills and forms of evidence matter, but the learning happens when you can explain those ideas in your own words. Use this deck as a guided lesson: read, connect, practise, then answer.`,
      `The unit will keep returning to the same pattern. First you learn what the key knowledge means. Then you connect it to an outcome, apply it to a task, and practise the command term that tells you how to respond. That is the difference between knowing a phrase and being ready for a SAC or exam-style question.`,
      `As you move through the slides, treat each paragraph as something you should be able to teach back. If a paragraph mentions evidence, context, a text, data, a case, a method or a process, pause and think of one example from class. That example is what will make the idea usable in assessment.`,
    ]
  }

  if (phase === 'learn') {
    return [
      `The key idea on this slide is ${point}. In ${course.name}, do not treat that wording as a heading to memorise. Treat it as a concept you need to unpack: what is being described, what parts are involved, and what relationship or process is the study design asking you to understand?`,
      `A useful way to learn it is to move from plain meaning to VCE meaning. In plain language, ask what the idea is doing. In VCE language, connect it to ${area} and to the outcome: ${outcome}. That link tells you why the idea matters instead of leaving it as a detached definition.`,
      `When this idea appears in a task, your answer needs to do more than name it. You should define the idea briefly, explain how it works, and then show its effect, purpose, evidence or consequence in the context of the question. That final connection is where marks usually come from.`,
    ]
  }

  if (phase === 'example') {
    return [
      `An example is not an extra decoration in a VCE answer; it is how you prove that you understand the concept. For ${point}, start by naming the relevant feature or situation, then show how it demonstrates the idea. The example should make the abstract wording easier to see.`,
      `In ${course.name}, the example might be a text moment, a data pattern, a case study, a source, a model, a calculation step, a design decision, a performance choice or an investigation result. The form changes by subject, but the purpose is the same: it gives evidence for your explanation.`,
      `A strong example is followed by interpretation. Do not stop after naming it. Add a sentence that explains what the example shows about ${area}, and link that back to the outcome. This turns the example from a mention into part of an argument or explanation.`,
    ]
  }

  if (phase === 'activity') {
    return [
      `The activity on this slide is designed to slow the learning down. Before you answer a question, build a small study note for ${point}: one sentence for what it means, one sentence for how it works, and one sentence for where it could appear in a VCE task.`,
      `This matters because students often recognise study-design language without being able to use it. The goal is to turn recognition into explanation. If you can explain the point without looking, you are much closer to being able to adapt it under assessment conditions.`,
      `After writing the note, test it against the key skill: ${skill}. If your note does not help you perform that skill, revise it. A useful note should guide action, not just store information.`,
    ]
  }

  if (phase === 'command') {
    return [
      `The command term ${commandTerm.term} controls the shape of the answer. It is not just a polite word at the start of a question. It tells you what kind of thinking to show, how much detail to include, and whether you need to describe, explain, compare, analyse, evaluate or justify.`,
      `For this slide, connect ${commandTerm.term} to ${point}. The response move is: ${commandTerm.responseMove} That means your paragraph should be organised around the action in the command term, not around every fact you remember about the topic.`,
      `A good habit is to translate the command term before writing. If the question says ${commandTerm.term}, silently ask: what would a marker expect to see on the page? Then choose the parts of ${point} that help you meet that expectation.`,
    ]
  }

  if (phase === 'connect') {
    return [
      `This slide is about connection. A key knowledge point only becomes useful when you can connect it to the outcome for ${area}. The outcome gives the purpose of the learning, so use it to decide what your explanation should prove.`,
      `For ${point}, the connection is not automatic. You need to make it visible by explaining how the idea affects the topic, supports an interpretation, explains a pattern, shapes a decision, or helps complete the task. In VCE writing, invisible connections often look like vague answers.`,
      `Use this sentence frame if you get stuck: this matters in ${area} because it helps explain, demonstrate or evaluate the outcome by showing how the key idea works in context. Then replace the general words with the subject-specific detail from your lesson.`,
    ]
  }

  if (phase === 'model') {
    return [
      `A model response is built in moves. First, identify ${point} clearly enough that the marker knows the idea you are using. Second, unpack the idea by explaining how it works. Third, connect it to the question so the answer does not feel like copied notes.`,
      `The middle move is usually the most important. This is where you show reasoning, evidence or process. In ${course.name}, that might mean explaining an effect on an audience, a biological mechanism, a mathematical method, a business consequence, a legal principle, a design choice or another subject-specific relationship.`,
      `The final move should satisfy ${commandTerm.term}. Use the command term as a checklist: ${commandTerm.responseMove} If the response does not do that, it may contain true information but still miss what the question asked you to do.`,
    ]
  }

  if (phase === 'checkpoint') {
    return [
      `A checkpoint is where you test whether the idea has become teachable. If you can only repeat ${point}, you are still at the recall stage. If you can explain what it means, why it matters, and how it appears in ${area}, you are moving toward VCE-level understanding.`,
      `Look for shallow recall in your own work. Shallow recall often sounds correct because it uses study-design words, but it does not explain relationships. A stronger response adds cause, effect, evidence, comparison, interpretation, method or consequence depending on the subject.`,
      `Before moving on, say the idea aloud in three parts: what it is, how it works, and why it matters for the outcome. If one part feels weak, return to the previous teaching slide and add a clearer example.`,
    ]
  }

  if (phase === 'question') {
    return [
      `This is the point where the lesson turns into practice. The question asks you to use ${point}, but your answer should not simply repeat that phrase. Start by interpreting the command term, then choose the part of the key knowledge that directly answers the question.`,
      `Plan the response before typing. One sentence should define or identify the idea. The next sentence should explain the reasoning, evidence, method or effect. The final sentence should link back to ${area} and show why the answer satisfies ${commandTerm.term}.`,
      `When you use the AI answer check, expect feedback on both knowledge and structure. A response can know the topic but still be partial if it does not follow the command term or if it leaves the connection to the outcome unclear.`,
    ]
  }

  return [
    `The answer guide is not something to memorise word for word. It shows the ingredients of a strong response: the key idea, an explanation of how it works, relevant evidence or context, and a clear link back to the command term.`,
    `For ${point}, the answer should make the relationship visible. If the guide mentions evidence, do not just add a random example; explain how that evidence proves the point. If it mentions process, show the steps. If it mentions judgement, state the reason for the judgement.`,
    `Use the guide to improve your own response. Compare your answer against the expected moves, then rewrite one sentence so it is more specific, more connected to ${area}, or more clearly aligned to ${commandTerm.term}.`,
  ]
}

function fallbackSlides(course: VceCourse, level: VceCourseLevel, source: VcaaStudyDesignUnitSource): AiLessonSlide[] {
  const items = teachingItemsFor(course, level, source)
  const commandTerms = source.commandTerms.length > 0 ? source.commandTerms : inferVcaaCommandTermsFromText(source.text, course.studyDesign.commandTerms)

  return Array.from({ length: FALLBACK_SLIDES }, (_, index): AiLessonSlide => {
    const item = items[index % Math.max(1, items.length)] ?? {
      areaTitle: level.title,
      outcome: level.focus,
      point: course.description,
      skill: 'use evidence from the study design outcome',
    }
    const phase = index % 10
    const commandTerm = commandTermForSlide(commandTerms, index)
    const point = item.point

    if (index === 0) {
      return {
        id: 'fallback-1',
        kind: 'teach',
        title: `${source.unitTitle || level.title}: lesson roadmap`,
        minutes: 4,
        body: `This lesson pack is built from the VCAA study design for ${course.name}. You will learn the key knowledge, practise the key skills, and answer with command terms in context.`,
        paragraphs: richSlideParagraphs('roadmap', course, level, source, item, point, commandTerm),
        bullets: source.areas.slice(0, 4).map((area) => area.title),
        commandTerm,
        activity: 'Write one sentence for each area of study: what will you need to know and what will you need to do?',
      }
    }

    if (phase === 0) {
      return {
        id: `fallback-${index + 1}`,
        kind: 'teach',
        title: `Learn: ${point}`,
        minutes: 5,
        body: `VCAA places this idea inside ${item.areaTitle}. Learn it as a relationship: define, explain, and connect it to the outcome.`,
        paragraphs: richSlideParagraphs('learn', course, level, source, item, point, commandTerm),
        bullets: [
          `Outcome link: ${shortText(item.outcome || level.focus, 150)}`,
          `Key skill link: ${item.skill}`,
          'Write a one-sentence explanation in your own words.',
        ],
        commandTerm,
      }
    }

    if (phase === 1) {
      return {
        id: `fallback-${index + 1}`,
        kind: 'example',
        title: `Example: turn the point into evidence`,
        minutes: 5,
        body: `A VCE response should not just name ${point}. It should show how the point works in a subject-specific context.`,
        paragraphs: richSlideParagraphs('example', course, level, source, item, point, commandTerm),
        bullets: ['Name the relevant feature.', 'Add the subject-specific context.', 'Explain the effect, consequence or meaning.'],
        commandTerm,
      }
    }

    if (phase === 2) {
      return {
        id: `fallback-${index + 1}`,
        kind: 'activity',
        title: `Activity: build a study-design note`,
        minutes: 7,
        body: `Make the VCAA wording teachable by turning ${point} into a compact study note.`,
        paragraphs: richSlideParagraphs('activity', course, level, source, item, point, commandTerm),
        bullets: ['Term or idea', 'How it works', 'Where it appears in a VCE-style task'],
        commandTerm,
        activity: `Create a 3-part note for ${point}: definition, explanation, and one example linked to ${item.areaTitle}.`,
      }
    }

    if (phase === 3) {
      return {
        id: `fallback-${index + 1}`,
        kind: 'teach',
        title: `How to use ${commandTerm.term}`,
        minutes: 5,
        body: `Before answering, translate the command term so you know how to work with ${point}.`,
        paragraphs: richSlideParagraphs('command', course, level, source, item, point, commandTerm),
        bullets: [
          `Command term meaning: ${commandTerm.meaning}`,
          `Response move: ${commandTerm.responseMove}`,
          `Apply it to ${item.areaTitle} by linking the idea to the outcome.`,
        ],
        commandTerm,
      }
    }

    if (phase === 4) {
      return {
        id: `fallback-${index + 1}`,
        kind: 'activity',
        title: `Guided practice: explain it aloud`,
        minutes: 6,
        body: `Practise teaching ${point} as if you were explaining it to a classmate.`,
        paragraphs: richSlideParagraphs('activity', course, level, source, item, point, commandTerm),
        bullets: ['Say the concept in plain language.', 'Add the important subject-specific vocabulary.', `Finish with why it matters for ${item.areaTitle}.`],
        commandTerm,
        activity: `Record or write a 45-second explanation of ${point}, then underline the words that came from the study design.`,
      }
    }

    if (phase === 5) {
      return {
        id: `fallback-${index + 1}`,
        kind: 'teach',
        title: `Connect: outcome to task`,
        minutes: 5,
        body: `A VCE task usually tests whether you can connect key knowledge to the outcome.`,
        paragraphs: richSlideParagraphs('connect', course, level, source, item, point, commandTerm),
        bullets: [
          `Outcome: ${shortText(item.outcome || level.focus, 150)}`,
          `Skill to practise: ${item.skill}`,
          'A strong response makes the connection visible, not assumed.',
        ],
        commandTerm,
      }
    }

    if (phase === 6) {
      return {
        id: `fallback-${index + 1}`,
        kind: 'example',
        title: `Model response move`,
        minutes: 5,
        body: `Model the answer in three moves: name the idea, unpack how it works, then connect it back to the task.`,
        paragraphs: richSlideParagraphs('model', course, level, source, item, point, commandTerm),
        bullets: [
          `Move 1: identify ${point}.`,
          'Move 2: explain the mechanism, feature, evidence or reasoning.',
          `Move 3: finish with the ${commandTerm.term.toLowerCase()} demand.`,
        ],
        commandTerm,
        answerGuide: `A model response should include ${point}, relevant evidence or subject-specific detail, and a final sentence that satisfies ${commandTerm.term}.`,
      }
    }

    if (phase === 7) {
      return {
        id: `fallback-${index + 1}`,
        kind: 'checkpoint',
        title: `Checkpoint: avoid shallow recall`,
        minutes: 3,
        body: `The common mistake is copying the study design phrase without explaining it.`,
        paragraphs: richSlideParagraphs('checkpoint', course, level, source, item, point, commandTerm),
        bullets: ['Can you define it?', 'Can you explain how or why it works?', `Can you answer a ${commandTerm.term.toLowerCase()} task about it?`],
        commandTerm,
        activity: `Rewrite a weak answer that only names ${point}. Add the missing explanation and evidence.`,
      }
    }

    if (phase === 8) {
      return {
        id: `fallback-${index + 1}`,
        kind: 'question',
        title: `${commandTerm.term} check question`,
        minutes: 5,
        body: `Now test the teaching by using the command term and the study-design idea together.`,
        paragraphs: richSlideParagraphs('question', course, level, source, item, point, commandTerm),
        bullets: [`Command term meaning: ${commandTerm.meaning}`, `Response move: ${commandTerm.responseMove}`, 'Answer in full sentences and include the key idea, evidence and link to the outcome.'],
        commandTerm,
        question: `${commandTerm.term} how ${point} connects to the outcome for ${item.areaTitle}.`,
        answerGuide: `A complete answer should use ${point}, explain how it works in ${item.areaTitle}, and follow the ${commandTerm.term} response move: ${commandTerm.responseMove}`,
      }
    }

    return {
      id: `fallback-${index + 1}`,
      kind: 'answer',
      title: `Answer guide: ${commandTerm.term}`,
      minutes: 4,
      body: `A strong answer follows the command term first and then uses the key knowledge with evidence.`,
      paragraphs: richSlideParagraphs('answer', course, level, source, item, point, commandTerm),
      bullets: ['Start with the point.', 'Add relevant evidence or working.', 'Finish by answering the exact command term.'],
      commandTerm,
      answerGuide: `${commandTerm.term}: ${commandTerm.meaning} A complete response should use ${point}, connect it to the outcome, and show the reasoning clearly.`,
    }
  })
}

function buildFallbackPack(course: VceCourse, level: VceCourseLevel, source: VcaaStudyDesignUnitSource): AiUnitLessonPack {
  return {
    id: `${course.id}-unit-${level.unit}-fallback-pack`,
    courseId: course.id,
    courseName: course.name,
    unit: level.unit,
    unitTitle: source.unitTitle || level.title,
    sourceTitle: source.sourceTitle,
    sourceUrl: source.documentUrl ?? source.sourceUrl,
    sourcePageUrl: source.sourceUrl,
    sourceDocumentUrl: source.documentUrl,
    generatedBy: 'fallback',
    commandTerms: source.commandTerms,
    slides: fallbackSlides(course, level, source),
  }
}

function sourceOutline(source: VcaaStudyDesignUnitSource) {
  if (source.areas.length === 0) return source.text.slice(0, 2500)
  return source.areas.map((area) => [
    area.title,
    area.outcome,
    'Key knowledge:',
    ...area.keyKnowledge.slice(0, 12).map((item) => `- ${item}`),
    'Key skills:',
    ...area.keySkills.slice(0, 10).map((item) => `- ${item}`),
  ].filter(Boolean).join('\n')).join('\n\n')
}

function buildPrompt(course: VceCourse, level: VceCourseLevel, source: VcaaStudyDesignUnitSource) {
  return `Create a VCE teaching lesson pack for ${course.name}, ${source.unitTitle || level.title}.

Use the uploaded VCAA study design unit text as the source of truth. Design a lesson sequence that teaches the unit to a student, not a summary.

VCAA unit outline parsed from the study design:
${sourceOutline(source)}

VCAA command terms to teach in context:
${formatCommandTermsForPrompt(source.commandTerms)}

Return strict JSON only, no markdown, with this shape:
{
  "id": "string",
  "commandTerms": [
    { "term": "Analyse", "meaning": "student-friendly meaning", "responseMove": "how to answer", "source": "${VCAA_COMMAND_TERMS_SOURCE.url}" }
  ],
  "slides": [
    {
      "id": "slide-1",
      "kind": "teach|example|activity|question|answer|checkpoint",
      "title": "short slide title",
      "minutes": 3,
      "body": "one-sentence slide overview",
      "paragraphs": ["3-5 student-facing teaching paragraphs, each 45-90 words"],
      "bullets": ["0-4 concise key moves or reminders"],
      "commandTerm": { "term": "Explain", "meaning": "meaning", "responseMove": "response move", "source": "${VCAA_COMMAND_TERMS_SOURCE.url}" },
      "activity": "optional student task",
      "question": "optional VCE-style check question",
      "answerGuide": "optional answer guide"
    }
  ]
}

Rules:
- Create exactly 50 slides.
- This must feel like a teacher explaining the subject, not flashcards and not a question bank.
- The "body" field is only a one-sentence overview. The real teaching must be in "paragraphs".
- Every teach, example, activity and checkpoint slide must include 3-5 paragraphs. Each paragraph should be 45-90 words and should explain what the idea is, why it matters, how it works, and how a student uses it in VCE work.
- Use at most 8 "question" slides and at most 8 "answer" slides. Every question slide must still teach before asking, and must include an answerGuide.
- For each key knowledge point you teach, use this pattern: student-friendly explanation, why it matters, how to apply it, then one worked/modelled example or guided activity.
- Use the VCAA unit, area of study, outcome, key knowledge and key skills language.
- Use VCAA command terms in context. Teach what the command term asks the student to do before asking the student to answer.
- Sequence the slides as a real lesson: hook, direct teaching, examples, guided practice, independent activity, short VCE-style checks, answer feedback, and checkpoint.
- Every key knowledge point you include must be taught with explanation, not merely listed.
- Do not copy long passages from the study design or glossary. Paraphrase into student-friendly teaching.`
}

async function loadSourceOrCatalog(course: VceCourse, level: VceCourseLevel, signal?: AbortSignal) {
  try {
    return await loadVcaaStudyDesignUnitText(course, level.unit, signal)
  } catch (error) {
    console.warn('Courses VCAA source fallback:', error instanceof Error ? error.message : 'Unknown error')
    return catalogSource(course, level)
  }
}

export async function createAiUnitLessonPack(course: VceCourse, level: VceCourseLevel, signal?: AbortSignal): Promise<AiUnitLessonPack> {
  const source = await loadSourceOrCatalog(course, level, signal)
  const fallback = buildFallbackPack(course, level, source)

  try {
    const result = await createTutorReplyWithFallback({
      message: buildPrompt(course, level, source),
      documents: [
        { name: source.sourceTitle, text: source.text },
        { name: VCAA_COMMAND_TERMS_SOURCE.label, text: formatCommandTermsForPrompt(source.commandTerms) },
      ],
      history: [],
      mode: 'advanced',
      action: 'study-coach',
      purpose: 'study-generation',
      tier: 'plus',
      signal,
    })
    const parsed = extractJsonObject(result.reply)
    return normalisePack(parsed, course, level, source) ?? fallback
  } catch (error) {
    if (error instanceof GroqConfigurationError || error instanceof ProviderConfigurationError || error instanceof GroqApiError || error instanceof ProviderApiError || error instanceof TypeError || error instanceof SyntaxError) {
      return fallback
    }
    throw error
  }
}

export function findCourseLevel(course: VceCourse, unit: unknown) {
  const unitNumber = typeof unit === 'number' ? unit : typeof unit === 'string' ? Number(unit) : NaN
  if (unitNumber !== 1 && unitNumber !== 2 && unitNumber !== 3 && unitNumber !== 4) return null
  return course.levels.find((level) => level.unit === unitNumber) ?? null
}

export function lessonPackCacheKey(course: VceCourse, level: VceCourseLevel) {
  return `${slug(course.id)}-unit-${level.unit}-paragraph-v1`
}
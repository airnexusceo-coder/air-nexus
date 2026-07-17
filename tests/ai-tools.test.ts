import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { AI_TOOLS, buildAiToolPrompt, getAiTool, isAiToolSlug, TRANSLATION_LANGUAGES } from '../lib/ai-tools/catalog'
import { buildPowerPoint, DECK_THEMES, detectDeckTheme, parsePresentationSlides } from '../lib/ai-tools/powerpoint'
import { clearToolHistory, deleteToolHistoryEntry, loadToolHistory, saveToolHistoryEntry } from '../lib/ai-tools/history'
import { AI_TELL_PHRASES, computeStylometricStats, formatStatsForPrompt } from '../lib/ai-tools/ai-detector'

assert.equal(AI_TOOLS.length, 16, 'The public catalogue should only include the 16 focused tools that are wired to real app workflows')
assert.equal(new Set(AI_TOOLS.map((tool) => tool.slug)).size, AI_TOOLS.length, 'Tool slugs must be unique')
assert.equal(new Set(AI_TOOLS.map((tool) => tool.name)).size, AI_TOOLS.length, 'Tool names must be unique')

for (const tool of AI_TOOLS) {
  assert.match(tool.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${tool.name} needs a URL-safe slug`)
  assert.ok(tool.instruction.length >= 40, `${tool.name} needs a substantive tool instruction`)
  assert.ok(tool.example.length >= 20, `${tool.name} needs a useful example`)
  assert.ok(tool.actionLabel.length > 0, `${tool.name} needs an action label`)
  if (tool.options) {
    assert.ok(tool.options.length >= 2, `${tool.name} needs at least two meaningful options`)
    assert.ok(tool.defaultOption && tool.options.includes(tool.defaultOption), `${tool.name} default option must be available`)
  }
  const prompt = buildAiToolPrompt(tool, tool.example, tool.defaultOption)
  assert.ok(prompt.includes(tool.name), `${tool.name} prompt must identify the selected tool`)
  assert.ok(prompt.includes(tool.example), `${tool.name} prompt must preserve the user input`)
}

assert.equal(getAiTool('web-search')?.kind, 'web')
assert.equal(getAiTool('image-generation')?.kind, 'image')
assert.equal(getAiTool('pdf-tools')?.acceptsFiles, true)
assert.equal(isAiToolSlug('presentation-maker'), true)
assert.equal(isAiToolSlug('not-a-real-tool'), false)
assert.equal(isAiToolSlug('ai-detector'), true)
assert.equal(isAiToolSlug('ai-humaniser'), true)
for (const removed of ['ai-chat', 'voice-ai', 'ai-planner', 'marketing-copy', 'ai-writer', 'social-media-assistant']) {
  assert.equal(isAiToolSlug(removed), false, `${removed} should not appear as a duplicate Other Functions tool`)
}

// The Humaniser must never be instructed to defeat AI detectors or misrepresent authorship —
// only to improve the natural voice of a draft the student already wrote themselves.
{
  const humaniser = getAiTool('ai-humaniser')
  assert.ok(humaniser, 'ai-humaniser must be registered')
  const instruction = humaniser!.instruction.toLowerCase()
  for (const forbidden of ['undetectable', 'evade', 'bypass', 'turnitin', 'detector', 'plagiarism']) {
    assert.ok(!instruction.includes(forbidden), `ai-humaniser instruction must not reference "${forbidden}" — this tool improves writing voice, not detection evasion`)
  }
  assert.ok(instruction.includes('own understanding') || instruction.includes('own work'), 'ai-humaniser instruction should note that graded work must reflect the student\'s own understanding')
}

// Translation must support both directions (into and out of English) across a broad language list.
{
  assert.equal(new Set(TRANSLATION_LANGUAGES).size, TRANSLATION_LANGUAGES.length, 'translation language list should not contain duplicates')
  assert.ok(TRANSLATION_LANGUAGES.length >= 20, `expected a broad language list, got ${TRANSLATION_LANGUAGES.length}`)
  assert.ok(TRANSLATION_LANGUAGES.includes('English'), 'English must be selectable so text can be translated back into English, not just out of it')
  for (const language of ['French', 'Spanish', 'Mandarin Chinese', 'Japanese', 'Hindi', 'Arabic']) {
    assert.ok(TRANSLATION_LANGUAGES.includes(language), `previously-supported language ${language} must still be available`)
  }
  const translation = getAiTool('translation')
  assert.ok(translation, 'translation must be registered')
  assert.deepEqual(translation!.options, TRANSLATION_LANGUAGES, 'the translation tool should draw its options from the shared language list')
  assert.ok(translation!.instruction.toLowerCase().includes('source language'), 'translation instruction must explain the direction format')
}

// The Detector must never claim certainty, and must carry its own reliability caveat in the prompt.
{
  const detector = getAiTool('ai-detector')
  assert.ok(detector, 'ai-detector must be registered')
  const instruction = detector!.instruction.toLowerCase()
  assert.ok(instruction.includes('not proof') || instruction.includes('never claim certainty'), 'ai-detector instruction must acknowledge detection is not proof of authorship')
}

// --- ai-tools history (localStorage-backed) -----------------------------------

{
  // history.ts reads window.localStorage — this standalone suite runs under plain Node, so provide a minimal in-memory shim.
  type MinimalStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
  const memory = new Map<string, string>()
  const localStorageShim: MinimalStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value) },
    removeItem: (key) => { memory.delete(key) },
  }
  ;(globalThis as unknown as Record<string, unknown>).window = { localStorage: localStorageShim }
}

assert.deepEqual(loadToolHistory('ai-detector'), [], 'a tool with no history yet returns an empty list')

{
  const afterFirst = saveToolHistoryEntry('ai-detector', { input: 'Check this paragraph', option: '', reply: '## Verdict: Likely human-written' })
  assert.equal(afterFirst.length, 1, 'saving the first entry creates a one-item history')
  assert.equal(afterFirst[0].input, 'Check this paragraph')
  assert.ok(afterFirst[0].id, 'a saved entry is assigned a stable id')

  const afterSecond = saveToolHistoryEntry('ai-detector', { input: 'Check a different paragraph', option: '', reply: '## Verdict: Mixed signals' })
  assert.equal(afterSecond.length, 2, 'a second save accumulates rather than replacing')
  assert.equal(afterSecond[0].input, 'Check a different paragraph', 'the most recent entry is first')
  assert.equal(afterSecond[1].input, 'Check this paragraph', 'the earlier entry is preserved, oldest last')

  assert.deepEqual(loadToolHistory('ai-humaniser'), [], 'history is scoped per tool slug, not shared globally')

  const afterDelete = deleteToolHistoryEntry('ai-detector', afterSecond[0].id)
  assert.equal(afterDelete.length, 1, 'deleting one entry by id leaves the rest')
  assert.equal(afterDelete[0].input, 'Check this paragraph')

  clearToolHistory('ai-detector')
  assert.deepEqual(loadToolHistory('ai-detector'), [], 'clearing a tool\'s history empties it')
}

{
  // Entries beyond the per-tool cap should be dropped, not grown unbounded.
  for (let index = 0; index < 20; index += 1) {
    saveToolHistoryEntry('grammar-checker', { input: `Draft ${index}`, option: '', reply: `Corrected draft ${index}` })
  }
  const capped = loadToolHistory('grammar-checker')
  assert.ok(capped.length <= 12, `history for a single tool should be capped, got ${capped.length}`)
  assert.equal(capped[0].input, 'Draft 19', 'the cap keeps the most recent entries, not the oldest')
  clearToolHistory('grammar-checker')
}

assert.deepEqual(saveToolHistoryEntry('mind-maps', { input: 'x', option: '', reply: '' }), [], 'an empty reply is not saved to history')
clearToolHistory('mind-maps')

// --- AI detector stylometric stats ---------------------------------------------

assert.equal(new Set(AI_TELL_PHRASES).size, AI_TELL_PHRASES.length, 'AI-tell phrase list should not contain duplicates')

{
  const uniformText = [
    'The cat sat on the soft mat today.',
    'The dog ran across the green field fast.',
    'The bird flew over the tall old tree.',
    'The fish swam inside the clear blue pond.',
    'The child played with the small red ball.',
    'The teacher wrote on the wide white board.',
    'The farmer worked in the large brown barn.',
    'The driver parked near the busy train station.',
  ].join(' ')
  const variedText = [
    'Rain.',
    'I ran outside without my coat or shoes because I was late for the bus and did not want to miss it again.',
    'Cold.',
    'The wind hit my face hard, but I kept going anyway, laughing a little at how silly I must have looked to the neighbors watching from their windows.',
    'Ouch.',
    'My foot caught a rock and I stumbled forward, catching myself just before falling flat on the wet grass by the mailbox.',
  ].join(' ')

  const uniformStats = computeStylometricStats(uniformText)
  const variedStats = computeStylometricStats(variedText)
  assert.ok(uniformStats.burstiness !== null && variedStats.burstiness !== null, 'both sample texts have enough sentences to measure burstiness')
  assert.ok(uniformStats.burstiness! < variedStats.burstiness!, 'uniform sentence lengths produce lower burstiness than widely varied ones')
  assert.ok(uniformStats.score !== null && variedStats.score !== null, 'both sample texts are long enough to score')
  assert.ok(uniformStats.score! > variedStats.score!, 'the more uniform, AI-typical passage scores higher on AI-likelihood than the varied, human-typical one')
}

{
  const aiPhraseText = 'Moreover, this essay will delve into the intricate and multifaceted landscape of renewable energy. Furthermore, it is important to note that this technology plays a crucial role in a myriad of applications. In conclusion, the ever-evolving nature of this cutting-edge field underscores the paramount importance of continued research and robust investment across the board.'
  const stats = computeStylometricStats(aiPhraseText)
  assert.ok(stats.aiPhraseHits.length >= 5, `expected several AI-tell phrases to be detected, found ${stats.aiPhraseHits.length}`)
}

{
  const shortText = 'This is too short to analyse reliably.'
  const stats = computeStylometricStats(shortText)
  assert.equal(stats.score, null, 'fewer than 40 words yields no numeric score')
  assert.ok(/short/i.test(formatStatsForPrompt(stats)), 'the prompt block explains why no score was computed')
}

{
  const contractionText = "I don't think it's fair that we can't go, but I guess that's just how it's going to be, and honestly, I wouldn't want it any other way since I'm already used to it and it's fine, really, it's completely fine, I promise it's fine."
  const stats = computeStylometricStats(contractionText)
  assert.ok(stats.contractionsPer100Words > 5, `expected a high contraction rate, got ${stats.contractionsPer100Words}`)
}

{
  const longEnoughText = Array.from({ length: 45 }, (_, index) => `word${index}`).join(' ') + '.'
  const stats = computeStylometricStats(longEnoughText)
  assert.ok(stats.wordCount >= 40, 'setup: sample text meets the minimum word count')
  const block = formatStatsForPrompt(stats)
  assert.ok(block.startsWith('[Automated text statistics'), 'the prompt block is clearly delimited as computed, not part of the passage')
  assert.ok(block.includes(String(stats.wordCount)), 'the prompt block reports the actual word count')
}

/** Crude but dependency-free well-formedness check: every opening tag must have a matching, correctly-nested closing tag. Catches the kind of corruption (unclosed/mismatched tags) that would make PowerPoint refuse to open the file. */
function assertBalancedXml(xml: string, label: string) {
  const tagPattern = /<\/?([a-zA-Z][\w:.-]*)[^>]*?>/g
  const stack: string[] = []
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(xml))) {
    const full = match[0]
    const name = match[1]
    if (full.startsWith('<?')) continue
    if (full.startsWith('</')) {
      const top = stack.pop()
      assert.equal(top, name, `${label}: mismatched closing tag </${name}>, expected </${top ?? '(nothing open)'}>`)
    } else if (!full.endsWith('/>')) {
      stack.push(name)
    }
  }
  assert.equal(stack.length, 0, `${label}: unclosed tag(s) remaining: ${stack.join(', ')}`)
}

/** Counts non-overlapping occurrences of a literal substring — used to check OOXML cardinality constraints that assertBalancedXml can't see (e.g. "exactly 3 entries", not just "well-nested tags"). */
function countOccurrences(text: string, literal: string): number {
  return text.split(literal).length - 1
}

function extractBetween(text: string, openTag: string, closeTag: string): string {
  const start = text.indexOf(openTag)
  const end = text.indexOf(closeTag, start)
  if (start < 0 || end < 0) return ''
  return text.slice(start + openTag.length, end)
}

const REQUIRED_PPTX_PARTS = [
  '[Content_Types].xml', '_rels/.rels', 'docProps/app.xml', 'docProps/core.xml',
  'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels',
  'ppt/slideMasters/slideMaster1.xml', 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
  'ppt/slideLayouts/slideLayout1.xml', 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
  'ppt/theme/theme1.xml', 'ppt/slides/slide1.xml', 'ppt/slides/slide2.xml',
  'ppt/slides/_rels/slide1.xml.rels', 'ppt/slides/_rels/slide2.xml.rels',
]

async function verifyPowerPointGeneration() {
  const slides = parsePresentationSlides('## Slide 1: Test deck\n- First point\n- Second point\n\n## Slide 2: Finish\n- Final point', 'Test deck')
  assert.equal(slides.length, 2, 'Presentation outlines should parse into slides')
  const base64 = await buildPowerPoint(slides)
  assert.ok(base64.length > 1000, 'PowerPoint generation should return a non-empty base64 pptx payload')

  assert.equal(detectDeckTheme('A lesson on cell biology and photosynthesis experiments').id, 'science')
  assert.equal(detectDeckTheme('Quarterly marketing strategy and profit forecast for the startup').id, 'business')
  assert.equal(detectDeckTheme('The French Revolution and its causes in the 18th century').id, 'history')
  assert.equal(detectDeckTheme('Analysing the poetry and literary devices in a famous novel').id, 'arts')
  assert.equal(detectDeckTheme('Solving quadratic equations using the discriminant formula').id, 'math')
  assert.equal(detectDeckTheme('A general overview with no specific subject keywords at all').id, 'general')
  assert.equal(new Set(DECK_THEMES.map((theme) => theme.id)).size, DECK_THEMES.length, 'Theme ids must be unique')
  assert.equal(new Set(DECK_THEMES.map((theme) => theme.label)).size, DECK_THEMES.length, 'Theme labels must be unique')

  for (const theme of DECK_THEMES) {
    const themedBase64 = await buildPowerPoint(slides, theme)
    const zip = await JSZip.loadAsync(themedBase64, { base64: true })

    for (const path of REQUIRED_PPTX_PARTS) {
      assert.ok(zip.file(path), `${theme.id}: missing required part ${path}`)
    }
    for (const path of REQUIRED_PPTX_PARTS) {
      const text = await zip.file(path)!.async('string')
      assert.ok(text.startsWith('<?xml'), `${theme.id}: ${path} must start with an XML declaration`)
      assertBalancedXml(text, `${theme.id}:${path}`)
    }

    const contentTypesXml = await zip.file('[Content_Types].xml')!.async('string')
    assert.ok(contentTypesXml.includes('slide1.xml') && contentTypesXml.includes('slide2.xml'), `${theme.id}: Content_Types must declare every slide part`)

    const themeXml = await zip.file('ppt/theme/theme1.xml')!.async('string')
    assert.ok(themeXml.includes(theme.accentPrimary), `${theme.id}: theme part must use the theme's accent color`)
    assert.ok(themeXml.includes(theme.fontFamily), `${theme.id}: theme part must use the theme's font family`)

    // Real PowerPoint validates theme1.xml strictly against the OOXML schema on load — these
    // cardinality/required-element checks catch the kind of defect a tag-balance check cannot
    // (an actual "won't open in PowerPoint" bug was caused by getting these wrong).
    assert.equal(countOccurrences(extractBetween(themeXml, '<a:fillStyleLst>', '</a:fillStyleLst>'), '<a:solidFill>'), 3, `${theme.id}: fillStyleLst must have exactly 3 entries per the OOXML schema`)
    assert.equal(countOccurrences(extractBetween(themeXml, '<a:lnStyleLst>', '</a:lnStyleLst>'), '<a:ln '), 3, `${theme.id}: lnStyleLst must have exactly 3 entries per the OOXML schema`)
    assert.equal(countOccurrences(extractBetween(themeXml, '<a:effectStyleLst>', '</a:effectStyleLst>'), '<a:effectStyle>'), 3, `${theme.id}: effectStyleLst must have exactly 3 entries per the OOXML schema`)
    assert.equal(countOccurrences(extractBetween(themeXml, '<a:bgFillStyleLst>', '</a:bgFillStyleLst>'), '<a:solidFill>'), 3, `${theme.id}: bgFillStyleLst must have exactly 3 entries per the OOXML schema`)
    assert.equal(countOccurrences(themeXml, '<a:ea typeface='), 2, `${theme.id}: majorFont and minorFont must each declare the required <a:ea> element`)
    assert.equal(countOccurrences(themeXml, '<a:cs typeface='), 2, `${theme.id}: majorFont and minorFont must each declare the required <a:cs> element`)

    const presentationXml = await zip.file('ppt/presentation.xml')!.async('string')
    assert.ok(!presentationXml.includes('type="wide"'), 'presentation.xml must not use the invalid ST_SlideSizeType value "wide"')
    assert.ok(presentationXml.includes('type="screen16x9"'), 'presentation.xml should declare the standard widescreen slide-size type')

    const coverSlideXml = await zip.file('ppt/slides/slide1.xml')!.async('string')
    assert.ok(coverSlideXml.includes(theme.background), `${theme.id}: cover slide should use the theme background color`)
  }
}

verifyPowerPointGeneration()
  .then(() => console.log('AI tools catalogue tests passed'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

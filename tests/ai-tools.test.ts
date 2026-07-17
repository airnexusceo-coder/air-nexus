import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { AI_TOOLS, buildAiToolPrompt, getAiTool, isAiToolSlug } from '../lib/ai-tools/catalog'
import { buildPowerPoint, DECK_THEMES, detectDeckTheme, parsePresentationSlides } from '../lib/ai-tools/powerpoint'
import { clearToolHistory, deleteToolHistoryEntry, loadToolHistory, saveToolHistoryEntry } from '../lib/ai-tools/history'

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

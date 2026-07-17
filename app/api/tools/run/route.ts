import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { GroqApiError, GroqConfigurationError } from '@/lib/ai/groq'
import { createTutorReplyWithFallback } from '@/lib/ai/text-fallback'
import { ProviderApiError, ProviderConfigurationError } from '@/lib/ai/providers/types'
import { sanitizeResponse } from '@/lib/ai/sanitize-response'
import { buildAiToolPrompt, getAiTool, type AiToolDefinition } from '@/lib/ai-tools/catalog'
import { buildPowerPoint, detectDeckTheme, parsePresentationSlides, POWERPOINT_MIME, presentationFilename } from '@/lib/ai-tools/powerpoint'
import { computeStylometricStats, formatStatsForPrompt } from '@/lib/ai-tools/ai-detector'
import { buildHumaniserAnalysis, buildHumaniserAugmentedInput, splitHumaniserReply } from '@/lib/ai-tools/humaniser'
import { getServerAuthSession, SupabaseConfigurationError } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_INPUT_CHARACTERS = 24_000
const MAX_DOCUMENTS = 5
const MAX_DOCUMENT_CHARACTERS = 40_000
const MAX_TOTAL_DOCUMENT_CHARACTERS = 80_000
const REQUEST_TIMEOUT_MS = 55_000
const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'

type ToolDocument = { name: string; text: string }
type ToolRequestBody = { slug?: unknown; input?: unknown; option?: unknown; documents?: unknown }
type WebSource = { title: string; url: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readBody(request: Request): Promise<ToolRequestBody | null> {
  try {
    const value: unknown = await request.json()
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

function readDocuments(value: unknown): ToolDocument[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_DOCUMENTS) return null

  let totalCharacters = 0
  const documents: ToolDocument[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.text !== 'string') return null
    const name = item.name.trim().slice(0, 180)
    const text = item.text.trim()
    if (!name || !text || text.length > MAX_DOCUMENT_CHARACTERS) return null
    totalCharacters += text.length
    if (totalCharacters > MAX_TOTAL_DOCUMENT_CHARACTERS) return null
    documents.push({ name, text })
  }
  return documents
}

function validSource(value: unknown): WebSource | null {
  if (!isRecord(value) || typeof value.url !== 'string') return null
  try {
    const url = new URL(value.url)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return {
      url: url.toString(),
      title: typeof value.title === 'string' && value.title.trim() ? value.title.trim().slice(0, 180) : url.hostname,
    }
  } catch {
    return null
  }
}

function uniqueSources(sources: WebSource[]) {
  return [...new Map(sources.map((source) => [source.url, source])).values()].slice(0, 10)
}

type GroqSearchResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
      executed_tools?: Array<{
        search_results?: { results?: unknown[] }
        results?: unknown[]
      }>
    }
  }>
  error?: { message?: string }
}

async function runGroqWebSearch(prompt: string, signal: AbortSignal) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.GROQ_WEB_SEARCH_MODEL || 'groq/compound-mini',
      messages: [
        {
          role: 'system',
          content: 'You are Air Nexus Research. Search the live web when needed, cite sources beside the claims they support, and never invent a citation or imply a source says something it does not.',
        },
        { role: 'user', content: prompt },
      ],
      search_settings: { country: 'australia' },
    }),
    signal,
  })
  const data = await response.json().catch(() => ({})) as GroqSearchResponse
  if (!response.ok) throw new Error(data.error?.message || `Live search failed with HTTP ${response.status}`)
  const message = data.choices?.[0]?.message
  const reply = message?.content?.trim()
  if (!reply) throw new Error('Live search returned no answer.')

  const sources = (message?.executed_tools ?? []).flatMap((tool) => [
    ...(tool.search_results?.results ?? []),
    ...(tool.results ?? []),
  ]).map(validSource).filter((source): source is WebSource => Boolean(source))

  return { reply: sanitizeResponse(reply), sources: uniqueSources(sources), provider: 'Groq Web Search' }
}

async function runOpenAiWebSearch(prompt: string, signal: AbortSignal) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const client = new OpenAI({ apiKey })
  const response = await client.responses.create({
    model: process.env.OPENAI_WEB_SEARCH_MODEL || process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini',
    input: prompt,
    tools: [{ type: 'web_search' }],
    include: ['web_search_call.action.sources'],
  }, { signal })

  const sources: WebSource[] = []
  for (const output of response.output) {
    if (output.type !== 'message') continue
    for (const part of output.content) {
      if (part.type !== 'output_text') continue
      for (const annotation of part.annotations) {
        if (annotation.type !== 'url_citation') continue
        const source = validSource(annotation)
        if (source) sources.push(source)
      }
    }
  }
  if (!response.output_text.trim()) throw new Error('Live search returned no answer.')
  return { reply: sanitizeResponse(response.output_text), sources: uniqueSources(sources), provider: 'OpenAI Web Search' }
}

async function runWebTool(tool: AiToolDefinition, input: string, option: string, signal: AbortSignal) {
  const prompt = buildAiToolPrompt(tool, input, option)
  const groq = await runGroqWebSearch(prompt, signal)
  if (groq) return groq
  const openai = await runOpenAiWebSearch(prompt, signal)
  if (openai) return openai
  throw new ProviderConfigurationError('Web Search', 'Configure GROQ_API_KEY or OPENAI_API_KEY')
}

async function runImageTool(tool: AiToolDefinition, input: string, option: string, signal: AbortSignal) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new ProviderConfigurationError('Image Generation', 'Configure OPENAI_API_KEY')
  const size = option === 'Landscape' ? '1536x1024' : option === 'Portrait' ? '1024x1536' : '1024x1024'
  const client = new OpenAI({ apiKey })
  const response = await client.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt: buildAiToolPrompt(tool, input, option),
    n: 1,
    output_format: 'png',
    quality: 'medium',
    size,
  }, { signal })
  const image = response.data?.[0]
  if (!image?.b64_json) throw new Error('Image generation returned no image.')
  return {
    image: `data:image/png;base64,${image.b64_json}`,
    revisedPrompt: image.revised_prompt || input,
    provider: 'OpenAI Image Generation',
  }
}

function youtubeVideoId(input: string) {
  const match = input.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s]*v=|youtu\.be\/)([A-Za-z0-9_-]{11})/i)
  return match?.[1] ?? null
}

function jsonArrayAfter(value: string, marker: string) {
  const markerIndex = value.indexOf(marker)
  if (markerIndex < 0) return null
  const start = value.indexOf('[', markerIndex + marker.length)
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < value.length; index += 1) {
    const character = value[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '[') depth += 1
    else if (character === ']') {
      depth -= 1
      if (depth === 0) return value.slice(start, index + 1)
    }
  }
  return null
}

async function readYouTubeTranscript(videoId: string, signal: AbortSignal) {
  const watchResponse = await fetch('https://www.youtube.com/watch?v=' + videoId, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AirNexus/1.0)' },
    signal,
  })
  if (!watchResponse.ok) throw new Error('YouTube did not return this video.')
  const watchHtml = await watchResponse.text()
  const tracksJson = jsonArrayAfter(watchHtml, '"captionTracks":')
  if (!tracksJson) throw new Error('No captions are available for this video.')
  const tracks = JSON.parse(tracksJson) as Array<{ baseUrl?: unknown; languageCode?: unknown }>
  const track = tracks.find((item) => item.languageCode === 'en') ?? tracks.find((item) => typeof item.baseUrl === 'string')
  if (!track || typeof track.baseUrl !== 'string') throw new Error('No readable captions are available for this video.')

  const captionsUrl = new URL(track.baseUrl)
  captionsUrl.searchParams.set('fmt', 'json3')
  const captionsResponse = await fetch(captionsUrl, { signal })
  if (!captionsResponse.ok) throw new Error('The video captions could not be downloaded.')
  const captions = await captionsResponse.json() as {
    events?: Array<{ segs?: Array<{ utf8?: unknown }> }>
  }
  const transcript = (captions.events ?? []).map((event) =>
    (event.segs ?? []).map((segment) => typeof segment.utf8 === 'string' ? segment.utf8 : '').join(''),
  ).join(' ').replace(/\s+/g, ' ').trim()
  if (!transcript) throw new Error('The video captions were empty.')
  return transcript.slice(0, MAX_DOCUMENT_CHARACTERS)
}

async function expandToolInput(tool: AiToolDefinition, input: string, signal: AbortSignal) {
  if (tool.slug !== 'youtube-summarizer') return input
  const videoId = youtubeVideoId(input)
  if (!videoId) return input
  try {
    const transcript = await readYouTubeTranscript(videoId, signal)
    return input + '\n\nAutomatically retrieved video transcript:\n' + transcript
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The video transcript could not be retrieved.'
    throw new Error(message + ' Paste the transcript or captions into the tool instead.')
  }
}

async function runTextTool(tool: AiToolDefinition, input: string, option: string, documents: ToolDocument[], signal: AbortSignal) {
  const expandedInput = await expandToolInput(tool, input, signal)
  const result = await createTutorReplyWithFallback({
    message: buildAiToolPrompt(tool, expandedInput, option),
    documents,
    history: [],
    memoryContext: '',
    mode: 'auto',
    action: tool.action,
    purpose: documents.length > 0 ? 'document-analysis' : tool.purpose,
    tier: 'free',
    signal,
  })
  return {
    reply: sanitizeResponse(result.reply),
    provider: result.provider,
    model: result.model,
  }
}

function requestedSlideCount(option: string) {
  const match = option.match(/\d+/)
  const value = match ? Number(match[0]) : 7
  return Math.min(10, Math.max(3, Number.isFinite(value) ? value : 7))
}

function fallbackPresentationOutline(input: string, option: string) {
  const count = requestedSlideCount(option)
  const topic = input.trim().replace(/\s+/g, ' ').slice(0, 120) || 'Presentation topic'
  const slideTitles = ['Overview', 'Why it matters', 'Key idea', 'Evidence', 'Example', 'Risks or limits', 'Next steps', 'Discussion', 'Summary', 'Closing']
  return Array.from({ length: count }, (_, index) => {
    const title = index === 0 ? topic : slideTitles[index - 1] ?? `Point ${index + 1}`
    return [
      `## Slide ${index + 1}: ${title}`,
      'On-slide:',
      `- ${index === 0 ? 'Introduce the topic and purpose.' : 'Explain the main point clearly.'}`,
      '- Add one concrete detail or example from your brief.',
      '- Keep this slide concise and easy to present.',
      'Speaker notes:',
      `Explain how this slide supports ${topic}.`,
    ].join('\n')
  }).join('\n\n')
}
async function runPresentationTool(tool: AiToolDefinition, input: string, option: string, signal: AbortSignal) {
  let result: { reply: string; provider: string; model?: string }
  try {
    result = await runTextTool(tool, input, option, [], signal)
  } catch (error) {
    if (!(error instanceof GroqConfigurationError || error instanceof ProviderConfigurationError)) throw error
    result = {
      reply: fallbackPresentationOutline(input, option),
      provider: 'Local PowerPoint builder',
      model: 'deterministic-outline',
    }
  }
  const slides = parsePresentationSlides(result.reply, input.trim().slice(0, 90) || 'Air Nexus presentation')
  const theme = detectDeckTheme(`${input}\n${option}\n${result.reply}`)
  const base64 = await buildPowerPoint(slides, theme)
  return {
    ...result,
    file: `data:${POWERPOINT_MIME};base64,${base64}`,
    filename: presentationFilename(slides),
    mimeType: POWERPOINT_MIME,
    theme: theme.label,
  }
}

async function runAiDetectorTool(tool: AiToolDefinition, input: string, option: string, documents: ToolDocument[], signal: AbortSignal) {
  const analysisText = input.trim() || documents.map((document) => document.text).join('\n\n')
  const stats = computeStylometricStats(analysisText)
  const augmentedInput = input.trim()
    ? `${input}\n\n${formatStatsForPrompt(stats)}`
    : `Use the attached material as the passage to analyse.\n\n${formatStatsForPrompt(stats)}`
  const result = await runTextTool(tool, augmentedInput, option, documents, signal)
  return {
    ...result,
    stylometricStats: {
      wordCount: stats.wordCount,
      sentenceCount: stats.sentenceCount,
      burstiness: stats.burstiness,
      vocabDiversity: stats.vocabDiversity,
      aiPhraseHits: stats.aiPhraseHits,
      contractionsPer100Words: stats.contractionsPer100Words,
      score: stats.score,
    },
  }
}

async function runAiHumaniserTool(tool: AiToolDefinition, input: string, option: string, documents: ToolDocument[], signal: AbortSignal) {
  const { stats: beforeStats, augmentedInput } = buildHumaniserAugmentedInput(input, option)
  const result = await runTextTool(tool, augmentedInput, option, documents, signal)
  const { rewritten } = splitHumaniserReply(result.reply)
  const humaniserStats = buildHumaniserAnalysis(beforeStats, rewritten || result.reply, option)
  return {
    ...result,
    humaniserStats,
  }
}

export async function POST(request: Request) {
  const body = await readBody(request)
  const tool = typeof body?.slug === 'string' ? getAiTool(body.slug) : undefined
  const input = typeof body?.input === 'string' ? body.input.trim() : ''
  const option = typeof body?.option === 'string' ? body.option.trim().slice(0, 80) : ''
  const documents = readDocuments(body?.documents)

  if (!body || !tool) return NextResponse.json({ error: 'Choose a valid Air Nexus tool.' }, { status: 400 })
  if (!input && (!documents || documents.length === 0)) return NextResponse.json({ error: 'Add a request or attach a file first.' }, { status: 400 })
  if (input.length > MAX_INPUT_CHARACTERS) return NextResponse.json({ error: 'The tool input is too long.' }, { status: 413 })
  if (!documents) return NextResponse.json({ error: 'Attach up to five readable files.' }, { status: 400 })
  if (documents.length > 0 && !tool.acceptsFiles) return NextResponse.json({ error: `${tool.name} does not accept file attachments.` }, { status: 400 })

  try {
    const auth = await getServerAuthSession()
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      if (tool.kind === 'web') return NextResponse.json(await runWebTool(tool, input, option, controller.signal))
      if (tool.kind === 'image') return NextResponse.json(await runImageTool(tool, input, option, controller.signal))
      if (tool.slug === 'presentation-maker') return NextResponse.json(await runPresentationTool(tool, input, option, controller.signal))
      if (tool.slug === 'ai-detector') return NextResponse.json(await runAiDetectorTool(tool, input, option, documents, controller.signal))
      if (tool.slug === 'ai-humaniser') return NextResponse.json(await runAiHumaniserTool(tool, input, option, documents, controller.signal))
      return NextResponse.json(await runTextTool(tool, input, option, documents, controller.signal))
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return NextResponse.json({ error: 'Supabase authentication is not configured.' }, { status: 500 })
    }
    if (error instanceof GroqConfigurationError || error instanceof ProviderConfigurationError) {
      const message = tool.kind === 'image'
        ? 'Image generation needs an OpenAI API key. Add OPENAI_API_KEY to enable this tool.'
        : tool.kind === 'web'
          ? 'Live search needs a Groq or OpenAI API key.'
          : 'The AI service is not configured.'
      return NextResponse.json({ error: message }, { status: 503 })
    }
    if (error instanceof GroqApiError || error instanceof ProviderApiError) {
      return NextResponse.json({ error: error.status === 429 ? 'The AI service is busy. Try again in a moment.' : 'The AI provider could not complete this request.' }, { status: error.status === 429 ? 429 : 502 })
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'The tool took too long to respond. Try a smaller request.' }, { status: 504 })
    }
    console.error('AI tool error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The tool could not complete this request.' }, { status: 502 })
  }
}

'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  Clipboard,
  Code2,
  Database,
  Download,
  ExternalLink,
  Feather,
  FileSearch,
  FileText,
  History as HistoryIcon,
  Image as ImageIcon,
  Languages,
  LoaderCircle,
  Mail,
  Map,
  Mic2,
  Paperclip,
  Presentation,
  RefreshCw,
  Rocket,
  ScanSearch,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react'
import { AiMarkdown } from '@/components/ai-markdown'
import {
  AI_TOOLS,
  getAiTool,
  isAiToolSlug,
  TRANSLATION_LANGUAGES,
  type AiToolCategory,
  type AiToolDefinition,
} from '@/lib/ai-tools/catalog'
import {
  DOCUMENT_ACCEPT,
  MAX_DOCUMENTS_PER_MESSAGE,
  pendingDocument,
  readDocument,
  type DocumentAttachment,
} from '@/lib/documents/client'
import {
  clearToolHistory,
  deleteToolHistoryEntry,
  loadToolHistory,
  saveToolHistoryEntry,
  type ToolHistoryEntry,
} from '@/lib/ai-tools/history'
import { splitHumaniserReply } from '@/lib/ai-tools/humaniser'
import { useVoiceInput } from '@/lib/voice/use-voice-input'
import { cn } from '@/lib/utils'

type NoticeTone = 'success' | 'info' | 'warning'

type StylometricStatsResult = {
  wordCount: number
  sentenceCount: number
  burstiness: number | null
  vocabDiversity: number | null
  aiPhraseHits: string[]
  contractionsPer100Words: number
  score: number | null
}

type HumaniserStatsResult = {
  before: StylometricStatsResult
  after: StylometricStatsResult
  riskChange: number | null
  removedAiPhraseHits: string[]
  remainingAiPhraseHits: string[]
  mode: string
}

type ToolResult = {
  reply?: string
  image?: string
  file?: string
  filename?: string
  mimeType?: string
  theme?: string
  revisedPrompt?: string
  provider?: string
  model?: string
  tools?: string[]
  sources?: Array<{ title: string; url: string }>
  stylometricStats?: StylometricStatsResult
  humaniserStats?: HumaniserStatsResult
}

const TOOL_ICONS: Record<string, LucideIcon> = {
  'presentation-maker': Presentation,
  'resume-builder': BriefcaseBusiness,
  'code-generation': Code2,
  'data-analysis': BarChart3,
  'email-assistant': Mail,
  'file-analysis': FileSearch,
  'pdf-tools': FileText,
  'sql-assistant': Database,
  'grammar-checker': Check,
  'web-search': Search,
  translation: Languages,
  'youtube-summarizer': Rocket,
  'image-generation': ImageIcon,
  'mind-maps': Map,
  'ai-detector': ScanSearch,
  'ai-humaniser': Feather,
}

const CATEGORY_STYLE: Record<AiToolCategory, { card: string; icon: string; dot: string }> = {
  Create: {
    card: 'from-violet-500/12 via-fuchsia-500/[0.045] to-transparent',
    icon: 'border-violet-300/20 bg-violet-400/12 text-violet-100',
    dot: 'bg-violet-300',
  },
  Research: {
    card: 'from-cyan-500/12 via-sky-500/[0.045] to-transparent',
    icon: 'border-cyan-300/20 bg-cyan-400/12 text-cyan-100',
    dot: 'bg-cyan-300',
  },
  Communicate: {
    card: 'from-amber-500/12 via-orange-500/[0.045] to-transparent',
    icon: 'border-amber-300/20 bg-amber-400/12 text-amber-100',
    dot: 'bg-amber-300',
  },
  Build: {
    card: 'from-emerald-500/12 via-teal-500/[0.045] to-transparent',
    icon: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-100',
    dot: 'bg-emerald-300',
  },
}

/** Tools whose result gets a dedicated structured preview above the raw reply — for these, the raw markdown collapses into a scrollable "full text" fallback instead of being the main view. */
const STRUCTURED_PREVIEW_SLUGS = new Set(['presentation-maker', 'mind-maps', 'code-generation', 'sql-assistant', 'grammar-checker', 'translation', 'resume-builder', 'ai-detector', 'ai-humaniser', 'email-assistant'])

function initialToolSlug() {
  if (typeof window === 'undefined') return 'presentation-maker'
  const value = new URLSearchParams(window.location.search).get('tool')
  return isAiToolSlug(value) ? value : 'presentation-maker'
}

function resultFilename(tool: AiToolDefinition, extension: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `air-nexus-${tool.slug}-${date}.${extension}`
}

function downloadText(tool: AiToolDefinition, text: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = resultFilename(tool, 'md')
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Converts a base64 data URL to a Blob and triggers a download via an object URL. Assigning a large base64 data: URL directly to an <a href> is unreliable in some browsers for binary downloads (silent truncation/corruption) — the object-URL route is the robust pattern, already used by downloadText above. */
function downloadDataUrl(dataUrl: string, filename: string) {
  const [header, base64 = ''] = dataUrl.split(',')
  const mimeMatch = header.match(/^data:(.*?)(;base64)?$/)
  const mime = mimeMatch?.[1] || 'application/octet-stream'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function selectInitialOption(tool: AiToolDefinition) {
  return tool.defaultOption ?? tool.options?.[0] ?? ''
}

export function AiToolsPage({
  notify,
  selectedSlug,
}: {
  notify: (message: string, tone?: NoticeTone) => void
  selectedSlug: string | null
}) {
  const selectedTool = getAiTool(selectedSlug) ?? getAiTool(initialToolSlug()) ?? AI_TOOLS[0]
  const [input, setInput] = useState('')
  const [option, setOption] = useState(() => selectInitialOption(selectedTool))
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([])
  const [result, setResult] = useState<ToolResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<ToolHistoryEntry[]>(() => loadToolHistory(selectedTool.slug))
  const [showHistory, setShowHistory] = useState(false)
  const [sourceLanguage, setSourceLanguage] = useState('English')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setInput('')
      setOption(selectInitialOption(selectedTool))
      setSourceLanguage('English')
      setAttachments([])
      setResult(null)
      setError('')
      setHistory(loadToolHistory(selectedTool.slug))
      setShowHistory(false)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [selectedTool])

  const { isListening, isRequesting, toggleListening } = useVoiceInput({
    onTranscript: (transcript) => setInput((current) => current ? `${current} ${transcript}` : transcript),
    onError: (message) => notify(message, 'warning'),
  })

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const remaining = MAX_DOCUMENTS_PER_MESSAGE - attachments.length
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, remaining))
    event.target.value = ''
    if (files.length === 0) {
      if (remaining <= 0) notify(`Attach up to ${MAX_DOCUMENTS_PER_MESSAGE} files.`, 'warning')
      return
    }

    const pending = files.map((file) => pendingDocument(file, `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`))
    setAttachments((current) => [...current, ...pending])
    await Promise.all(files.map(async (file, index) => {
      const placeholder = pending[index]
      try {
        const ready = await readDocument(file, placeholder.id)
        setAttachments((current) => current.map((item) => item.id === ready.id ? ready : item))
      } catch (fileError) {
        const message = fileError instanceof Error ? fileError.message : `AirGPT could not read ${file.name}.`
        setAttachments((current) => current.map((item) => item.id === placeholder.id ? { ...item, status: 'error', error: message } : item))
      }
    }))
  }

  const runTool = async () => {
    if (busy) return
    const readyFiles = attachments.filter((file) => file.status === 'ready')
    if (!input.trim() && readyFiles.length === 0) {
      setError(selectedTool.acceptsFiles ? 'Add a request or attach a file first.' : 'Add a request first.')
      return
    }
    if (attachments.some((file) => file.status === 'processing')) {
      setError('Wait for your files to finish processing first.')
      return
    }

    setBusy(true)
    setError('')
    setResult(null)
    try {
      const submittedOption = selectedTool.slug === 'translation' ? `${sourceLanguage} → ${option}` : option
      const response = await fetch('/api/tools/run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: selectedTool.slug,
          input,
          option: submittedOption,
          documents: readyFiles.map(({ name, text }) => ({ name, text })),
        }),
      })
      const data = await response.json().catch(() => ({})) as ToolResult & { error?: string }
      if (!response.ok) throw new Error(data.error || `${selectedTool.name} could not complete this request.`)
      setResult(data)
      const historyText = data.reply ?? data.revisedPrompt ?? ''
      if (historyText) setHistory(saveToolHistoryEntry(selectedTool.slug, { input, option, reply: historyText, provider: data.provider }))
      notify(`${selectedTool.name} result ready`, 'success')
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : `${selectedTool.name} could not complete this request.`)
    } finally {
      setBusy(false)
    }
  }

  const loadHistoryEntry = (entry: ToolHistoryEntry) => {
    setInput(entry.input)
    const directionMatch = selectedTool.slug === 'translation' ? entry.option.match(/^(.+?)\s*→\s*(.+)$/) : null
    if (directionMatch) {
      setSourceLanguage(directionMatch[1].trim())
      setOption(directionMatch[2].trim())
    } else {
      setOption(entry.option || selectInitialOption(selectedTool))
    }
    setResult({ reply: entry.reply, provider: entry.provider })
    setError('')
    setShowHistory(false)
  }

  const copyResult = async () => {
    const text = result?.reply ?? result?.revisedPrompt ?? ''
    if (!text) return
    await navigator.clipboard.writeText(text)
    notify('Copied to clipboard', 'success')
  }

  const downloadResult = () => {
    if (!result) return
    if (result.file) {
      downloadDataUrl(result.file, result.filename ?? resultFilename(selectedTool, 'pptx'))
      return
    }
    if (result.image) {
      downloadDataUrl(result.image, resultFilename(selectedTool, 'png'))
      return
    }
    if (result.reply) downloadText(selectedTool, result.reply)
  }

  const Icon = TOOL_ICONS[selectedTool.slug] ?? WandSparkles
  const style = CATEGORY_STYLE[selectedTool.category]
  const canRun = Boolean(input.trim() || attachments.some((file) => file.status === 'ready'))

  return (
    <div className="space-y-7">
      <section className="tool-studio-hero relative overflow-hidden rounded-[2rem] border border-white/10 px-5 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-200">
              <Sparkles className="size-3.5 text-violet-200" /> Tool studio
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">One idea. Pick the right tool and make it real.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">Choose from the left sidebar, give AirGPT the context, and leave with a readable, downloadable result.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[[String(AI_TOOLS.length), 'focused tools'], ['5', 'file formats+'], ['1', 'connected space']].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/9 bg-black/20 px-3 py-3 text-center backdrop-blur sm:px-4">
                <p className="text-xl font-semibold text-white">{value}</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-500 sm:text-[10px]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5">
        <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[oklch(0.13_0.014_265_/_82%)] shadow-2xl shadow-black/30">
          <div className={cn('border-b border-white/8 bg-gradient-to-br p-5 sm:p-7', style.card)}>
            <div className="flex items-start gap-4">
              <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl border shadow-lg', style.icon)}><Icon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-white sm:text-2xl">{selectedTool.name}</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] text-zinc-400"><span className={cn('size-1.5 rounded-full', style.dot)} />{selectedTool.category}</span>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-zinc-400">{selectedTool.description}. {selectedTool.outputHint}</p>
              </div>
            </div>
          </div>

          <div className="grid min-h-[38rem] xl:grid-cols-[minmax(0,0.98fr)_minmax(28rem,1.02fr)]">
            <form onSubmit={(event) => { event.preventDefault(); void runTool() }} className="border-b border-white/8 p-5 sm:p-7 xl:border-b-0 xl:border-r">
              <label htmlFor="tool-input" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300">{selectedTool.inputLabel}</label>
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition focus-within:border-white/30 focus-within:ring-2 focus-within:ring-white/6">
                <textarea id="tool-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={selectedTool.placeholder} rows={12} className="min-h-72 w-full resize-y bg-transparent px-5 py-5 text-sm leading-7 text-white outline-none placeholder:text-zinc-650" />
                <div className="flex flex-wrap items-center gap-2 border-t border-white/7 px-3 py-2.5">
                  <button type="button" onClick={() => void toggleListening()} disabled={isRequesting} aria-pressed={isListening} className={cn('inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition', isListening ? 'border-rose-300/30 bg-rose-400/12 text-rose-100' : 'border-white/9 bg-white/[0.035] text-zinc-400 hover:bg-white/8 hover:text-white')}>
                    {isRequesting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Mic2 className={cn('size-3.5', isListening && 'animate-pulse')} />}
                    {isListening ? 'Listening…' : 'Speak'}
                  </button>
                  {selectedTool.acceptsFiles && (
                    <>
                      <input ref={fileInputRef} type="file" multiple accept={selectedTool.fileAccept ?? DOCUMENT_ACCEPT} onChange={(event) => void addFiles(event)} className="sr-only" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/9 bg-white/[0.035] px-3 text-xs font-medium text-zinc-400 transition hover:bg-white/8 hover:text-white"><Paperclip className="size-3.5" />Attach files</button>
                    </>
                  )}
                  <button type="button" onClick={() => setInput(selectedTool.example)} className="ml-auto min-h-9 rounded-xl px-3 text-xs font-medium text-zinc-500 transition hover:bg-white/7 hover:text-white">Use example</button>
                </div>
              </div>

              {selectedTool.slug === 'translation' ? (
                <fieldset className="mt-5">
                  <legend className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300">Translation direction</legend>
                  <div className="mt-2 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <label className="block">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">From</span>
                      <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/30">
                        {TRANSLATION_LANGUAGES.map((language) => <option key={language} value={language} className="bg-zinc-900">{language}</option>)}
                      </select>
                    </label>
                    <ArrowRight className="hidden size-4 shrink-0 text-zinc-600 sm:mb-3 sm:block" />
                    <label className="block">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">To</span>
                      <select value={option} onChange={(event) => setOption(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/30">
                        {TRANSLATION_LANGUAGES.map((language) => <option key={language} value={language} className="bg-zinc-900">{language}</option>)}
                      </select>
                    </label>
                  </div>
                </fieldset>
              ) : selectedTool.options && selectedTool.options.length > 0 && (
                <fieldset className="mt-5">
                  <legend className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300">{selectedTool.optionLabel}</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTool.options.map((item) => (
                      <button key={item} type="button" onClick={() => setOption(item)} aria-pressed={option === item} className={cn('rounded-xl border px-4 py-2.5 text-sm font-medium transition', option === item ? 'border-white/30 bg-white text-black' : 'border-white/9 bg-white/[0.035] text-zinc-400 hover:border-white/20 hover:text-white')}>{item}</button>
                    ))}
                  </div>
                </fieldset>
              )}

              {attachments.length > 0 && (
                <div className="mt-5 space-y-2" aria-label="Attached files">
                  {attachments.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      {file.status === 'processing' ? <LoaderCircle className="size-4 animate-spin text-cyan-200" /> : file.status === 'error' ? <X className="size-4 text-rose-300" /> : <FileText className="size-4 text-emerald-200" />}
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-zinc-200">{file.name}</p><p className={cn('mt-0.5 truncate text-[10px]', file.status === 'error' ? 'text-rose-300' : 'text-zinc-600')}>{file.error ?? (file.status === 'processing' ? 'Reading file…' : `${file.size}${file.truncated ? ' · shortened' : ''}`)}</p></div>
                      <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))} aria-label={`Remove ${file.name}`} className="interactive-icon size-8"><Trash2 className="size-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              {error && <p role="alert" className="mt-5 rounded-xl border border-rose-300/15 bg-rose-400/8 p-3 text-xs leading-5 text-rose-100">{error}</p>}

              <button type="submit" disabled={busy || !canRun} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-white via-zinc-100 to-zinc-300 px-5 text-sm font-bold text-black shadow-xl shadow-black/30 transition hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-35">
                {busy ? <><LoaderCircle className="size-4 animate-spin" />Creating…</> : <><WandSparkles className="size-4" />{selectedTool.actionLabel}<ArrowRight className="size-4" /></>}
              </button>
            </form>

            <div className="flex min-h-[34rem] min-w-0 flex-col bg-black/10 p-5 sm:p-7">
              <div className="flex min-h-9 items-center justify-between gap-3">
                <div><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300">Result</p>{result?.provider && !showHistory && <p className="mt-1 text-[10px] text-zinc-700">Created with {result.provider}</p>}</div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setShowHistory((current) => !current)} aria-pressed={showHistory} aria-label="Toggle history" title="History" className={cn('interactive-icon relative', showHistory && 'bg-white/10 text-white')}>
                    <HistoryIcon className="size-4" />
                    {history.length > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold text-white">{history.length}</span>}
                  </button>
                  {result && !showHistory && (
                    <>
                      {!result.image && <button type="button" onClick={() => void copyResult()} aria-label="Copy result" title="Copy result" className="interactive-icon"><Clipboard className="size-4" /></button>}
                      <button type="button" onClick={downloadResult} aria-label="Download result" title="Download result" className="interactive-icon"><Download className="size-4" /></button>
                      <button type="button" onClick={() => { setResult(null); setError('') }} aria-label="Clear result" title="Clear result" className="interactive-icon"><RefreshCw className="size-4" /></button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 min-h-0 flex-1">
                {showHistory ? (
                  <div className="h-full space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500">{history.length} recent {history.length === 1 ? 'run' : 'runs'} for {selectedTool.name}</p>
                      {history.length > 0 && (
                        <button type="button" onClick={() => { clearToolHistory(selectedTool.slug); setHistory([]) }} className="text-[11px] font-medium text-zinc-600 transition hover:text-rose-300">Clear history</button>
                      )}
                    </div>
                    {history.length === 0 ? (
                      <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.018] px-6 text-center">
                        <HistoryIcon className="size-8 text-zinc-700" />
                        <p className="mt-3 text-sm font-medium text-white">No history yet</p>
                        <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-600">Runs you complete with {selectedTool.name} will show up here so you can revisit what you talked about.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto">
                        {history.map((entry) => (
                          <div key={entry.id} className="group flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-3 transition hover:border-white/20">
                            <button type="button" onClick={() => loadHistoryEntry(entry)} className="min-w-0 flex-1 text-left">
                              <p className="truncate text-xs font-medium text-zinc-200">{entry.input || '(no input text)'}</p>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-600">{entry.reply}</p>
                              <p className="mt-1.5 text-[10px] text-zinc-700">{new Date(entry.createdAt).toLocaleString()}{entry.option ? ` · ${entry.option}` : ''}</p>
                            </button>
                            <button type="button" onClick={() => setHistory(deleteToolHistoryEntry(selectedTool.slug, entry.id))} aria-label="Delete this history entry" className="interactive-icon size-7 shrink-0 opacity-0 transition group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : busy ? (
                  <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.018] text-center">
                    <span className={cn('relative flex size-14 items-center justify-center rounded-2xl border', style.icon)}><LoaderCircle className="size-6 animate-spin" /></span>
                    <p className="mt-4 text-sm font-medium text-white">{selectedTool.actionLabel} in progress</p>
                    <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-600">AirGPT is shaping your input into a useful, editable result.</p>
                  </div>
                ) : result?.image ? (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    {/* A generated data URL is returned only by the authenticated server route. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.image} alt={result.revisedPrompt || input || 'Generated by Air Nexus'} className="aspect-square w-full object-contain" />
                    {result.revisedPrompt && <p className="border-t border-white/8 p-3 text-[10px] leading-5 text-zinc-600">{result.revisedPrompt}</p>}
                  </div>
                ) : result?.reply ? (
                  <div className="space-y-4">
                    {selectedTool.slug === 'presentation-maker' && result.file && (
                      <div className="flex items-center gap-3 rounded-2xl border border-violet-300/20 bg-violet-400/10 p-4 text-sm text-violet-50">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-300/15"><Presentation className="size-5" /></span>
                        <div className="min-w-0 flex-1"><p className="font-semibold text-white">PowerPoint file ready</p><p className="mt-0.5 truncate text-xs text-violet-100/70">{result.filename ?? 'air-nexus-presentation.pptx'}{result.theme ? ` · ${result.theme} design` : ''}</p></div>
                        <button type="button" onClick={downloadResult} className="secondary-action shrink-0"><Download className="size-4" />Download</button>
                      </div>
                    )}
                    {selectedTool.slug === 'presentation-maker' && <PresentationPreview text={result.reply} />}
                    {selectedTool.slug === 'mind-maps' && <MindMapPreview text={result.reply} fallbackTopic={input} />}
                    {(selectedTool.slug === 'code-generation' || selectedTool.slug === 'sql-assistant') && <CodeCopyBar text={result.reply} notify={notify} />}
                    {selectedTool.slug === 'grammar-checker' && <GrammarDiffPreview original={input} reply={result.reply} />}
                    {selectedTool.slug === 'translation' && <TranslationPreview original={input} reply={result.reply} notify={notify} />}
                    {selectedTool.slug === 'resume-builder' && <ResumePreview text={result.reply} />}
                    {selectedTool.slug === 'ai-detector' && <AiDetectorPreview text={result.reply} stats={result.stylometricStats} />}
                    {selectedTool.slug === 'ai-humaniser' && <HumaniserPreview original={input} reply={result.reply} stats={result.humaniserStats} notify={notify} />}
                    {selectedTool.slug === 'email-assistant' && <EmailPreview text={result.reply} notify={notify} />}
                    <div className={cn('rounded-2xl border border-white/8 bg-white/[0.025] p-5 text-sm leading-7 text-zinc-300', STRUCTURED_PREVIEW_SLUGS.has(selectedTool.slug) && 'max-h-[26rem] overflow-y-auto')}>
                      <AiMarkdown>{result.reply}</AiMarkdown>
                    </div>
                    {result.sources && result.sources.length > 0 && <SourceList sources={result.sources} />}
                  </div>
                ) : (
                  <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.018] px-6 text-center">
                    <span className={cn('flex size-14 items-center justify-center rounded-2xl border', style.icon)}><Icon className="size-6" /></span>
                    <p className="mt-4 text-sm font-medium text-white">Your {selectedTool.name.toLowerCase()} result will appear here</p>
                    <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-600">{selectedTool.outputHint}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function PresentationPreview({ text }: { text: string }) {
  const slides = text.split(/(?=^##\s+Slide\s+\d+)/gim).map((chunk) => chunk.trim()).filter((chunk) => /^##\s+Slide\s+\d+/i.test(chunk)).slice(0, 12)
  if (slides.length === 0) return null
  return (
    <div className="scrollbar-thin flex snap-x gap-3 overflow-x-auto pb-2" aria-label="Presentation preview">
      {slides.map((slide, index) => {
        const lines = slide.split('\n')
        const title = lines[0].replace(/^##\s+Slide\s+\d+[:\s-]*/i, '').trim() || `Slide ${index + 1}`
        const body = lines.slice(1).filter((line) => line.trim() && !/^\*?\*?(Visual|Speaker notes)\*?\*?:?/i.test(line.trim())).slice(0, 5).join('\n')
        return (
          <article key={`${title}-${index}`} className="aspect-video w-[17rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-violet-300/15 bg-[radial-gradient(circle_at_100%_0%,rgba(167,139,250,.24),transparent_42%),linear-gradient(145deg,#181426,#09090b)] p-5 shadow-xl shadow-black/20">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-200/70">{String(index + 1).padStart(2, '0')}</span>
            <h4 className="mt-3 line-clamp-2 text-lg font-semibold leading-tight text-white">{title}</h4>
            <p className="mt-3 line-clamp-4 whitespace-pre-line text-[10px] leading-4 text-zinc-400">{body.replace(/^[-*]\s+/gm, '• ')}</p>
          </article>
        )
      })}
    </div>
  )
}

function MindMapPreview({ text, fallbackTopic }: { text: string; fallbackTopic: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const root = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, '').trim() || fallbackTopic.slice(0, 70) || 'Central idea'
  const branches: Array<{ title: string; children: string[] }> = []
  for (const line of lines) {
    const match = line.match(/^(\s*)[-*+]\s+(.+)$/)
    if (!match) continue
    const depth = match[1].replace(/\t/g, '  ').length
    const value = match[2].replace(/\*\*/g, '').trim()
    if (depth < 2) branches.push({ title: value, children: [] })
    else branches.at(-1)?.children.push(value)
  }
  if (branches.length === 0) return null
  return (
    <div className="rounded-2xl border border-cyan-300/12 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.1),transparent_40%)] p-4">
      <div className="mx-auto w-fit max-w-[16rem] rounded-2xl border border-cyan-200/30 bg-cyan-300/10 px-4 py-3 text-center text-sm font-semibold text-cyan-50 shadow-lg shadow-cyan-950/30">{root}</div>
      <div className="mx-auto h-5 w-px bg-cyan-200/25" />
      <div className="grid gap-2 sm:grid-cols-2">
        {branches.slice(0, 8).map((branch) => (
          <div key={branch.title} className="rounded-xl border border-white/9 bg-black/25 p-3">
            <p className="text-xs font-semibold text-white">{branch.title}</p>
            {branch.children.length > 0 && <ul className="mt-2 space-y-1 text-[10px] leading-4 text-zinc-500">{branch.children.slice(0, 4).map((child) => <li key={child}>↳ {child}</li>)}</ul>}
          </div>
        ))}
      </div>
    </div>
  )
}

type CodeBlock = { language: string; code: string }

function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const regex = /```(\w*)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const code = match[2].replace(/\n$/, '')
    if (code.trim()) blocks.push({ language: match[1] || 'code', code })
  }
  return blocks.slice(0, 10)
}

/** A quick-copy bar for each fenced code block in the reply — AiMarkdown already renders code blocks nicely, but has no way to copy just one block without manually selecting text. */
function CodeCopyBar({ text, notify }: { text: string; notify: (message: string, tone?: NoticeTone) => void }) {
  const blocks = useMemo(() => extractCodeBlocks(text), [text])
  if (blocks.length === 0) return null
  const copyBlock = async (block: CodeBlock) => {
    await navigator.clipboard.writeText(block.code)
    notify(`${block.language} snippet copied`, 'success')
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.04] p-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200/80">Copy a block</span>
      {blocks.map((block, index) => (
        <button key={index} type="button" onClick={() => void copyBlock(block)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:border-emerald-300/30 hover:text-white">
          <Clipboard className="size-3" />{block.language}{blocks.length > 1 ? ` #${index + 1}` : ''}
        </button>
      ))}
    </div>
  )
}

type DiffToken = { text: string; type: 'same' | 'added' | 'removed' }

/** Standard word-level LCS diff. Capped by the caller to short/medium text so the O(m*n) table stays cheap. */
function diffWords(original: string, updated: string): DiffToken[] {
  const a = original.split(/(\s+)/).filter((token) => token.length > 0)
  const b = updated.split(/(\s+)/).filter((token) => token.length > 0)
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const tokens: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) { tokens.push({ text: a[i], type: 'same' }); i += 1; j += 1 }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { tokens.push({ text: a[i], type: 'removed' }); i += 1 }
    else { tokens.push({ text: b[j], type: 'added' }); j += 1 }
  }
  while (i < m) { tokens.push({ text: a[i], type: 'removed' }); i += 1 }
  while (j < n) { tokens.push({ text: b[j], type: 'added' }); j += 1 }
  return tokens
}

const GRAMMAR_MAX_DIFF_LENGTH = 4000

/** Grammar Checker's instruction asks for the full corrected text followed by a changes list — split on that boundary so the diff only compares the corrected text, not the notes about it. */
function splitGrammarReply(reply: string): { corrected: string } {
  const markerPattern = /\n{1,2}(#{1,3}\s*)?\*{0,2}(Key )?[Cc]hanges?\*{0,2}:?\s*\n/
  const match = reply.match(markerPattern)
  if (match && match.index !== undefined && match.index > 15) return { corrected: reply.slice(0, match.index).trim() }
  return { corrected: reply.trim() }
}

function GrammarDiffPreview({ original, reply }: { original: string; reply: string }) {
  const { corrected } = useMemo(() => splitGrammarReply(reply), [reply])
  const tokens = useMemo(() => {
    if (!original.trim() || !corrected.trim() || original.length + corrected.length > GRAMMAR_MAX_DIFF_LENGTH) return null
    return diffWords(original, corrected)
  }, [original, corrected])
  if (!tokens) return null
  return (
    <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.04] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">What changed</p>
      <p className="mt-2 text-sm leading-7 text-zinc-200">
        {tokens.map((token, index) => {
          if (token.type === 'same') return <Fragment key={index}>{token.text}</Fragment>
          if (token.type === 'added') return <span key={index} className="rounded bg-emerald-400/20 px-0.5 text-emerald-100">{token.text}</span>
          return <span key={index} className="rounded bg-rose-400/20 px-0.5 text-rose-200/70 line-through">{token.text}</span>
        })}
      </p>
    </div>
  )
}

/** Translation's instruction can append a short note about an ambiguous phrase after the translation itself — split on that boundary so the side-by-side view only shows the translation. */
function splitTranslationReply(reply: string): { translation: string; note: string } {
  const markerPattern = /\n{1,2}\(?\*{0,2}Note\*{0,2}:?/i
  const match = reply.match(markerPattern)
  if (match && match.index !== undefined && match.index > 10) return { translation: reply.slice(0, match.index).trim(), note: reply.slice(match.index).trim() }
  return { translation: reply.trim(), note: '' }
}

function TranslationPreview({ original, reply, notify }: { original: string; reply: string; notify: (message: string, tone?: NoticeTone) => void }) {
  const { translation, note } = useMemo(() => splitTranslationReply(reply), [reply])
  if (!original.trim() || !translation.trim()) return null
  const copySide = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    notify(`${label} copied`, 'success')
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="grid divide-y divide-white/8 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Original</p>
            <button type="button" onClick={() => void copySide(original, 'Original')} aria-label="Copy original text" className="interactive-icon size-7"><Clipboard className="size-3.5" /></button>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{original}</p>
        </div>
        <div className="bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">Translation</p>
            <button type="button" onClick={() => void copySide(translation, 'Translation')} aria-label="Copy translation" className="interactive-icon size-7"><Clipboard className="size-3.5" /></button>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white">{translation}</p>
        </div>
      </div>
      {note && <div className="border-t border-white/8 px-4 py-3 text-xs leading-5 text-zinc-500"><AiMarkdown>{note}</AiMarkdown></div>}
    </div>
  )
}

type ResumeSection = { heading: string; body: string[] }

function parseResume(text: string): { header: string[]; sections: ResumeSection[] } | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const headingIndexes: number[] = []
  lines.forEach((line, index) => { if (/^##\s+/.test(line)) headingIndexes.push(index) })
  if (headingIndexes.length === 0) return null
  const header = lines.slice(0, headingIndexes[0]).map((line) => line.replace(/^#\s+/, '').trim()).filter(Boolean)
  const sections: ResumeSection[] = []
  for (let i = 0; i < headingIndexes.length; i++) {
    const start = headingIndexes[i]
    const end = i + 1 < headingIndexes.length ? headingIndexes[i + 1] : lines.length
    const heading = lines[start].replace(/^##\s+/, '').trim()
    const body = lines.slice(start + 1, end).map((line) => line.trim()).filter(Boolean)
    if (heading) sections.push({ heading, body })
  }
  return sections.length > 0 ? { header, sections } : null
}

function ResumePreview({ text }: { text: string }) {
  const parsed = useMemo(() => parseResume(text), [text])
  if (!parsed) return null
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white text-zinc-900 shadow-xl">
      {parsed.header.length > 0 && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-5 text-center">
          {parsed.header.map((line, index) => (
            <p key={index} className={index === 0 ? 'text-xl font-bold tracking-tight text-zinc-900' : 'mt-1 text-xs text-zinc-500'}>{line}</p>
          ))}
        </div>
      )}
      <div className="divide-y divide-zinc-100">
        {parsed.sections.map((section) => (
          <div key={section.heading} className="px-6 py-4">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{section.heading}</h4>
            <div className="mt-2 space-y-1">
              {section.body.map((line, index) => {
                const bullet = line.match(/^[-*+]\s+(.+)$/)
                return bullet ? (
                  <p key={index} className="flex gap-2 text-xs leading-5 text-zinc-700"><span className="text-zinc-400">•</span><span>{bullet[1]}</span></p>
                ) : (
                  <p key={index} className="text-xs leading-5 text-zinc-700">{line}</p>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type DetectorVerdict = { score: number | null; verdict: string; confidence: string; signals: string[]; reasoning: string }

function parseDetectorReply(text: string): DetectorVerdict | null {
  const verdictMatch = text.match(/##\s*Verdict:?\s*(.+)/i)
  if (!verdictMatch) return null
  const scoreMatch = text.match(/##\s*AI likelihood score:?\s*(\d{1,3})/i)
  const confidenceMatch = text.match(/##\s*Confidence:?\s*(.+)/i)
  const signalsSection = text.match(/##\s*Signals detected\s*\n([\s\S]*?)(?=\n##|$)/i)
  const signals = signalsSection
    ? signalsSection[1].split('\n').map((line) => line.trim()).filter((line) => /^[-*+]\s+/.test(line)).map((line) => line.replace(/^[-*+]\s+/, '').replace(/\*\*/g, '')).slice(0, 8)
    : []
  const reasoningSection = text.match(/##\s*Reasoning\s*\n([\s\S]*?)(?=\n##|$)/i)
  return {
    score: scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : null,
    verdict: verdictMatch[1].trim().replace(/\*\*/g, ''),
    confidence: confidenceMatch?.[1].trim().replace(/\*\*/g, '') ?? 'Unknown',
    signals,
    reasoning: reasoningSection ? reasoningSection[1].trim() : '',
  }
}

function ScoreMeter({ score, label = 'AI likelihood' }: { score: number; label?: string }) {
  const tone = score >= 66 ? 'bg-amber-400' : score >= 34 ? 'bg-violet-400' : 'bg-emerald-400'
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-bold text-white">{score}<span className="text-sm font-medium text-zinc-500">/100</span></span>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

type DetectorStats = NonNullable<ToolResult['stylometricStats']>

/** AI-writing detectors (including this one) are pattern-matching, not proof — the caveat below is rendered unconditionally rather than trusted to the model's own reply text. */
function AiDetectorPreview({ text, stats }: { text: string; stats?: DetectorStats }) {
  const parsed = useMemo(() => parseDetectorReply(text), [text])
  if (!parsed) return null
  const score = parsed.score ?? stats?.score ?? null
  const verdictTone = /likely ai/i.test(parsed.verdict)
    ? 'border-amber-300/25 bg-amber-400/10 text-amber-100'
    : /mixed/i.test(parsed.verdict)
      ? 'border-violet-300/25 bg-violet-400/10 text-violet-100'
      : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
  return (
    <div className="space-y-3">
      <div className={cn('rounded-2xl border p-4', verdictTone)}>
        {score !== null && <ScoreMeter score={score} />}
        <p className={cn('font-semibold', score !== null ? 'mt-3 text-base' : 'text-lg')}>{parsed.verdict}</p>
        <p className="mt-1 text-xs opacity-80">Confidence: {parsed.confidence}</p>
      </div>
      {parsed.signals.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Signals noticed</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-300">
            {parsed.signals.map((signal, index) => <li key={index} className="flex gap-2"><span className="text-zinc-600">•</span><span>{signal}</span></li>)}
          </ul>
        </div>
      )}
      {stats && stats.wordCount >= 40 && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Computed text statistics</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-zinc-300">
            <dt className="text-zinc-600">Sentence rhythm variation</dt><dd>{stats.burstiness !== null ? stats.burstiness.toFixed(2) : '—'}</dd>
            <dt className="text-zinc-600">Vocabulary diversity</dt><dd>{stats.vocabDiversity !== null ? stats.vocabDiversity.toFixed(2) : '—'}</dd>
            <dt className="text-zinc-600">Contractions / 100 words</dt><dd>{stats.contractionsPer100Words.toFixed(1)}</dd>
            <dt className="text-zinc-600">AI-favoured phrases found</dt><dd>{stats.aiPhraseHits.length}</dd>
          </dl>
          {stats.aiPhraseHits.length > 0 && <p className="mt-2 text-[11px] leading-4 text-zinc-500">Found: {stats.aiPhraseHits.join(', ')}</p>}
        </div>
      )}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-[11px] leading-5 text-zinc-500">
        AI-writing detectors — including this one — are not reliable proof of authorship, and they misfire more often on formal or non-native-English writing. Treat this as a starting signal, not a verdict, and never as grounds for an accusation on its own.
      </div>
    </div>
  )
}

type HumaniserStats = NonNullable<ToolResult['humaniserStats']>

function RiskScoreCard({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      {score === null ? (
        <p className="mt-3 text-sm font-semibold text-zinc-300">Not enough text to score</p>
      ) : (
        <div className="mt-2"><ScoreMeter score={score} label="Pattern risk" /></div>
      )}
    </div>
  )
}

function statValue(value: number | null, digits = 2) {
  return value === null ? '?' : value.toFixed(digits)
}

function HumaniserPreview({ original, reply, stats, notify }: { original: string; reply: string; stats?: HumaniserStats; notify: (message: string, tone?: NoticeTone) => void }) {
  const { rewritten, changes } = useMemo(() => splitHumaniserReply(reply), [reply])
  if (!original.trim() || !rewritten.trim()) return null
  const copySide = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    notify(`${label} copied`, 'success')
  }
  const riskChange = stats?.riskChange ?? null
  const changeTone = riskChange === null
    ? 'border-white/10 bg-white/[0.035] text-zinc-300'
    : riskChange > 0
      ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
      : riskChange < 0
        ? 'border-amber-300/20 bg-amber-400/10 text-amber-100'
        : 'border-violet-300/20 bg-violet-400/10 text-violet-100'
  const changeLabel = riskChange === null
    ? 'Needs 40+ words for score'
    : riskChange > 0
      ? `${riskChange} point risk drop`
      : riskChange < 0
        ? `${Math.abs(riskChange)} point risk rise`
        : 'No score change'

  return (
    <div className="space-y-3">
      {stats && (
        <div className="rounded-2xl border border-cyan-300/15 bg-[radial-gradient(circle_at_100%_0%,rgba(34,211,238,.14),transparent_40%),rgba(8,15,23,.76)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">Detector-risk check</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Pattern matching is a guide, not a guarantee — this shows whether the rewrite reduced common robotic tells.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/7 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300">{stats.mode} mode</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <RiskScoreCard label="Before" score={stats.before.score} />
            <RiskScoreCard label="After" score={stats.after.score} />
            <div className={cn('flex min-w-36 flex-col justify-center rounded-2xl border p-4', changeTone)}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">Change</p>
              <p className="mt-2 text-lg font-bold">{changeLabel}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-zinc-300 sm:grid-cols-4">
            <dt className="text-zinc-600">Rhythm before</dt><dd>{statValue(stats.before.burstiness)}</dd>
            <dt className="text-zinc-600">Rhythm after</dt><dd>{statValue(stats.after.burstiness)}</dd>
            <dt className="text-zinc-600">Stock phrases before</dt><dd>{stats.before.aiPhraseHits.length}</dd>
            <dt className="text-zinc-600">Stock phrases after</dt><dd>{stats.after.aiPhraseHits.length}</dd>
          </dl>
          {stats.removedAiPhraseHits.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Removed</span>
              {stats.removedAiPhraseHits.map((phrase) => <span key={phrase} className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-100">{phrase}</span>)}
            </div>
          )}
          {stats.remainingAiPhraseHits.length > 0 && (
            <p className="mt-3 text-[11px] leading-4 text-amber-100/70">Still worth checking: {stats.remainingAiPhraseHits.join(', ')}</p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid divide-y divide-white/8 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Original</p>
              <button type="button" onClick={() => void copySide(original, 'Original')} aria-label="Copy original text" className="interactive-icon size-7"><Clipboard className="size-3.5" /></button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{original}</p>
          </div>
          <div className="bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">Humanised</p>
              <button type="button" onClick={() => void copySide(rewritten, 'Humanised text')} aria-label="Copy humanised text" className="interactive-icon size-7"><Clipboard className="size-3.5" /></button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white">{rewritten}</p>
          </div>
        </div>
        {changes && <div className="border-t border-white/8 px-4 py-3 text-xs leading-5 text-zinc-500"><AiMarkdown>{changes}</AiMarkdown></div>}
      </div>
    </div>
  )
}

/** Email Assistant's instruction asks for "Subject: <line>" then a blank line then the body — parse that into a proper email-client-style card. */
function parseEmailReply(text: string): { subject: string; body: string } | null {
  const match = text.match(/^\*{0,2}Subject:?\*{0,2}\s*(.+?)\r?\n\r?\n([\s\S]+)$/i)
  if (!match) return null
  const subject = match[1].trim().replace(/\*\*/g, '')
  const body = match[2].trim()
  if (!subject || !body) return null
  return { subject, body }
}

function EmailPreview({ text, notify }: { text: string; notify: (message: string, tone?: NoticeTone) => void }) {
  const parsed = useMemo(() => parseEmailReply(text), [text])
  if (!parsed) return null
  const copyPart = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    notify(`${label} copied`, 'success')
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white text-zinc-900 shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Subject</p>
          <p className="truncate text-sm font-semibold text-zinc-900">{parsed.subject}</p>
        </div>
        <button type="button" onClick={() => void copyPart(parsed.subject, 'Subject')} className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900">Copy subject</button>
      </div>
      <div className="px-5 py-4">
        <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{parsed.body}</p>
      </div>
      <div className="flex justify-end border-t border-zinc-200 bg-zinc-50 px-5 py-3">
        <button type="button" onClick={() => void copyPart(`Subject: ${parsed.subject}\n\n${parsed.body}`, 'Email')} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900">Copy full email</button>
      </div>
    </div>
  )
}

function SourceList({ sources }: { sources: Array<{ title: string; url: string }> }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Sources checked</p>
      <div className="mt-3 grid gap-2">
        {sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border border-white/7 bg-black/15 p-3 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/5">
            <ExternalLink className="size-3.5 shrink-0 text-cyan-200" />
            <span className="min-w-0 flex-1 truncate">{source.title}</span>
            <span className="hidden truncate text-[9px] text-zinc-700 sm:block">{new URL(source.url).hostname}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

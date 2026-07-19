'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  Bold,
  Check,
  ChevronDown,
  Code2,
  Crown,
  Download,
  Eye,
  Italic,
  Link2,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  PanelRightOpen,
  PenLine,
  Pencil,
  Plus,
  Printer,
  Search,
  Share2,
  Sparkles,
  Type,
  X,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { apiUrl } from '@/lib/api-client'
import { formatAiTextForDocument } from '@/lib/documents/format-ai-text'
import type { NoticeTone } from '@/components/airnexus-app'
import { cn } from '@/lib/utils'

type DocRole = 'owner' | 'editor' | 'viewer'
type ChecklistItem = { id: string; text: string; done: boolean }
type DocSummary = { id: string; title: string; role: DocRole; updatedAt: string; createdAt: string }
type Collaborator = { userId: string; displayName: string; role: 'editor' | 'viewer'; addedAt: string }
type DocDetail = DocSummary & { body: string; ownerId: string; checklist: ChecklistItem[]; collaborators: Collaborator[] }
type SearchResult = { userId: string; displayName: string }
type SuggestionCategory = 'clarity' | 'structure' | 'grammar' | 'evidence' | 'style'
type WritingSuggestion = { id: string; title: string; detail: string; category: SuggestionCategory }
type DocBackup = { title: string; body: string; checklist: ChecklistItem[]; savedAt: string }

const MAX_CHECKLIST_ITEMS = 50
const DEFAULT_BODY = 'Start typing here — AirGPT will suggest ways to improve your writing as you go.'
const DOC_BACKUP_PREFIX = 'airnexus-doc-backup:'
const MIN_SUGGESTION_LENGTH = 20

type DocsPageProps = {
  activeDocId: string | null
  onOpenDoc: (id: string | null) => void
  onOpenSidebar: () => void
  onOpenContext: () => void
  notify: (message: string, tone?: NoticeTone) => void
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function slugify(value: string) {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'document'
}

const roleLabel: Record<DocRole, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' }

const categoryStyles: Record<SuggestionCategory, string> = {
  clarity: 'bg-sky-400/12 text-sky-200',
  structure: 'bg-violet-400/12 text-violet-200',
  grammar: 'bg-rose-400/12 text-rose-200',
  evidence: 'bg-amber-400/12 text-amber-200',
  style: 'bg-emerald-400/12 text-emerald-200',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parseSuggestions(reply: string): WritingSuggestion[] | null {
  const normalized = reply.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = normalized.indexOf('{')
  const end = normalized.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let value: unknown
  try {
    value = JSON.parse(normalized.slice(start, end + 1))
  } catch {
    return null
  }
  if (!isRecord(value) || !Array.isArray(value.suggestions)) return null
  const categories: SuggestionCategory[] = ['clarity', 'structure', 'grammar', 'evidence', 'style']
  return value.suggestions.flatMap((item): WritingSuggestion[] => {
    if (!isRecord(item)) return []
    const title = cleanText(item.title, 120)
    const detail = cleanText(item.detail, 500)
    if (!title || !detail) return []
    const category = categories.includes(item.category as SuggestionCategory) ? item.category as SuggestionCategory : 'style'
    return [{ id: createId('suggestion'), title, detail, category }]
  }).slice(0, 8)
}

function docBackupKey(docId: string) {
  return `${DOC_BACKUP_PREFIX}${docId}`
}

/** Best-effort local mirror of the doc, written on every save. Not the source of truth — recovers the draft if the server is briefly unreachable. */
function readDocBackup(docId: string): DocBackup | null {
  try {
    const raw = window.localStorage.getItem(docBackupKey(docId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DocBackup>
    if (typeof parsed.title !== 'string' || typeof parsed.body !== 'string') return null
    return {
      title: parsed.title,
      body: parsed.body,
      checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function writeDocBackup(docId: string, backup: Omit<DocBackup, 'savedAt'>) {
  try {
    window.localStorage.setItem(docBackupKey(docId), JSON.stringify({ ...backup, savedAt: new Date().toISOString() }))
  } catch {
    // Storage full or unavailable — the server save is the durable copy either way.
  }
}

export function DocsPage({ activeDocId, onOpenDoc, onOpenSidebar, onOpenContext, notify }: DocsPageProps) {
  const [resolveError, setResolveError] = useState('')
  const autoOpenAttempted = useRef(false)

  const [docList, setDocList] = useState<DocSummary[]>([])
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const [doc, setDoc] = useState<DocDetail | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [newChecklistText, setNewChecklistText] = useState('')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareQuery, setShareQuery] = useState('')
  const [shareResults, setShareResults] = useState<SearchResult[]>([])
  const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('editor')
  const [shareSearching, setShareSearching] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')

  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState('')
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null)

  const [writeOpen, setWriteOpen] = useState(false)
  const [writePrompt, setWritePrompt] = useState('')
  const [writeLoading, setWriteLoading] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [writeDraft, setWriteDraft] = useState('')

  const editorRef = useRef<HTMLDivElement>(null)
  const suppressPollRef = useRef(false)
  const lastUpdatedAtRef = useRef<string | null>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const savedSelectionRef = useRef<Range | null>(null)

  const isReadOnly = doc?.role === 'viewer'
  const canShare = doc?.role === 'owner'

  // No manual "create document" step: land straight in an editor. Reopen the
  // most recently updated document you own, or silently start a fresh one.
  const resolveDoc = useCallback(async () => {
    setResolveError('')
    try {
      const response = await fetch('/api/docs', { credentials: 'include', cache: 'no-store' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `Could not load your documents. (HTTP ${response.status})`)
      }
      const data = (await response.json()) as { docs: DocSummary[] }
      setDocList(data.docs)
      const owned = data.docs.filter((item) => item.role === 'owner').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      if (owned[0]) {
        onOpenDoc(owned[0].id)
        return
      }
      const createResponse = await fetch('/api/docs', { method: 'POST', credentials: 'include' })
      const created = await createResponse.json().catch(() => ({})) as DocSummary & { error?: string }
      if (!createResponse.ok || !('id' in created)) throw new Error(created.error ?? 'Could not start a new document.')
      setDocList((current) => [created, ...current])
      onOpenDoc(created.id)
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : 'Could not reach the server.')
    }
  }, [onOpenDoc])

  useEffect(() => {
    if (activeDocId || autoOpenAttempted.current) return
    autoOpenAttempted.current = true
    void resolveDoc()
  }, [activeDocId, resolveDoc])

  // Load the open document whenever the selection changes.
  useEffect(() => {
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setMoreOpen(false)
      setShareOpen(false)
      setSuggestionsOpen(false)
      setSuggestions([])
      if (!activeDocId) {
        setDoc(null)
        return
      }
      setDocLoading(true)
      void (async () => {
        const response = await fetch(`/api/docs/${activeDocId}`, { credentials: 'include', cache: 'no-store' })
        if (cancelled) return
        if (!response.ok) {
          const backup = readDocBackup(activeDocId)
          if (backup) {
            setDoc({ id: activeDocId, title: backup.title, body: backup.body, checklist: backup.checklist, role: 'owner', ownerId: '', updatedAt: backup.savedAt, createdAt: backup.savedAt, collaborators: [] })
            setTitle(backup.title)
            setChecklist(backup.checklist)
            setCollaborators([])
            lastUpdatedAtRef.current = null
            if (editorRef.current) editorRef.current.innerHTML = backup.body || DEFAULT_BODY
            notify('Could not reach the server — showing what was last saved on this device.', 'warning')
            setDocLoading(false)
            return
          }
          notify('Could not open that document.', 'warning')
          onOpenDoc(null)
          setDocLoading(false)
          return
        }
        const data = (await response.json()) as DocDetail
        setDoc(data)
        setTitle(data.title)
        setChecklist(data.checklist)
        setCollaborators(data.collaborators)
        lastUpdatedAtRef.current = data.updatedAt
        if (editorRef.current) editorRef.current.innerHTML = data.body || DEFAULT_BODY
        setDocLoading(false)
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId])

  // Poll for collaborator edits — skipped while the user is actively typing.
  useEffect(() => {
    if (!activeDocId) return
    const id = window.setInterval(() => {
      if (suppressPollRef.current || document.visibilityState !== 'visible') return
      void (async () => {
        const response = await fetch(`/api/docs/${activeDocId}`, { credentials: 'include', cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as DocDetail
        if (lastUpdatedAtRef.current && data.updatedAt <= lastUpdatedAtRef.current) return
        lastUpdatedAtRef.current = data.updatedAt
        setDoc(data)
        setTitle(data.title)
        setChecklist(data.checklist)
        setCollaborators(data.collaborators)
        if (editorRef.current) editorRef.current.innerHTML = data.body || DEFAULT_BODY
      })()
    }, 5000)
    return () => window.clearInterval(id)
  }, [activeDocId])

  const savePatch = useCallback((patch: { title?: string; body?: string; checklist?: ChecklistItem[] }) => {
    if (!activeDocId || isReadOnly) return
    writeDocBackup(activeDocId, {
      title: patch.title ?? title,
      body: patch.body ?? (editorRef.current?.innerHTML ?? ''),
      checklist: patch.checklist ?? checklist,
    })
    void fetch(`/api/docs/${activeDocId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string }
        notify(data.error ?? 'Could not save to the server — kept on this device.', 'warning')
        return
      }
      const updated = (await response.json()) as DocSummary
      lastUpdatedAtRef.current = updated.updatedAt
      setDocList((current) => current.map((item) => item.id === activeDocId ? { ...item, title: updated.title, updatedAt: updated.updatedAt } : item))
    }).catch(() => notify('Could not reach the server — kept on this device.', 'warning'))
  }, [activeDocId, isReadOnly, notify, title, checklist])

  const saveBodyDebounced = useCallback(() => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = window.setTimeout(() => {
      savePatch({ body: editorRef.current?.innerHTML ?? '' })
    }, 600)
  }, [savePatch])

  const captureEditorSelection = () => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current) return
    const range = selection.getRangeAt(0)
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange()
    }
  }

  const restoreEditorSelection = () => {
    const range = savedSelectionRef.current
    if (!range) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const runEditorCommand = (command: string, value?: string) => {
    if (isReadOnly) return
    editorRef.current?.focus()
    restoreEditorSelection()
    document.execCommand(command, false, value)
    captureEditorSelection()
    saveBodyDebounced()
  }

  const startNewDraft = async () => {
    const response = await fetch('/api/docs', { method: 'POST', credentials: 'include' })
    const data = await response.json().catch(() => ({})) as DocSummary & { error?: string }
    if (!response.ok || !('id' in data)) {
      notify((data as { error?: string }).error ?? 'Could not start a new draft.', 'warning')
      return
    }
    setDocList((current) => [data, ...current])
    notify('Started a new draft', 'success')
    onOpenDoc(data.id)
  }

  const exportDoc = () => {
    const body = editorRef.current?.innerText ?? ''
    downloadText(`airgpt-${slugify(title)}.md`, '# ' + title + '\n\n' + body)
    notify('Article downloaded', 'success')
  }

  const getSuggestions = async () => {
    const text = editorRef.current?.innerText?.trim() ?? ''
    if (text.length < MIN_SUGGESTION_LENGTH) {
      notify('Write a bit more before asking for suggestions.', 'info')
      return
    }
    setSuggestionsLoading(true)
    setSuggestionsError('')
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.slice(0, 8_000), mode: 'auto', action: 'writing-suggestions', history: [], documents: [] }),
      })
      const data = await response.json().catch(() => ({})) as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Could not get suggestions')
      const parsed = parseSuggestions(data.reply)
      if (!parsed || parsed.length === 0) throw new Error('AirGPT returned suggestions in an unexpected format')
      setSuggestions(parsed)
    } catch (error) {
      setSuggestionsError(error instanceof Error ? error.message : 'Could not get suggestions')
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const dismissSuggestion = (id: string) => setSuggestions((current) => current.filter((item) => item.id !== id))

  // Rewrites the whole document to incorporate one suggestion — there's no
  // reliable way to patch a single sentence inside contentEditable HTML from
  // a model reply, so "Apply" is a full, faithful rewrite rather than a
  // partial diff. The previous version is still recoverable from the local
  // backup written just before this overwrites it.
  const applySuggestion = async (suggestion: WritingSuggestion) => {
    if (isReadOnly || applyingSuggestionId) return
    setApplyingSuggestionId(suggestion.id)
    try {
      const currentText = editorRef.current?.innerText?.trim() ?? ''
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Rewrite this whole document to apply one specific improvement, keeping everything else as close to the original as possible.\nImprovement to apply: ${suggestion.title} — ${suggestion.detail}\n\nCurrent document:\n${currentText.slice(0, 8_000)}`,
          mode: 'auto',
          action: 'draft',
          purpose: 'planning',
          history: [],
          documents: [],
        }),
      })
      const data = await response.json().catch(() => ({})) as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Could not apply that suggestion')
      const nextBody = formatAiTextForDocument(data.reply)
      if (editorRef.current) editorRef.current.innerHTML = nextBody
      savePatch({ body: nextBody })
      dismissSuggestion(suggestion.id)
      notify('Suggestion applied to your document', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not apply that suggestion.', 'warning')
    } finally {
      setApplyingSuggestionId(null)
    }
  }

  const generateWriting = async () => {
    const prompt = writePrompt.trim()
    if (!prompt || writeLoading) return
    setWriteLoading(true)
    setWriteError('')
    setWriteDraft('')
    try {
      const currentText = editorRef.current?.innerText?.trim() ?? ''
      const contextNote = currentText ? `\n\nFor context, here is the document so far:\n${currentText.slice(0, 4_000)}` : ''
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Write this for my document: ${prompt}${contextNote}`, mode: 'auto', action: 'draft', purpose: 'planning', history: [], documents: [] }),
      })
      const data = await response.json().catch(() => ({})) as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Could not write that')
      setWriteDraft(data.reply)
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Could not write that')
    } finally {
      setWriteLoading(false)
    }
  }

  const insertWriteDraft = () => {
    const addition = '<br><br>' + formatAiTextForDocument(writeDraft)
    const nextBody = (editorRef.current?.innerHTML ?? '') + addition
    if (editorRef.current) editorRef.current.innerHTML = nextBody
    savePatch({ body: nextBody })
    notify('Added to your document', 'success')
    setWriteDraft('')
    setWritePrompt('')
    setWriteOpen(false)
  }

  const addChecklistItem = () => {
    const text = newChecklistText.trim()
    if (!text || checklist.length >= MAX_CHECKLIST_ITEMS || isReadOnly) return
    const next = [...checklist, { id: createId('item'), text, done: false }]
    setChecklist(next)
    setNewChecklistText('')
    savePatch({ checklist: next })
  }

  const toggleChecklistItem = (id: string) => {
    if (isReadOnly) return
    const next = checklist.map((item) => item.id === id ? { ...item, done: !item.done } : item)
    setChecklist(next)
    savePatch({ checklist: next })
  }

  const removeChecklistItem = (id: string) => {
    if (isReadOnly) return
    const next = checklist.filter((item) => item.id !== id)
    setChecklist(next)
    savePatch({ checklist: next })
  }

  useEffect(() => {
    if (!shareOpen) return
    const query = shareQuery.trim()
    const timeoutId = window.setTimeout(() => {
      if (!query) {
        setShareResults([])
        return
      }
      setShareSearching(true)
      void (async () => {
        const response = await fetch(`/api/social/search?q=${encodeURIComponent(query)}`, { credentials: 'include', cache: 'no-store' })
        if (response.ok) {
          const data = await response.json() as { results: Array<{ userId: string; displayName: string }> }
          setShareResults(data.results.map((result) => ({ userId: result.userId, displayName: result.displayName })))
        }
        setShareSearching(false)
      })()
    }, query ? 300 : 0)
    return () => window.clearTimeout(timeoutId)
  }, [shareQuery, shareOpen])

  const addCollaborator = async (target: SearchResult) => {
    if (!activeDocId) return
    const response = await fetch(`/api/docs/${activeDocId}/share`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: target.userId, role: shareRole }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string }
      notify(data.error ?? 'Could not share document.', 'warning')
      return
    }
    setCollaborators((current) => [...current.filter((c) => c.userId !== target.userId), { userId: target.userId, displayName: target.displayName, role: shareRole, addedAt: new Date().toISOString() }])
    setShareQuery('')
    setShareResults([])
    notify(`Shared with ${target.displayName}`, 'success')
  }

  const removeCollaborator = async (userId: string) => {
    if (!activeDocId) return
    const response = await fetch(`/api/docs/${activeDocId}/share/${userId}`, { method: 'DELETE', credentials: 'include' })
    if (!response.ok) {
      notify('Could not remove collaborator.', 'warning')
      return
    }
    setCollaborators((current) => current.filter((c) => c.userId !== userId))
  }

  // --- Resolving state (auto-selecting/creating a document; near-instant in the common case) ---

  if (!activeDocId) {
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass-subtle relative z-20 flex shrink-0 items-center justify-between gap-3 border-x-0 border-t-0 px-3 py-3 sm:px-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={onOpenSidebar} aria-label="Open navigation" className="interactive-icon lg:hidden">
              <Menu className="size-5" />
            </button>
            <p className="text-sm font-semibold sm:text-[15px]">Documents</p>
          </div>
          <button type="button" onClick={onOpenContext} aria-label="Open context panel" className="interactive-icon xl:hidden">
            <PanelRightOpen className="size-5" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {resolveError ? (
            <div className="glass max-w-sm rounded-2xl p-6 text-center">
              <p className="text-sm font-semibold text-white">Could not reach the server</p>
              <p className="mt-1 text-xs text-slate-500">{resolveError}</p>
              <button type="button" onClick={() => void resolveDoc()} className="primary-action mx-auto mt-4">
                Try again
              </button>
            </div>
          ) : (
            <div className="w-full max-w-2xl px-6">
              <div className="premium-skeleton h-10 w-2/3 rounded-xl" />
              <div className="premium-skeleton mt-4 h-40 rounded-2xl" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- Editor view ------------------------------------------------------

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="glass-subtle relative z-20 flex shrink-0 items-center justify-between gap-3 border-x-0 border-t-0 px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button type="button" onClick={onOpenSidebar} aria-label="Open navigation" className="interactive-icon lg:hidden">
            <Menu className="size-5" />
          </button>
          <div className="relative min-w-0">
            <button type="button" onClick={() => setSwitcherOpen((open) => !open)} aria-expanded={switcherOpen} className="flex min-w-0 items-center gap-1 rounded-lg py-1 pl-1.5 pr-2 text-left hover:bg-white/5">
              <span className="min-w-0 leading-tight">
                <span className="block max-w-[46vw] truncate text-sm font-semibold sm:max-w-xs sm:text-[15px]">{title}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {doc?.role === 'viewer' ? 'View only' : 'Saved automatically'}
                  <span className="ml-1 inline-block size-1.5 rounded-full bg-emerald-400" />
                </span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
            </button>
            {switcherOpen && (
              <div className="menu-popover left-0 top-14 w-72">
                {docList.length > 1 && (
                  <div className="max-h-72 overflow-y-auto">
                    {docList.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setSwitcherOpen(false); if (item.id !== activeDocId) onOpenDoc(item.id) }}
                        className={cn('flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/8', item.id === activeDocId && 'bg-white/8')}
                      >
                        <span className="min-w-0 truncate">{item.title}</span>
                        {item.role !== 'owner' && <span className="shrink-0 text-[10px] text-slate-500">{roleLabel[item.role]}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className={cn(docList.length > 1 && 'mt-1 border-t border-white/10 pt-1')}>
                  <button type="button" onClick={() => { setSwitcherOpen(false); void startNewDraft() }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/8">
                    <Plus className="size-4" />Start a new draft
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {!isReadOnly && (
            <button type="button" onClick={() => { setWriteOpen((open) => !open); setSuggestionsOpen(false) }} aria-expanded={writeOpen} className="secondary-action px-3 sm:px-4">
              <PenLine className="size-4" />
              <span className="hidden sm:inline">Write with AI</span>
            </button>
          )}
          <button type="button" onClick={() => { setSuggestionsOpen(true); setWriteOpen(false); void getSuggestions() }} disabled={suggestionsLoading} className="secondary-action px-3 sm:px-4 disabled:cursor-wait disabled:opacity-60">
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">{suggestionsLoading ? 'Thinking…' : 'Suggestions'}</span>
          </button>
          <button type="button" onClick={exportDoc} className="primary-action px-3 sm:px-5">
            <Download className="size-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
          {canShare && (
            <button type="button" onClick={() => setShareOpen(true)} aria-label="Share document" className="interactive-icon hidden sm:flex">
              <Share2 className="size-[18px]" />
            </button>
          )}
          <div className="relative hidden sm:block">
            <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-label="Open document menu" aria-expanded={moreOpen} className="interactive-icon">
              <MoreHorizontal className="size-[18px]" />
            </button>
            {moreOpen && (
              <div className="menu-popover right-0 top-11 w-44">
                <button type="button" onClick={() => { setMoreOpen(false); window.print() }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/8">
                  <Printer className="size-4 text-zinc-300" />Print
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={onOpenContext} aria-label="Open context panel" className="interactive-icon xl:hidden">
            <PanelRightOpen className="size-5" />
          </button>
        </div>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {docLoading ? (
            <div className="premium-skeleton h-64 rounded-3xl" />
          ) : (
            <>
              {doc && doc.role !== 'owner' && (
                <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                  {doc.role === 'viewer' ? <Eye className="size-3.5" /> : <Pencil className="size-3.5" />}
                  Shared with you as {roleLabel[doc.role]}{doc.role === 'viewer' ? ' — read only' : ''}
                </div>
              )}

              <h1
                className={cn(
                  'bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent outline-none sm:text-4xl',
                  !isReadOnly && 'cursor-text rounded-lg transition focus:bg-white/[0.025] focus:ring-2 focus:ring-white/20',
                )}
                contentEditable={!isReadOnly}
                suppressContentEditableWarning
                onFocus={() => { suppressPollRef.current = true }}
                onBlur={(event) => {
                  suppressPollRef.current = false
                  const next = event.currentTarget.textContent?.trim() || 'Untitled document'
                  setTitle(next)
                  savePatch({ title: next })
                }}
              >
                {title}
              </h1>

              <div
                ref={editorRef}
                role="textbox"
                aria-label="Editable document body"
                aria-multiline="true"
                contentEditable={!isReadOnly}
                suppressContentEditableWarning
                onFocus={() => { suppressPollRef.current = true }}
                onMouseUp={captureEditorSelection}
                onKeyUp={captureEditorSelection}
                onInput={saveBodyDebounced}
                onBlur={() => {
                  suppressPollRef.current = false
                  captureEditorSelection()
                  savePatch({ body: editorRef.current?.innerHTML ?? '' })
                }}
                className={cn(
                  'mt-4 rounded-xl text-base leading-relaxed text-slate-300 outline-none transition',
                  !isReadOnly && 'focus:bg-white/[0.025] focus:ring-2 focus:ring-white/20',
                )}
              />

              {!isReadOnly && (
                <EditorToolbar
                  linkOpen={linkOpen}
                  linkUrl={linkUrl}
                  onSetLinkUrl={setLinkUrl}
                  onToggleLink={() => setLinkOpen((open) => !open)}
                  onApplyLink={() => {
                    runEditorCommand('createLink', linkUrl)
                    setLinkOpen(false)
                  }}
                  onFormat={runEditorCommand}
                  onAskAi={onOpenContext}
                />
              )}

              {writeOpen && (
                <section className="glass mt-6 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <PenLine className="size-4 text-white/70" />Write with AI
                    </h3>
                    <button type="button" onClick={() => setWriteOpen(false)} aria-label="Close write with AI" className="interactive-icon size-7">
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      autoFocus
                      value={writePrompt}
                      onChange={(event) => setWritePrompt(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter' && writePrompt.trim()) void generateWriting() }}
                      placeholder="e.g. Write an introduction about photosynthesis…"
                      aria-label="What should AirGPT write?"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-white/30"
                    />
                    <button type="button" disabled={!writePrompt.trim() || writeLoading} onClick={() => void generateWriting()} className="primary-action shrink-0 disabled:cursor-not-allowed disabled:opacity-40">
                      {writeLoading ? <LoaderCircle className="size-4 animate-spin" /> : <PenLine className="size-4" />}
                      {writeLoading ? 'Writing…' : 'Write'}
                    </button>
                  </div>
                  {writeError && <p className="mt-3 text-xs text-rose-300">{writeError}</p>}
                  {writeDraft && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs leading-6 text-slate-300 whitespace-pre-wrap">{writeDraft}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={insertWriteDraft} className="primary-action px-3 py-1.5 text-xs">
                          <Plus className="size-3.5" />Insert into document
                        </button>
                        <button type="button" onClick={() => void generateWriting()} disabled={writeLoading} className="secondary-action px-3 py-1.5 text-xs disabled:cursor-wait disabled:opacity-60">
                          Regenerate
                        </button>
                        <button type="button" onClick={() => setWriteDraft('')} className="secondary-action px-3 py-1.5 text-xs">
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {suggestionsOpen && (
                <section className="glass mt-6 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="size-4 text-white/70" />AirGPT suggestions
                    </h3>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => void getSuggestions()} disabled={suggestionsLoading} className="secondary-action px-3 py-1.5 text-xs disabled:cursor-wait disabled:opacity-60">
                        {suggestionsLoading ? 'Thinking…' : 'Refresh'}
                      </button>
                      <button type="button" onClick={() => setSuggestionsOpen(false)} aria-label="Close suggestions" className="interactive-icon size-7">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {suggestionsLoading && suggestions.length === 0 ? (
                    <div className="mt-4 space-y-2">
                      {[0, 1, 2].map((key) => <div key={key} className="premium-skeleton h-14 rounded-xl" />)}
                    </div>
                  ) : suggestionsError ? (
                    <p className="mt-3 text-xs text-rose-300">{suggestionsError}</p>
                  ) : suggestions.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-500">No suggestions yet — write a bit more, then refresh.</p>
                  ) : (
                    <ul className="mt-4 space-y-2.5">
                      {suggestions.map((item) => (
                        <li key={item.id} className="glass-subtle rounded-xl px-4 py-3 text-sm">
                          <div className="flex items-start gap-3">
                            <span className={cn('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', categoryStyles[item.category])}>
                              {item.category}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white">{item.title}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                            </div>
                            <button type="button" aria-label="Dismiss suggestion" onClick={() => dismissSuggestion(item.id)} className="interactive-icon size-7 shrink-0">
                              <X className="size-3.5" />
                            </button>
                          </div>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => void applySuggestion(item)}
                              disabled={applyingSuggestionId !== null}
                              className="mt-2.5 ml-9 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-50"
                            >
                              {applyingSuggestionId === item.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                              {applyingSuggestionId === item.id ? 'Applying…' : 'Apply'}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <div className="mt-10 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">Checklist</h2>
                {checklist.length > 0 && (
                  <span className="text-xs text-slate-500">{checklist.filter((item) => item.done).length} / {checklist.length} done</span>
                )}
              </div>
              {checklist.length === 0 && <p className="mt-3 text-sm text-slate-500">Add action items for this document below.</p>}
              <ul className="mt-4 space-y-2.5">
                {checklist.map((item) => (
                  <li key={item.id} className="glass-subtle flex items-center gap-3 rounded-xl px-4 py-3 text-sm">
                    <button type="button" disabled={isReadOnly} aria-pressed={item.done} onClick={() => toggleChecklistItem(item.id)} className="flex flex-1 items-center gap-3 text-left disabled:cursor-default">
                      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md border', item.done ? 'border-transparent bg-white' : 'border-white/20')}>
                        {item.done && <Check className="size-3 text-black" />}
                      </span>
                      <span className={cn('break-words', item.done && 'text-muted-foreground line-through')}>{item.text}</span>
                    </button>
                    {!isReadOnly && (
                      <button type="button" aria-label={`Remove ${item.text}`} onClick={() => removeChecklistItem(item.id)} className="interactive-icon size-7 shrink-0">
                        <X className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!isReadOnly && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={newChecklistText}
                    onChange={(event) => setNewChecklistText(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addChecklistItem() } }}
                    placeholder="Add a checklist item"
                    aria-label="New checklist item"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-white/30 focus:ring-2 focus:ring-white/10"
                  />
                  <button type="button" onClick={addChecklistItem} disabled={!newChecklistText.trim()} className="secondary-action px-3 disabled:cursor-not-allowed disabled:opacity-40">
                    <Plus className="size-4" />Add
                  </button>
                </div>
              )}
              <div className="h-16" />
            </>
          )}
        </div>
      </div>

      <Modal open={shareOpen} title={`Share "${title}"`} description="Search for a person on AirNexus to give them access." onClose={() => setShareOpen(false)}>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Search className="size-4 text-slate-500" />
          <input
            value={shareQuery}
            onChange={(event) => setShareQuery(event.target.value)}
            placeholder="Search by name"
            aria-label="Search people to share with"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <select value={shareRole} onChange={(event) => setShareRole(event.target.value as 'editor' | 'viewer')} className="rounded-lg bg-white/10 px-2 py-1 text-xs">
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
        </div>
        {shareSearching && <p className="mt-2 text-xs text-slate-500">Searching…</p>}
        {shareResults.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10">
            {shareResults.map((result) => (
              <button key={result.userId} type="button" onClick={() => void addCollaborator(result)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-white/8">
                {result.displayName}
                <Plus className="size-4 text-slate-500" />
              </button>
            ))}
          </div>
        )}
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">People with access</p>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
            <span className="flex items-center gap-2"><Crown className="size-3.5 text-zinc-300" />You</span>
            <span className="text-xs text-slate-500">Owner</span>
          </div>
          {collaborators.map((collaborator) => (
            <div key={collaborator.userId} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
              <span>{collaborator.displayName}</span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {roleLabel[collaborator.role]}
                <button type="button" aria-label={`Remove ${collaborator.displayName}`} onClick={() => void removeCollaborator(collaborator.userId)} className="interactive-icon size-6">
                  <X className="size-3" />
                </button>
              </span>
            </div>
          ))}
          {collaborators.length === 0 && <p className="text-xs text-slate-600">Not shared with anyone yet.</p>}
        </div>
      </Modal>
    </div>
  )
}

function EditorToolbar({
  linkOpen,
  linkUrl,
  onSetLinkUrl,
  onToggleLink,
  onApplyLink,
  onFormat,
  onAskAi,
}: {
  linkOpen: boolean
  linkUrl: string
  onSetLinkUrl: (url: string) => void
  onToggleLink: () => void
  onApplyLink: () => void
  onFormat: (command: string, value?: string) => void
  onAskAi: () => void
}) {
  const preventSelectionLoss = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault()

  return (
    <div className="relative mt-5 inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-white/20 bg-white/10 p-2 shadow-lg shadow-black/20">
      <ToolbarButton label="Heading style" icon={Type} onMouseDown={preventSelectionLoss} onClick={() => onFormat('formatBlock', 'h3')} />
      <ToolbarButton label="Bold" icon={Bold} onMouseDown={preventSelectionLoss} onClick={() => onFormat('bold')} />
      <ToolbarButton label="Italic" icon={Italic} onMouseDown={preventSelectionLoss} onClick={() => onFormat('italic')} />
      <ToolbarButton label="Add link" icon={Link2} onMouseDown={preventSelectionLoss} onClick={onToggleLink} active={linkOpen} />
      <ToolbarButton label="Code block" icon={Code2} onMouseDown={preventSelectionLoss} onClick={() => onFormat('formatBlock', 'pre')} />
      <span className="mx-1 h-6 w-px bg-white/10" />
      <button type="button" onClick={onAskAi} className="flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/30">
        <Sparkles className="size-4" />
        Ask AI
      </button>
      {linkOpen && (
        <div className="menu-popover left-28 top-12 flex w-72 gap-2 p-2">
          <input
            autoFocus
            value={linkUrl}
            onChange={(event) => onSetLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onApplyLink()
            }}
            aria-label="Link URL"
            className="min-w-0 flex-1 rounded-lg bg-white/8 px-2 text-xs outline-none"
          />
          <button type="button" onClick={onApplyLink} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  onMouseDown,
  active = false,
}: {
  label: string
  icon: typeof Type
  onClick: () => void
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={cn('interactive-icon size-9', active && 'bg-white/25 text-white')}
    >
      <Icon className="size-4" />
    </button>
  )
}

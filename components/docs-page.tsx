'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  Bold,
  Check,
  ChevronLeft,
  Code2,
  Crown,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Italic,
  Link2,
  Menu,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Plus,
  Printer,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Type,
  Users,
  X,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import type { NoticeTone } from '@/components/airnexus-app'
import { cn } from '@/lib/utils'

type DocRole = 'owner' | 'editor' | 'viewer'
type ChecklistItem = { id: string; text: string; done: boolean }
type DocSummary = { id: string; title: string; role: DocRole; updatedAt: string; createdAt: string }
type Collaborator = { userId: string; displayName: string; role: 'editor' | 'viewer'; addedAt: string }
type DocDetail = DocSummary & { body: string; ownerId: string; checklist: ChecklistItem[]; collaborators: Collaborator[] }
type SearchResult = { userId: string; displayName: string }

const MAX_CHECKLIST_ITEMS = 50
const DEFAULT_BODY = 'Start typing here, or ask AirGPT to draft this document for you.'

type DocsPageProps = {
  activeDocId: string | null
  onOpenDoc: (id: string | null) => void
  onOpenSidebar: () => void
  onOpenContext: () => void
  notify: (message: string, tone?: NoticeTone) => void
}

function slugify(value: string) {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'document'
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

function formatUpdated(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Today, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const roleLabel: Record<DocRole, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' }

export function DocsPage({ activeDocId, onOpenDoc, onOpenSidebar, onOpenContext, notify }: DocsPageProps) {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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

  const editorRef = useRef<HTMLDivElement>(null)
  const suppressPollRef = useRef(false)
  const lastUpdatedAtRef = useRef<string | null>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const savedSelectionRef = useRef<Range | null>(null)

  const isReadOnly = doc?.role === 'viewer'
  const canShare = doc?.role === 'owner'

  // Library list — only needed while no document is open.
  useEffect(() => {
    if (activeDocId) return
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setDocsLoading(true)
      void (async () => {
        const response = await fetch('/api/docs', { credentials: 'include', cache: 'no-store' })
        if (cancelled) return
        if (response.ok) setDocs(((await response.json()) as { docs: DocSummary[] }).docs)
        setDocsLoading(false)
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [activeDocId])

  // Load the open document whenever the selection changes.
  useEffect(() => {
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setMoreOpen(false)
      setShareOpen(false)
      if (!activeDocId) {
        setDoc(null)
        return
      }
      setDocLoading(true)
      void (async () => {
        const response = await fetch(`/api/docs/${activeDocId}`, { credentials: 'include', cache: 'no-store' })
        if (cancelled) return
        if (!response.ok) {
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
    void fetch(`/api/docs/${activeDocId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string }
        notify(data.error ?? 'Could not save changes.', 'warning')
        return
      }
      const updated = (await response.json()) as DocSummary
      lastUpdatedAtRef.current = updated.updatedAt
    }).catch(() => notify('Could not reach the server to save.', 'warning'))
  }, [activeDocId, isReadOnly, notify])

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

  const createDoc = async () => {
    if (creating) return
    setCreating(true)
    try {
      const response = await fetch('/api/docs', { method: 'POST', credentials: 'include' })
      const data = await response.json().catch(() => ({})) as DocSummary & { error?: string }
      if (!response.ok || !('id' in data)) {
        notify((data as { error?: string }).error ?? 'Could not create document.', 'warning')
        return
      }
      onOpenDoc(data.id)
    } catch {
      notify('Could not reach the server.', 'warning')
    } finally {
      setCreating(false)
    }
  }

  const deleteDoc = async (id: string) => {
    const response = await fetch(`/api/docs/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string }
      notify(data.error ?? 'Could not delete document.', 'warning')
      return
    }
    setDocs((current) => current.filter((item) => item.id !== id))
    setConfirmDeleteId(null)
    notify('Document deleted', 'success')
  }

  const exportDoc = () => {
    const body = editorRef.current?.innerText ?? ''
    downloadText(`airgpt-${slugify(title)}.md`, '# ' + title + '\n\n' + body)
    notify('Document exported', 'success')
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

  // --- Library view ---------------------------------------------------

  if (!activeDocId) {
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass-subtle relative z-20 flex shrink-0 items-center justify-between gap-3 border-x-0 border-t-0 px-3 py-3 sm:px-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={onOpenSidebar} aria-label="Open navigation" className="interactive-icon lg:hidden">
              <Menu className="size-5" />
            </button>
            <span className="hidden size-9 items-center justify-center rounded-xl bg-white/10 sm:flex"><FileText className="size-4 text-zinc-200" /></span>
            <p className="text-sm font-semibold sm:text-[15px]">My Documents</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button type="button" disabled={creating} onClick={() => void createDoc()} className="primary-action px-3 sm:px-5 disabled:cursor-wait disabled:opacity-60">
              <FilePlus2 className="size-4" />
              <span className="hidden sm:inline">New document</span>
            </button>
            <button type="button" onClick={onOpenContext} aria-label="Open context panel" className="interactive-icon xl:hidden">
              <PanelRightOpen className="size-5" />
            </button>
          </div>
        </header>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            {docsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((key) => <div key={key} className="premium-skeleton h-32 rounded-2xl" />)}
              </div>
            ) : docs.length === 0 ? (
              <div className="glass rounded-3xl p-10 text-center">
                <FileText className="mx-auto size-8 text-slate-600" />
                <p className="mt-3 text-sm font-semibold text-white">No documents yet</p>
                <p className="mt-1 text-xs text-slate-500">Create your first document, or ask AirGPT to draft one for you.</p>
                <button type="button" disabled={creating} onClick={() => void createDoc()} className="primary-action mx-auto mt-5 disabled:cursor-wait disabled:opacity-60">
                  <FilePlus2 className="size-4" />New document
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {docs.map((item) => (
                  <article key={item.id} className="glass group relative flex flex-col rounded-2xl p-4">
                    <button type="button" onClick={() => onOpenDoc(item.id)} className="flex flex-1 flex-col items-start text-left">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"><FileText className="size-4" /></span>
                      <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">Updated {formatUpdated(item.updatedAt)}</p>
                      {item.role !== 'owner' && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                          <Users className="size-3" />Shared · {roleLabel[item.role]}
                        </span>
                      )}
                    </button>
                    {item.role === 'owner' && (
                      confirmDeleteId === item.id ? (
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => void deleteDoc(item.id)} className="flex-1 rounded-lg bg-rose-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-600">Confirm delete</button>
                          <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg px-2 py-1.5 text-[11px] text-slate-400 hover:bg-white/8">Cancel</button>
                        </div>
                      ) : (
                        <button type="button" aria-label={`Delete ${item.title}`} onClick={() => setConfirmDeleteId(item.id)} className="interactive-icon absolute right-3 top-3 size-7 opacity-0 transition group-hover:opacity-100">
                          <Trash2 className="size-3.5" />
                        </button>
                      )
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- Editor view ------------------------------------------------------

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="glass-subtle relative z-20 flex shrink-0 items-center justify-between gap-3 border-x-0 border-t-0 px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button type="button" onClick={() => onOpenDoc(null)} aria-label="Back to documents" className="interactive-icon">
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold sm:text-[15px]">{title}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {doc?.role === 'viewer' ? 'View only' : 'Saved automatically'}
              <span className="ml-1 inline-block size-1.5 rounded-full bg-emerald-400" />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={exportDoc} aria-label="Download document" className="interactive-icon hidden sm:flex">
            <Download className="size-[18px]" />
          </button>
          {canShare && (
            <button type="button" onClick={() => setShareOpen(true)} className="primary-action px-3 sm:px-5">
              <Share2 className="size-4" />
              <span className="hidden sm:inline">Share</span>
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
                {doc?.role === 'owner' && (
                  confirmDeleteId === activeDocId ? (
                    <button type="button" onClick={() => void deleteDoc(activeDocId)} className="flex w-full items-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2.5 text-left text-sm text-rose-300 hover:bg-rose-500/25">
                      <Trash2 className="size-4" />Confirm delete
                    </button>
                  ) : (
                    <button type="button" onClick={() => setConfirmDeleteId(activeDocId)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-rose-300 hover:bg-white/8">
                      <Trash2 className="size-4" />Delete document
                    </button>
                  )
                )}
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

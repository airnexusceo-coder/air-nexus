'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Brain, LoaderCircle, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { apiUrl, fetchWithRetry } from '@/lib/api-client'

type NoticeTone = 'success' | 'info' | 'warning'

type Memory = {
  id: string
  type: string
  title: string
  content: string
  tags: string[]
  source: string
  updated_at: string
}

type MemorySettings = {
  memory_enabled: boolean
  personalize_responses: boolean
  auto_summary_enabled: boolean
}

type MemoryResponse = {
  memories?: Memory[]
  settings?: MemorySettings | null
}

const memoryTypes = [
  ['subject', 'Subject'],
  ['learning_style', 'Learning style'],
  ['assignment', 'Assignment'],
  ['weak_topic', 'Weak topic'],
  ['exam_date', 'Exam date'],
  ['goal', 'Goal'],
  ['preference', 'Preference'],
  ['custom', 'Custom'],
]

export function MemoryPage({ notify }: { notify: (message: string, tone?: NoticeTone) => void }) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [settings, setSettings] = useState<MemorySettings>({ memory_enabled: true, personalize_responses: true, auto_summary_enabled: true })
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState('custom')
  const [tags, setTags] = useState('')

  const visibleMemories = useMemo(() => memories, [memories])

  const loadMemories = async (search = query) => {
    setLoading(true)
    try {
      const response = await fetchWithRetry(apiUrl(`/api/memories?q=${encodeURIComponent(search)}`), { credentials: 'include' })
      const data = await response.json() as MemoryResponse & { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Memory could not be loaded.')
      setMemories(data.memories ?? [])
      if (data.settings) setSettings(data.settings)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Memory could not be loaded.', 'warning')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadMemories(''), 0)
    return () => window.clearTimeout(timeoutId)
    // Load once on entry; search is handled explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setContent('')
    setType('custom')
    setTags('')
  }

  const saveMemory = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        id: editingId ?? undefined,
        type,
        title,
        content,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      }
      const response = await fetchWithRetry(apiUrl('/api/memories'), {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await response.json() as { memory?: Memory; error?: string }
      if (!response.ok || !data.memory) throw new Error(data.error ?? 'Memory could not be saved.')
      setMemories((current) => editingId ? current.map((memory) => memory.id === data.memory?.id ? data.memory : memory) : [data.memory!, ...current])
      resetForm()
      notify(editingId ? 'Memory updated' : 'Memory saved', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Memory could not be saved.', 'warning')
    } finally {
      setSaving(false)
    }
  }

  const editMemory = (memory: Memory) => {
    setEditingId(memory.id)
    setTitle(memory.title)
    setContent(memory.content)
    setType(memory.type)
    setTags(memory.tags.join(', '))
  }

  const deleteMemory = async (memory: Memory) => {
    try {
      const response = await fetchWithRetry(apiUrl(`/api/memories?id=${encodeURIComponent(memory.id)}`), { method: 'DELETE', credentials: 'include' })
      if (!response.ok) throw new Error('Memory could not be deleted.')
      setMemories((current) => current.filter((item) => item.id !== memory.id))
      if (editingId === memory.id) resetForm()
      notify('Memory deleted', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Memory could not be deleted.', 'warning')
    }
  }

  const updateSettings = async (patch: Partial<MemorySettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    try {
      const response = await fetchWithRetry(apiUrl('/api/memories'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: 'settings', ...next }),
      })
      if (!response.ok) throw new Error('Memory settings could not be saved.')
      notify('Memory settings saved', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Memory settings could not be saved.', 'warning')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300/80">Student memory</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">AI Memory</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Manage what AirGPT remembers about your subjects, learning style, assignments, weak topics, exam dates, and goals.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200"><ShieldCheck className="size-3.5" />Supabase RLS protected</span>
      </div>

      <section className="glass grid gap-3 rounded-2xl p-4 md:grid-cols-3">
        <MemoryToggle label="Memory enabled" checked={settings.memory_enabled} onChange={(checked) => updateSettings({ memory_enabled: checked })} />
        <MemoryToggle label="Personalise replies" checked={settings.personalize_responses} onChange={(checked) => updateSettings({ personalize_responses: checked })} />
        <MemoryToggle label="Auto summaries" checked={settings.auto_summary_enabled} onChange={(checked) => updateSettings({ auto_summary_enabled: checked })} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={saveMemory} className="glass rounded-3xl p-5">
          <div className="flex items-center gap-3"><Brain className="size-5 text-orange-300" /><h3 className="font-semibold">{editingId ? 'Edit memory' : 'Add memory'}</h3></div>
          <label className="form-label mt-5">Type<select value={type} onChange={(event) => setType(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none">{memoryTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="form-label mt-4">Title<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} className="nexus-field mt-2" placeholder="e.g. Learns best with worked examples" /></label>
          <label className="form-label mt-4">Memory<textarea value={content} onChange={(event) => setContent(event.target.value)} required rows={5} className="nexus-field mt-2 resize-none" placeholder="What should AirGPT remember?" /></label>
          <label className="form-label mt-4">Tags<input value={tags} onChange={(event) => setTags(event.target.value)} className="nexus-field mt-2" placeholder="maths, exams, writing" /></label>
          <div className="mt-5 flex gap-3"><button type="submit" disabled={saving || !title.trim() || !content.trim()} className="primary-action">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}{editingId ? 'Save changes' : 'Save memory'}</button>{editingId && <button type="button" onClick={resetForm} className="secondary-action">Cancel</button>}</div>
        </form>

        <section className="glass rounded-3xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/8 bg-slate-950/20 px-3"><Search className="size-4 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void loadMemories(query) }} placeholder="Search memories" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" /></label>
            <button type="button" onClick={() => void loadMemories(query)} className="secondary-action">Search</button>
          </div>
          <div className="mt-5 space-y-3">
            {loading ? <div className="premium-skeleton h-28 rounded-2xl" /> : visibleMemories.length === 0 ? <p className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 text-sm text-slate-500">No memories found yet. Add one manually or keep chatting with auto summaries enabled.</p> : visibleMemories.map((memory) => (
              <article key={memory.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-orange-300">{memory.type.replace(/_/g, ' ')}</p><h4 className="mt-1 font-semibold text-white">{memory.title}</h4><p className="mt-2 text-sm leading-6 text-slate-400">{memory.content}</p>{memory.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{memory.tags.map((tag) => <span key={tag} className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-slate-400">{tag}</span>)}</div>}</div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => editMemory(memory)} className="interactive-icon text-xs">Edit</button><button type="button" onClick={() => void deleteMemory(memory)} aria-label={`Delete ${memory.title}`} className="interactive-icon text-rose-200"><Trash2 className="size-4" /></button></div></div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function MemoryToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-3 text-sm text-slate-200"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-orange-500" /></label>
}

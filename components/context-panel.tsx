'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import {
  AtSign,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FilePlus2,
  ListTodo,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  Search,
  Send,
  Smile,
  Sparkles,
  X,
} from 'lucide-react'
import { ThinkingLogo } from '@/components/thinking-logo'
import { AiMarkdown } from '@/components/ai-markdown'
import { SpeakButton } from '@/components/speak-button'
import { sanitizeResponse } from '@/lib/ai/sanitize-response'
import { apiUrl } from '@/lib/api-client'
import { isSpeechCancellation, speakWithOrpheus } from '@/lib/voice/orpheus'
import { useVoiceInput } from '@/lib/voice/use-voice-input'
import type { ChatMessage } from '@/lib/data'
import type { RoomDetail, RoomMessageDTO, RoomTaskDTO } from '@/lib/rooms/types'
import { colorForUser, initialsFor } from '@/lib/rooms/display'
import type { NoticeTone } from '@/components/airnexus-app'
import { cn } from '@/lib/utils'
import {
  DOCUMENT_ACCEPT,
  MAX_DOCUMENTS_PER_MESSAGE,
  pendingDocument,
  readDocument,
  type DocumentAttachment,
} from '@/lib/documents/client'

type PanelTab = 'ai' | 'chat' | 'comments' | 'tasks'

type ContextPanelProps = {
  roomId: string | null
  docId: string | null
  mobileOpen: boolean
  desktopCollapsed: boolean
  onCloseMobile: () => void
  onToggleDesktopCollapse: () => void
  notify: (message: string, tone?: NoticeTone) => void
  isPlus: boolean
  autoSpeak: boolean
  onRequestUpgrade: (feature: string, requiredPlan: 'Plus' | 'Premium') => void
}

type DocContext = { title: string; body: string; role: 'owner' | 'editor' | 'viewer' }

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const tabs = [
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'comments', label: 'Comments', icon: MessageCircle },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
] as const

const colorMap: Record<string, string> = {
  'from-white to-zinc-200': 'bg-gradient-to-br from-white to-zinc-200',
  'from-white to-zinc-300': 'bg-gradient-to-br from-white to-zinc-300',
  'from-zinc-300 to-zinc-500': 'bg-gradient-to-br from-zinc-300 to-zinc-500',
  'from-zinc-400 to-zinc-600': 'bg-gradient-to-br from-zinc-400 to-zinc-600',
  'from-zinc-500 to-zinc-700': 'bg-gradient-to-br from-zinc-500 to-zinc-700',
  'from-zinc-600 to-zinc-800': 'bg-gradient-to-br from-zinc-600 to-zinc-800',
}

function messageId(prefix: string) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2)
}

function messageTime(iso?: string) {
  return new Date(iso ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function roomMessageToChatMessage(row: RoomMessageDTO): ChatMessage {
  return {
    id: row.id,
    author: row.self ? 'You' : row.senderName,
    initials: row.self ? 'Y' : initialsFor(row.senderName),
    color: row.self ? 'from-white to-zinc-200' : colorForUser(row.senderId),
    time: messageTime(row.createdAt),
    text: row.body,
    self: row.self,
  }
}

function Avatar({
  initials,
  color,
  className,
}: {
  initials: string
  color: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-slate-950/50', colorMap[color] ?? 'bg-slate-500', className)}>
      {initials}
    </span>
  )
}

export function ContextPanel({
  roomId,
  docId,
  mobileOpen,
  desktopCollapsed,
  onCloseMobile,
  onToggleDesktopCollapse,
  notify,
  isPlus,
  autoSpeak,
  onRequestUpgrade,
}: ContextPanelProps) {
  const [tab, setTab] = useState<PanelTab>('chat')
  const [roomDetail, setRoomDetail] = useState<RoomDetail | null>(null)
  const [docContext, setDocContext] = useState<DocContext | null>(null)
  const [collabMessages, setCollabMessages] = useState<RoomMessageDTO[]>([])
  const [roomTasks, setRoomTasks] = useState<RoomTaskDTO[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageTimeRef = useRef<string | null>(null)

  const { isListening, toggleListening } = useVoiceInput({
    onTranscript: (transcript) => {
      setDraft((current) => (current ? current + ' ' : '') + transcript)
    },
    onError: (message) => notify(message, 'warning'),
  })
  const chatMode = tab === 'ai' || tab === 'chat'
  const collabAsChatMessages = collabMessages.map(roomMessageToChatMessage)
  const activeMessages = tab === 'ai' ? aiMessages : collabAsChatMessages

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, loading])

  useEffect(() => {
    const closePopovers = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMentionOpen(false)
      setEmojiOpen(false)
    }

    document.addEventListener('keydown', closePopovers)
    return () => document.removeEventListener('keydown', closePopovers)
  }, [])

  // Room-switch: clear stale state and load the newly selected room. Deferred
  // via setTimeout(0) so state clearing/loading happens outside the effect body.
  useEffect(() => {
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setRoomDetail(null)
      setCollabMessages([])
      setRoomTasks([])
      lastMessageTimeRef.current = null
      if (!roomId) return

      void (async () => {
        const [detailResponse, messagesResponse, tasksResponse] = await Promise.all([
          fetch(`/api/rooms/${roomId}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/rooms/${roomId}/messages`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/rooms/${roomId}/tasks`, { credentials: 'include', cache: 'no-store' }),
        ])
        if (cancelled) return
        if (detailResponse.ok) setRoomDetail((await detailResponse.json()) as RoomDetail)
        if (messagesResponse.ok) {
          const data = (await messagesResponse.json()) as { messages: RoomMessageDTO[] }
          setCollabMessages(data.messages)
          lastMessageTimeRef.current = data.messages.at(-1)?.createdAt ?? null
        }
        if (tasksResponse.ok) setRoomTasks(((await tasksResponse.json()) as { tasks: RoomTaskDTO[] }).tasks)
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [roomId])

  // Read-only doc context for the AI tab — re-fetched whenever the open
  // document changes or the user switches back into the AI tab, so a
  // question always sees reasonably fresh content without polling.
  useEffect(() => {
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!docId || tab !== 'ai') {
        if (!docId) setDocContext(null)
        return
      }
      void (async () => {
        const response = await fetch(`/api/docs/${docId}`, { credentials: 'include', cache: 'no-store' })
        if (cancelled || !response.ok) return
        const data = (await response.json()) as { title: string; body: string; role: 'owner' | 'editor' | 'viewer' }
        setDocContext({ title: data.title, body: data.body, role: data.role })
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [docId, tab])

  // Poll for new room messages — no realtime layer in this app. Only while the
  // Chat tab is actually open and the page is visible.
  useEffect(() => {
    if (tab !== 'chat' || !roomId) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void (async () => {
        const since = lastMessageTimeRef.current ? `?since=${encodeURIComponent(lastMessageTimeRef.current)}` : ''
        const response = await fetch(`/api/rooms/${roomId}/messages${since}`, { credentials: 'include', cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as { messages: RoomMessageDTO[] }
        if (data.messages.length === 0) return
        lastMessageTimeRef.current = data.messages.at(-1)?.createdAt ?? lastMessageTimeRef.current
        setCollabMessages((current) => [...current, ...data.messages])
      })()
    }, 5000)
    return () => window.clearInterval(id)
  }, [tab, roomId])

  const filteredMessages = activeMessages.filter((message) =>
    (message.author + ' ' + message.text).toLowerCase().includes(query.toLowerCase()),
  )

  const sendMessage = async () => {
    if (!chatMode || loading) return
    if (tab === 'chat' && !roomId) return
    const text = draft.trim()
    if (!text && attachments.length === 0) return
    if (attachments.some((file) => file.status === 'processing')) {
      notify('Wait for AirGPT to finish reading the document.', 'info')
      return
    }
    const readableAttachments = attachments.filter((file) => file.status === 'ready')
    if (!text && readableAttachments.length === 0) {
      notify('Remove the unreadable attachment or choose another document.', 'warning')
      return
    }

    const mode = tab
    const content =
      (text || 'Please review the attached document.') +
      (readableAttachments.length ? '\nAttached: ' + readableAttachments.map((file) => file.name).join(', ') : '')

    setDraft('')
    setAttachments([])
    setLoading(true)

    try {
      if (mode === 'chat' && roomId) {
        const response = await fetch(`/api/rooms/${roomId}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: content }),
        })
        if (!response.ok) {
          const data = await response.json().catch(() => null) as { error?: string } | null
          notify(data?.error ?? 'Could not send message.', 'warning')
          return
        }
        const sent = (await response.json()) as RoomMessageDTO
        lastMessageTimeRef.current = sent.createdAt
        setCollabMessages((current) => [...current, sent])
        return
      }

      // AI tab — unchanged real /api/chat flow. The open document (if any)
      // rides along as an extra attachment, reusing the same documents[]
      // context mechanism as file uploads.
      setAiMessages((current) => [
        ...current,
        { id: messageId('context-user'), author: 'You', initials: 'Y', color: 'from-white to-zinc-200', time: messageTime(), text: content, self: true },
      ])
      const documents = [
        ...readableAttachments.map((file) => ({ name: file.name, text: file.text })),
        ...(docContext ? [{ name: docContext.title, text: stripHtml(docContext.body) }] : []),
      ]
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text || 'Please review and summarize the attached documents.',
          isPlus,
          documents,
        }),
      })
      const data = (await response.json()) as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'No response')
      const safeReply = sanitizeResponse(data.reply)
      setAiMessages((current) => [
        ...current,
        { id: messageId('context-reply'), author: 'AirGPT', initials: 'AI', color: 'from-white to-zinc-200', time: messageTime(), text: safeReply },
      ])
      if (autoSpeak && isPlus) {
        void speakWithOrpheus(safeReply).catch((error: unknown) => {
          if (!isSpeechCancellation(error)) notify(error instanceof Error ? error.message : 'Speech playback failed.', 'warning')
        })
      }
    } catch {
      if (mode === 'ai') {
        setAiMessages((current) => [
          ...current,
          {
            id: messageId('context-reply'),
            author: 'AirGPT',
            initials: 'AI',
            color: 'from-white to-zinc-200',
            time: messageTime(),
            text: 'I can help turn this brief into a clear next action. The onboarding owner is the highest-priority gap.',
          },
        ])
        notify('Using a local context-panel reply', 'warning')
      } else {
        notify('Network error. Please try again.', 'warning')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void sendMessage()
    }
  }

  const attachFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const remaining = Math.max(0, MAX_DOCUMENTS_PER_MESSAGE - attachments.length)
    const files = Array.from(event.target.files ?? []).slice(0, remaining)
    event.target.value = ''
    if (remaining === 0) {
      notify('Attach up to five documents per message.', 'warning')
      return
    }
    if (files.length === 0) return

    const pending = files.map((file) => ({ file, attachment: pendingDocument(file, messageId('context-file')) }))
    setAttachments((current) => [...current, ...pending.map(({ attachment }) => attachment)])
    notify('AirGPT is reading ' + files.length + ' document' + (files.length > 1 ? 's' : '') + '…', 'info')
    for (const { file, attachment } of pending) {
      void readDocument(file, attachment.id)
        .then((ready) => {
          setAttachments((current) => current.map((item) => item.id === ready.id ? ready : item))
          notify(file.name + ' is ready', 'success')
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'AirGPT could not read this document.'
          setAttachments((current) => current.map((item) => item.id === attachment.id ? { ...item, status: 'error', error: message } : item))
          notify(message, 'warning')
        })
    }
  }

  const insertIntoDocument = async (text: string) => {
    if (!docId) return
    const response = await fetch(`/api/docs/${docId}`, { credentials: 'include', cache: 'no-store' })
    if (!response.ok) {
      notify('Could not reach the document to insert into.', 'warning')
      return
    }
    const current = (await response.json()) as { body: string }
    const addition = '<br><br>' + sanitizeResponse(text).split('\n').map((line) => `<p>${line}</p>`).join('')
    const patchResponse = await fetch(`/api/docs/${docId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: (current.body || '') + addition }),
    })
    if (!patchResponse.ok) {
      const data = await patchResponse.json().catch(() => ({})) as { error?: string }
      notify(data.error ?? 'Could not insert into the document.', 'warning')
      return
    }
    notify('Added to your document', 'success')
  }

  const insertMention = (name: string) => {
    setDraft((current) => current + '@' + name + ' ')
    setMentionOpen(false)
    composerRef.current?.focus()
  }

  const insertEmoji = (emoji: string) => {
    setDraft((current) => current + emoji)
    setEmojiOpen(false)
    composerRef.current?.focus()
  }

  const toggleTask = useCallback(async (task: RoomTaskDTO) => {
    if (!roomId) return
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    setRoomTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item))
    const response = await fetch(`/api/rooms/${roomId}/tasks/${task.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (response.ok) {
      const updated = (await response.json()) as RoomTaskDTO
      setRoomTasks((current) => current.map((item) => item.id === updated.id ? updated : item))
    } else {
      setRoomTasks((current) => current.map((item) => item.id === task.id ? task : item))
      notify('Could not update task.', 'warning')
    }
  }, [roomId, notify])

  const addTask = useCallback(async () => {
    const title = newTaskTitle.trim()
    if (!title || !roomId) return
    setNewTaskTitle('')
    const response = await fetch(`/api/rooms/${roomId}/tasks`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (response.ok) {
      const task = (await response.json()) as RoomTaskDTO
      setRoomTasks((current) => [...current, task])
    } else {
      notify('Could not create task.', 'warning')
    }
  }, [newTaskTitle, roomId, notify])

  const memberNames = roomDetail?.members.map((member) => member.displayName) ?? []

  return (
    <>
      {desktopCollapsed && (
        <aside
          aria-label="Collapsed context panel"
          className="glass-strong hidden w-14 shrink-0 flex-col items-center gap-2 rounded-none border-y-0 border-r-0 px-2 py-4 xl:flex"
        >
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            aria-label="Expand context panel"
            title="Expand context panel"
            className="interactive-icon size-10"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="my-1 h-px w-8 bg-white/10" />
          {tabs.map((item) => {
            const Icon = item.icon
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id)
                  setMentionOpen(false)
                  setEmojiOpen(false)
                  onToggleDesktopCollapse()
                }}
                aria-label={'Open ' + item.label}
                aria-pressed={active}
                title={item.label}
                className={cn('interactive-icon size-10', active && 'bg-white/10 text-white')}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </aside>
      )}

      <aside
        aria-label="Context panel"
        className={cn(
          'glass-strong fixed inset-y-0 right-0 z-50 flex w-[340px] shrink-0 flex-col rounded-none border-y-0 border-r-0 transition-transform duration-300',
          desktopCollapsed ? 'xl:hidden' : 'xl:static xl:z-20 xl:translate-x-0',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
      <div className="flex items-center gap-2 px-5 py-4">
        {searchOpen ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search context"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
            />
          </div>
        ) : (
          <h2 className="flex-1 text-sm font-semibold">Context</h2>
        )}
        <button
          type="button"
          onClick={() => {
            setSearchOpen((open) => !open)
            if (searchOpen) setQuery('')
          }}
          aria-label={searchOpen ? 'Close context search' : 'Search context'}
          aria-pressed={searchOpen}
          className="interactive-icon"
        >
          {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onToggleDesktopCollapse}
          aria-label="Collapse context panel"
          title="Collapse context panel"
          className="interactive-icon hidden xl:flex"
        >
          <ChevronRight className="size-4" />
        </button>
        <button type="button" onClick={onCloseMobile} aria-label="Close context panel" className="interactive-icon xl:hidden">
          <X className="size-4" />
        </button>
      </div>

      <div role="tablist" aria-label="Context views" className="scrollbar-thin flex gap-1 overflow-x-auto px-3 pb-3">
        {tabs.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              aria-selected={active}
              role="tab"
              onClick={() => {
                setTab(item.id)
                setMentionOpen(false)
                setEmojiOpen(false)
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition',
                active ? 'bg-white/10 text-white shadow-inner' : 'text-muted-foreground hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'chat' && (
          roomId && roomDetail ? (
            <ChatView room={roomDetail} messages={filteredMessages} loading={loading} messagesEndRef={messagesEndRef} />
          ) : (
            <EmptyState label="You're not in any rooms yet. Create or open one from Collaboration Rooms." />
          )
        )}
        {tab === 'ai' && (
          <AiView
            messages={filteredMessages}
            loading={loading}
            messagesEndRef={messagesEndRef}
            onSpeechError={(message) => notify(message, 'warning')}
            canUseVoice={isPlus}
            onVoiceUpgrade={() => onRequestUpgrade('Text-to-Speech', 'Plus')}
            docContext={docContext}
            onInsertToDocument={docContext && docContext.role !== 'viewer' ? (text: string) => void insertIntoDocument(text) : undefined}
            onSuggestion={(prompt) => {
              setDraft(prompt)
              composerRef.current?.focus()
            }}
          />
        )}
        {tab === 'comments' && (
          <EmptyState label="Comments aren't available yet." />
        )}
        {tab === 'tasks' && (
          roomId ? (
            <TasksView tasks={roomTasks} newTaskTitle={newTaskTitle} onNewTaskTitleChange={setNewTaskTitle} onToggle={toggleTask} onAdd={addTask} />
          ) : (
            <EmptyState label="You're not in any rooms yet. Create or open one from Collaboration Rooms." />
          )
        )}
      </div>
      {chatMode && (tab === 'ai' || roomId) && (
        <div className="relative shrink-0 px-4 pb-4">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((file) => (
                <span key={file.id} className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]" title={file.error}>
                  {file.status === 'processing' ? <LoaderCircle className="size-3 animate-spin text-zinc-300" /> : file.status === 'error' ? <CircleAlert className="size-3 text-rose-300" /> : <CheckCircle2 className="size-3 text-emerald-300" />}
                  <span className="max-w-32 truncate">{file.name}</span>
                  <span className={file.status === 'error' ? 'text-rose-300' : file.status === 'ready' ? 'text-emerald-300' : 'text-zinc-300'}>
                    {file.status === 'processing' ? 'Reading…' : file.status === 'error' ? 'Unreadable' : 'Ready'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))}
                    aria-label={'Remove ' + file.name}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {mentionOpen && (
            <div className="menu-popover bottom-16 left-4 w-48">
              {memberNames.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No other room members yet.</p>
              ) : (
                memberNames.map((name) => (
                  <button key={name} type="button" onClick={() => insertMention(name)} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/8">
                    @{name}
                  </button>
                ))
              )}
            </div>
          )}

          {emojiOpen && (
            <div className="menu-popover bottom-16 right-12 flex w-44 flex-wrap gap-1 p-2">
              {['👍', '✨', '🚀', '✅', '💡', '🎯', '👏', '🔥'].map((emoji) => (
                <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} aria-label={'Insert ' + emoji} className="rounded-lg p-2 text-lg hover:bg-white/8">
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="glass-input flex items-center gap-2 rounded-2xl px-3 py-3">
            <button
              type="button"
              onClick={() => {
                setMentionOpen((open) => !open)
                setEmojiOpen(false)
              }}
              aria-label="Mention collaborator"
              aria-expanded={mentionOpen}
              className="interactive-icon size-8"
            >
              <AtSign className="size-4" />
            </button>
            <input ref={fileInputRef} type="file" accept={DOCUMENT_ACCEPT} multiple onChange={attachFiles} className="sr-only" tabIndex={-1} />
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach files" className="interactive-icon size-8">
              <Paperclip className="size-4" />
            </button>
            <input
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={loading}
              placeholder={tab === 'ai' ? 'Ask AirGPT' : 'Message #' + (roomDetail?.name.toLowerCase().replaceAll(' ', '-') ?? 'room')}
              aria-label={tab === 'ai' ? 'AI message' : 'Room message'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => isPlus ? toggleListening() : onRequestUpgrade('Voice Chat', 'Plus')}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={isListening}
              className={cn('interactive-icon size-8', isListening && 'w-auto gap-1.5 bg-rose-500/20 px-2 text-rose-200')}
            >
              <Mic className="size-4" />
              {isListening && <span className="text-[10px] font-medium">Listening...</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                setEmojiOpen((open) => !open)
                setMentionOpen(false)
              }}
              aria-label="Choose emoji"
              aria-expanded={emojiOpen}
              className="interactive-icon size-8"
            >
              <Smile className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={loading || attachments.some((file) => file.status === 'processing') || (!draft.trim() && !attachments.some((file) => file.status === 'ready'))}
              aria-label="Send context message"
              className="send-button size-9"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}
      </aside>
    </>
  )
}

function ChatView({
  room,
  messages,
  loading,
  messagesEndRef,
}: {
  room: RoomDetail
  messages: ChatMessage[]
  loading: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="space-y-4">
      <div className="glass-subtle flex items-center gap-3 rounded-2xl p-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 font-semibold">#</span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{room.name}</p>
          <p className="text-xs text-muted-foreground">{room.members.length} member{room.members.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      {messages.length === 0 ? (
        <EmptyState label="No messages yet. Say hello." />
      ) : (
        messages.map((message, index) => (
          <MessageBubble key={message.id ?? message.author + '-' + index} message={message} />
        ))
      )}
      {loading && <LoadingBubble author="Sending" initials="…" />}
      <div ref={messagesEndRef} />
    </div>
  )
}

function AiView({
  messages,
  loading,
  messagesEndRef,
  onSpeechError,
  canUseVoice,
  onVoiceUpgrade,
  docContext,
  onInsertToDocument,
  onSuggestion,
}: {
  messages: ChatMessage[]
  loading: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onSpeechError: (message: string) => void
  canUseVoice: boolean
  onVoiceUpgrade: () => void
  docContext: DocContext | null
  onInsertToDocument?: (text: string) => void
  onSuggestion: (prompt: string) => void
}) {
  const suggestions = docContext
    ? [
      `Summarize "${docContext.title}" into key points`,
      'Suggest what to write next in this document',
      'Give feedback on what I have so far',
      'Fix grammar and tighten the wording',
    ]
    : [
      'Help me plan a study session',
      'Explain a topic I am stuck on',
      'Quiz me on my current subject',
      'Draft a study plan for this week',
    ]
  return (
    <div className="space-y-4">
      {docContext ? (
        <div className="glass flex gap-3 rounded-2xl p-4">
          <ThinkingLogo isThinking={false} className="size-8" />
          <p className="text-sm leading-relaxed text-slate-200">
            AirGPT can see <span className="font-semibold text-white">&quot;{docContext.title}&quot;</span>. Ask a question about it, or ask AirGPT to write or improve part of it.
          </p>
        </div>
      ) : (
        <div className="glass flex gap-3 rounded-2xl p-4">
          <ThinkingLogo isThinking={false} className="size-8" />
          <p className="text-sm leading-relaxed text-slate-200">
            Ask AirGPT anything. Open a document from the Documents tab to let AirGPT read it and help you write.
          </p>
        </div>
      )}
      <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Suggested next steps</p>
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)} className="glass-subtle flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/6">
            <Sparkles className="size-3.5 shrink-0 text-zinc-300" />
            {suggestion}
          </button>
        ))}
      </div>
      {messages.length > 0 && (
        <div className="space-y-3 border-t border-white/8 pt-4">
          {messages.map((message, index) => (
            <MessageBubble key={message.id ?? message.author + '-' + index} message={message} onSpeechError={onSpeechError} canUseVoice={canUseVoice} onVoiceUpgrade={onVoiceUpgrade} onInsertToDocument={onInsertToDocument} />
          ))}
        </div>
      )}
      {loading && <LoadingBubble author="AirGPT" initials="AI" isAi />}
      <div ref={messagesEndRef} />
    </div>
  )
}

function TasksView({
  tasks,
  newTaskTitle,
  onNewTaskTitleChange,
  onToggle,
  onAdd,
}: {
  tasks: RoomTaskDTO[]
  newTaskTitle: string
  onNewTaskTitleChange: (value: string) => void
  onToggle: (task: RoomTaskDTO) => void
  onAdd: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={newTaskTitle}
          onChange={(event) => onNewTaskTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onAdd()
          }}
          placeholder="Add a task"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/40"
        />
        <button type="button" disabled={!newTaskTitle.trim()} onClick={onAdd} aria-label="Add task" className="interactive-icon size-9 disabled:opacity-40">
          <Plus className="size-4" />
        </button>
      </div>
      {tasks.length === 0 ? (
        <EmptyState label="No tasks yet." />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                aria-pressed={task.status === 'done'}
                onClick={() => onToggle(task)}
                className="glass-subtle flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/6"
              >
                <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border', task.status === 'done' ? 'border-transparent bg-white text-black' : 'border-white/20')}>
                  {task.status === 'done' && <Check className="size-3" />}
                </span>
                <span className={cn('flex-1 text-sm', task.status === 'done' && 'text-muted-foreground line-through')}>{task.title}</span>
                {task.assigneeName && <Avatar initials={initialsFor(task.assigneeName)} color="from-zinc-500 to-zinc-700" className="size-6" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MessageBubble({ message, onSpeechError, canUseVoice = false, onVoiceUpgrade, onInsertToDocument }: { message: ChatMessage; onSpeechError?: (message: string) => void; canUseVoice?: boolean; onVoiceUpgrade?: () => void; onInsertToDocument?: (text: string) => void }) {
  return (
    <article className={cn('flex gap-2.5', message.self && 'flex-row-reverse')}>
      <Avatar initials={message.initials} color={message.color} className="size-7" />
      <div className={cn('max-w-[82%]', message.self && 'text-right')}>
        <div className={cn('flex items-center gap-2', message.self && 'flex-row-reverse')}>
          <span className="text-xs font-medium">{message.author}</span>
          <span className="text-[10px] text-muted-foreground">{message.time}</span>
        </div>
        <div className={cn('mt-1 whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed', message.self ? 'message-self rounded-tr-md text-black' : 'message-highlight rounded-tl-md')}>
          {message.self ? message.text : <AiMarkdown>{message.text}</AiMarkdown>}
          {message.author === 'AirGPT' && (onSpeechError || onInsertToDocument) && (
            <div className="mt-2 flex items-center justify-end gap-1.5">
              {onInsertToDocument && (
                <button type="button" onClick={() => onInsertToDocument(message.text)} aria-label="Add to document" title="Add to document" className="interactive-icon size-8">
                  <FilePlus2 className="size-3.5" />
                </button>
              )}
              {onSpeechError && (canUseVoice ? <SpeakButton text={sanitizeResponse(message.text)} onError={onSpeechError} /> : <button type="button" onClick={onVoiceUpgrade} aria-label="Upgrade to use text-to-speech" className="interactive-icon size-8"><LockKeyhole className="size-3.5" /></button>)}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function LoadingBubble({
  author,
  initials,
  isAi = false,
}: {
  author: string
  initials: string
  isAi?: boolean
}) {
  return (
    <div className="flex gap-2.5">
      {isAi ? (
        <ThinkingLogo isThinking className="size-7" />
      ) : (
        <Avatar initials={initials} color="from-white to-zinc-200" className="size-7" />
      )}
      <div>
        <span className="text-xs font-medium">{author}</span>
        <div className="message-highlight mt-1 rounded-2xl rounded-tl-md px-4 py-2.5 text-sm text-muted-foreground">
          {isAi ? 'Thinking…' : 'typing…'}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

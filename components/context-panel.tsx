'use client'

import {
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
  Download,
  FileText,
  ListTodo,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  MessageSquare,
  Mic,
  Paperclip,
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
import { chatMessages, type ChatMessage } from '@/lib/data'
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
  activeRoom: string
  mobileOpen: boolean
  desktopCollapsed: boolean
  onCloseMobile: () => void
  onToggleDesktopCollapse: () => void
  notify: (message: string, tone?: NoticeTone) => void
  isPlus: boolean
  autoSpeak: boolean
  onRequestUpgrade: (feature: string, requiredPlan: 'Plus' | 'Premium') => void
}

const tabs = [
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'comments', label: 'Comments', icon: MessageCircle },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
] as const

const colorMap: Record<string, string> = {
  'from-emerald-400 to-green-500': 'bg-gradient-to-br from-emerald-400 to-green-500',
  'from-orange-500 to-amber-500': 'bg-gradient-to-br from-orange-500 to-amber-500',
  'from-red-500 to-orange-500': 'bg-gradient-to-br from-red-500 to-orange-500',
  'from-orange-400 to-orange-500': 'bg-gradient-to-br from-orange-400 to-orange-500',
  'from-orange-400 to-amber-500': 'bg-gradient-to-br from-orange-400 to-amber-500',
  'from-amber-400 to-orange-500': 'bg-gradient-to-br from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500': 'bg-gradient-to-br from-emerald-400 to-teal-500',
}

const comments = [
  {
    id: 1,
    author: 'Julian K.',
    initials: 'JK',
    color: 'from-orange-400 to-amber-500',
    text: 'Should the $42M figure be net or gross ARR? Worth a footnote.',
    anchor: 'AI Summary',
  },
  {
    id: 2,
    author: 'Maya N.',
    initials: 'MN',
    color: 'from-amber-400 to-orange-500',
    text: 'Love the three-motion framing. Can we add a slide reference?',
    anchor: 'Launch milestones',
  },
]

function messageId(prefix: string) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2)
}

function messageTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
  activeRoom,
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
  const [collabMessages, setCollabMessages] = useState<ChatMessage[]>(chatMessages)
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([])
  const [taskItems, setTaskItems] = useState([
    { id: 1, text: 'Confirm 5 enterprise LOIs', owner: 'EM', done: false },
    { id: 2, text: 'Publish migration guide', owner: 'JK', done: false },
    { id: 3, text: 'Keynote storyboard frame', owner: 'AT', done: true },
  ])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { isListening, toggleListening } = useVoiceInput({
    onTranscript: (transcript) => {
      setDraft((current) => (current ? current + ' ' : '') + transcript)
    },
    onError: (message) => notify(message, 'warning'),
  })
  const chatMode = tab === 'ai' || tab === 'chat'
  const activeMessages = tab === 'ai' ? aiMessages : collabMessages

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages, loading])

  useEffect(() => {
    const closePopovers = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMentionOpen(false)
      setEmojiOpen(false)
    }

    document.addEventListener('keydown', closePopovers)
    return () => document.removeEventListener('keydown', closePopovers)
  }, [])

  const filteredMessages = activeMessages.filter((message) =>
    (message.author + ' ' + message.text).toLowerCase().includes(query.toLowerCase()),
  )

  const appendMessage = (mode: 'ai' | 'chat', message: ChatMessage) => {
    if (mode === 'ai') setAiMessages((current) => [...current, message])
    else setCollabMessages((current) => [...current, message])
  }

  const sendMessage = async () => {
    if (!chatMode || loading) return
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

    appendMessage(mode, {
      id: messageId('context-user'),
      author: 'You',
      initials: 'Y',
      color: 'from-emerald-400 to-green-500',
      time: messageTime(),
      text: content,
      self: true,
    })
    setDraft('')
    setAttachments([])
    setLoading(true)

    try {
      const response = await fetch(apiUrl(mode === 'ai' ? '/api/chat' : '/api/collab'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text || 'Please review and summarize the attached documents.',
          isPlus,
          documents: readableAttachments.map((file) => ({ name: file.name, text: file.text })),
        }),
      })
      const data = (await response.json()) as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'No response')
      const safeReply = sanitizeResponse(data.reply)
      appendMessage(mode, {
        id: messageId('context-reply'),
        author: mode === 'ai' ? 'AirGPT' : 'Collaborator',
        initials: mode === 'ai' ? 'AI' : 'CO',
        color: mode === 'ai' ? 'from-orange-500 to-amber-500' : 'from-orange-400 to-amber-500',
        time: messageTime(),
        text: safeReply,
      })
      if (mode === 'ai' && autoSpeak && isPlus) {
        void speakWithOrpheus(safeReply).catch((error: unknown) => {
          if (!isSpeechCancellation(error)) notify(error instanceof Error ? error.message : 'Speech playback failed.', 'warning')
        })
      }
    } catch {
      appendMessage(mode, {
        id: messageId('context-reply'),
        author: mode === 'ai' ? 'AirGPT' : 'Collaborator',
        initials: mode === 'ai' ? 'AI' : 'CO',
        color: mode === 'ai' ? 'from-orange-500 to-amber-500' : 'from-orange-400 to-amber-500',
        time: messageTime(),
        text:
          mode === 'ai'
            ? 'I can help turn this brief into a clear next action. The onboarding owner is the highest-priority gap.'
            : 'Got it — I’ve added that to the launch room context.',
      })
      notify('Using a local context-panel reply', 'warning')
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
          <ChatView
            room={activeRoom}
            messages={filteredMessages}
            loading={loading}
            messagesEndRef={messagesEndRef}
            onDownload={() => {
              downloadPanelFile()
              notify('narrative-v3.pdf downloaded', 'success')
            }}
          />
        )}
        {tab === 'ai' && (
          <AiView
            messages={filteredMessages}
            loading={loading}
            messagesEndRef={messagesEndRef}
            onSpeechError={(message) => notify(message, 'warning')}
            canUseVoice={isPlus}
            onVoiceUpgrade={() => onRequestUpgrade('Text-to-Speech', 'Plus')}
            onSuggestion={(prompt) => {
              setDraft(prompt)
              composerRef.current?.focus()
            }}
          />
        )}
        {tab === 'comments' && (
          <CommentsView
            query={query}
            onReply={(author) => {
              setTab('chat')
              setDraft('@' + author.split(' ')[0] + ' ')
              window.setTimeout(() => composerRef.current?.focus(), 0)
            }}
            onResolve={(id) => notify('Comment ' + id + ' resolved', 'success')}
          />
        )}
        {tab === 'tasks' && (
          <TasksView
            tasks={taskItems}
            onToggle={(id) =>
              setTaskItems((current) =>
                current.map((task) => task.id === id ? { ...task, done: !task.done } : task),
              )
            }
          />
        )}
      </div>
      {chatMode && (
        <div className="relative shrink-0 px-4 pb-4">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((file) => (
                <span key={file.id} className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]" title={file.error}>
                  {file.status === 'processing' ? <LoaderCircle className="size-3 animate-spin text-orange-300" /> : file.status === 'error' ? <CircleAlert className="size-3 text-rose-300" /> : <CheckCircle2 className="size-3 text-emerald-300" />}
                  <span className="max-w-32 truncate">{file.name}</span>
                  <span className={file.status === 'error' ? 'text-rose-300' : file.status === 'ready' ? 'text-emerald-300' : 'text-orange-200'}>
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
              {['Elena', 'Julian', 'Aarav', 'Maya'].map((name) => (
                <button key={name} type="button" onClick={() => insertMention(name)} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/8">
                  @{name}
                </button>
              ))}
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
              placeholder={tab === 'ai' ? 'Ask AirGPT' : 'Message #' + activeRoom.toLowerCase().replaceAll(' ', '-')}
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
  onDownload,
}: {
  room: string
  messages: ChatMessage[]
  loading: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onDownload: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="glass-subtle flex items-center gap-3 rounded-2xl p-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20 font-semibold">#</span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{room}</p>
          <p className="text-xs text-emerald-400">4 online · 12 members</p>
        </div>
      </div>
      <p className="text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Today</p>
      {messages.map((message, index) => (
        <MessageBubble key={message.id ?? message.author + '-' + index} message={message} />
      ))}
      {loading && <LoadingBubble author="Collaborator" initials="CO" />}
      <div className="glass-subtle flex items-center gap-3 rounded-2xl p-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-orange-500/15">
          <FileText className="size-4 text-orange-300" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">narrative-v3.pdf</p>
          <p className="text-xs text-muted-foreground">Shared by Elena · 2.4 MB</p>
        </div>
        <button type="button" onClick={onDownload} aria-label="Download narrative-v3.pdf" className="interactive-icon size-8">
          <Download className="size-4" />
        </button>
      </div>
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
  onSuggestion,
}: {
  messages: ChatMessage[]
  loading: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onSpeechError: (message: string) => void
  canUseVoice: boolean
  onVoiceUpgrade: () => void
  onSuggestion: (prompt: string) => void
}) {
  const suggestions = [
    'Summarize this document into 5 key points',
    'Extract action items and assign owners',
    'Draft a launch announcement',
    'Identify risks in developer activation',
  ]
  return (
    <div className="space-y-4">
      <div className="glass flex gap-3 rounded-2xl p-4">
        <ThinkingLogo isThinking={false} className="size-8" />
        <p className="text-sm leading-relaxed text-slate-200">
          I’ve analyzed the brief. Developer activation is at risk because the onboarding milestone has no confirmed owner.
        </p>
      </div>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Suggested next steps</p>
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)} className="glass-subtle flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/6">
            <Sparkles className="size-3.5 shrink-0 text-orange-300" />
            {suggestion}
          </button>
        ))}
      </div>
      {messages.length > 0 && (
        <div className="space-y-3 border-t border-white/8 pt-4">
          {messages.map((message, index) => (
            <MessageBubble key={message.id ?? message.author + '-' + index} message={message} onSpeechError={onSpeechError} canUseVoice={canUseVoice} onVoiceUpgrade={onVoiceUpgrade} />
          ))}
        </div>
      )}
      {loading && <LoadingBubble author="AirGPT" initials="AI" isAi />}
      <div ref={messagesEndRef} />
    </div>
  )
}
function CommentsView({
  query,
  onReply,
  onResolve,
}: {
  query: string
  onReply: (author: string) => void
  onResolve: (id: number) => void
}) {
  const filtered = comments.filter((comment) =>
    (comment.author + ' ' + comment.text).toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <div className="space-y-3">
      {filtered.map((comment) => (
        <article key={comment.id} className="glass-subtle rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <Avatar initials={comment.initials} color={comment.color} className="size-6" />
            <span className="text-sm font-medium">{comment.author}</span>
          </div>
          <p className="mt-2 text-[10px] font-medium text-orange-300">On “{comment.anchor}”</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{comment.text}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => onReply(comment.author)} className="rounded-lg bg-white/6 px-2.5 py-1.5 text-xs hover:bg-white/10">
              Reply
            </button>
            <button type="button" onClick={() => onResolve(comment.id)} className="rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-400/10">
              Resolve
            </button>
          </div>
        </article>
      ))}
      {filtered.length === 0 && <EmptyState label="No comments match your search." />}
    </div>
  )
}

function TasksView({
  tasks,
  onToggle,
}: {
  tasks: Array<{ id: number; text: string; owner: string; done: boolean }>
  onToggle: (id: number) => void
}) {
  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            aria-pressed={task.done}
            onClick={() => onToggle(task.id)}
            className="glass-subtle flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/6"
          >
            <span className={cn('flex size-4 items-center justify-center rounded border', task.done ? 'border-transparent bg-orange-500' : 'border-white/20')}>
              {task.done && <Check className="size-3" />}
            </span>
            <span className={cn('flex-1 text-sm', task.done && 'text-muted-foreground line-through')}>{task.text}</span>
            <Avatar initials={task.owner} color="from-orange-400 to-orange-500" className="size-6" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function MessageBubble({ message, onSpeechError, canUseVoice = false, onVoiceUpgrade }: { message: ChatMessage; onSpeechError?: (message: string) => void; canUseVoice?: boolean; onVoiceUpgrade?: () => void }) {
  return (
    <article className={cn('flex gap-2.5', message.self && 'flex-row-reverse')}>
      <Avatar initials={message.initials} color={message.color} className="size-7" />
      <div className={cn('max-w-[82%]', message.self && 'text-right')}>
        <div className={cn('flex items-center gap-2', message.self && 'flex-row-reverse')}>
          <span className="text-xs font-medium">{message.author}</span>
          <span className="text-[10px] text-muted-foreground">{message.time}</span>
        </div>
        <div className={cn('mt-1 whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed', message.self ? 'message-self rounded-tr-md text-white' : 'message-highlight rounded-tl-md')}>
          {message.self ? message.text : <AiMarkdown>{message.text}</AiMarkdown>}
          {message.author === 'AirGPT' && onSpeechError && (
            <div className="mt-2 flex justify-end">
              {canUseVoice ? <SpeakButton text={sanitizeResponse(message.text)} onError={onSpeechError} /> : <button type="button" onClick={onVoiceUpgrade} aria-label="Upgrade to use text-to-speech" className="interactive-icon size-8"><LockKeyhole className="size-3.5" /></button>}
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
        <Avatar initials={initials} color="from-orange-500 to-amber-500" className="size-7" />
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

function downloadPanelFile() {
  const content = [
    'AirGPT Narrative v3',
    '',
    'AirGPT 3.0 launch narrative',
    'Enterprise design partners, developer activation, and the November keynote.',
  ].join('\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'application/pdf' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'narrative-v3.pdf'
  anchor.click()
  URL.revokeObjectURL(url)
}
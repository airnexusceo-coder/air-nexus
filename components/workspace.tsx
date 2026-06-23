'use client'

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import {
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bell,
  Bold,
  BookOpen,
  CalendarDays,
  Calculator,
  Check,
  CheckCircle2,
  CircleAlert,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  Gauge,
  History,
  Italic,
  Link2,
  LoaderCircle,
  LockKeyhole,
  ListChecks,
  Menu,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Paperclip,
  PanelRightOpen,
  Plug,
  Plus,
  Share2,
  Sparkles,
  Store,
  TimerReset,
  Trophy,
  Type,
  Users,
  Wand2,
  X,
  Zap,
} from 'lucide-react'
import { ThinkingLogo } from '@/components/thinking-logo'
import { AiMarkdown } from '@/components/ai-markdown'
import { CalculatorsPage } from '@/components/calculators-page'
import { DashboardPage } from '@/components/dashboard-page'
import { SpeakButton } from '@/components/speak-button'
import { WorkspacePages } from '@/components/workspace-pages'
import { MarketplacePage } from '@/components/marketplace-page'
import { sanitizeResponse } from '@/lib/ai/sanitize-response'
import { apiUrl } from '@/lib/api-client'
import { isSpeechCancellation, speakWithOrpheus } from '@/lib/voice/orpheus'
import { useVoiceInput } from '@/lib/voice/use-voice-input'
import type { NexusPlan } from '@/lib/plans'
import type { NexusTransaction } from '@/lib/nexus-points'
import { milestones } from '@/lib/data'
import type { AppDialog, NoticeTone } from '@/components/airnexus-app'
import { cn } from '@/lib/utils'
import {
  DOCUMENT_ACCEPT,
  MAX_DOCUMENTS_PER_MESSAGE,
  pendingDocument,
  readDocument,
  type DocumentAttachment,
} from '@/lib/documents/client'

type WorkspaceProps = {
  activeSection: string
  mainChatOpen: boolean
  onOpenMainChat: () => void
  onCloseMainChat: () => void
  onOpenSidebar: () => void
  onOpenContext: () => void
  onNavigate: (section: string) => void
  onOpenDialog: (dialog: AppDialog) => void
  notify: (message: string, tone?: NoticeTone) => void
  plan: NexusPlan
  nexusPoints: number
  planExpiry: string | null
  autoSpeak: boolean
  redeemedRewards: string[]
  transactions: NexusTransaction[]
  onSelectFree: () => void
  onPayWithCard: (plan: Exclude<NexusPlan, 'Free'>) => void
  onPayWithPoints: (plan: Exclude<NexusPlan, 'Free'>) => void
  onRedeemReward: (reward: { id: string; name: string; cost: number }) => void
  onRequestUpgrade: (feature: string, requiredPlan: Exclude<NexusPlan, 'Free'>) => void
  streakRewardClaimed: boolean
  onClaimStreakReward: () => void
  onEarnNexusPoints: (amount: number, description: string, actionId: string) => void
}

type MainMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
}

type ChatThread = {
  id: string
  title: string
  messages: MainMessage[]
  createdAt: string
  updatedAt: string
}

type LocalAttachment = DocumentAttachment

const collaborators = [
  { initials: 'EM', color: 'from-orange-400 to-orange-500', name: 'Elena M.' },
  { initials: 'JK', color: 'from-orange-400 to-amber-500', name: 'Julian K.' },
  { initials: 'AT', color: 'from-emerald-400 to-teal-500', name: 'Aarav T.' },
  { initials: 'RP', color: 'from-amber-400 to-purple-500', name: 'Riya P.' },
]

const aiTools = [
  { id: 'write', label: 'Write with AI', prompt: 'Draft a concise launch announcement from this strategy brief.' },
  { id: 'summarize', label: 'Summarize', prompt: 'Summarize this document into five clear points.' },
  { id: 'research', label: 'Research', prompt: 'Research the key risks for this product launch plan.' },
  { id: 'brainstorm', label: 'Brainstorm', prompt: 'Brainstorm creative launch ideas for AirGPT 3.0.' },
]

const statusStyles: Record<string, string> = {
  'On track': 'bg-emerald-500/15 text-emerald-300',
  'At risk': 'bg-amber-500/15 text-amber-300',
  Done: 'bg-orange-500/15 text-orange-300',
}

const initialMessages: MainMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'I’m ready to help with the Q4 launch brief. Ask me to write, research, summarize, or turn the plan into action items.',
    time: 'Now',
  },
]

const CHAT_HISTORY_STORAGE_KEY = 'airgpt-chat-history'
const MAX_CHAT_HISTORY_ITEMS = 30

function copyInitialMessages() {
  return initialMessages.map((message) => ({ ...message }))
}

function createChatTitle(messages: MainMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content ?? ''
  const withoutAttachments = firstUserMessage.replace(/\n\nAttachments:[\s\S]*$/i, '')
  const cleaned = withoutAttachments
    .replace(/[`*_>#\[\]()]/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ').filter(Boolean).slice(0, 5)
  return words.length ? words.join(' ') : 'New chat'
}

function isMainMessage(value: unknown): value is MainMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const message = value as Partial<MainMessage>
  return typeof message.id === 'string' && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string' && typeof message.time === 'string'
}

function parseChatHistory(value: string | null): ChatThread[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): ChatThread[] => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return []
      const thread = item as Partial<ChatThread>
      if (typeof thread.id !== 'string' || typeof thread.title !== 'string' || !Array.isArray(thread.messages)) return []
      const messages = thread.messages.filter(isMainMessage)
      if (messages.length === 0) return []
      return [{
        id: thread.id,
        title: thread.title || createChatTitle(messages),
        messages,
        createdAt: typeof thread.createdAt === 'string' ? thread.createdAt : new Date().toISOString(),
        updatedAt: typeof thread.updatedAt === 'string' ? thread.updatedAt : new Date().toISOString(),
      }]
    }).slice(0, MAX_CHAT_HISTORY_ITEMS)
  } catch {
    return []
  }
}

function createChatThread(id = createId('chat'), messages = copyInitialMessages()): ChatThread {
  const now = new Date().toISOString()
  return {
    id,
    title: createChatTitle(messages),
    messages,
    createdAt: now,
    updatedAt: now,
  }
}

function formatThreadDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
function createId(prefix: string) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2)
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function downloadText(filename: string, content: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
export function Workspace({
  activeSection,
  mainChatOpen,
  onOpenMainChat,
  onCloseMainChat,
  onOpenSidebar,
  onOpenContext,
  onNavigate,
  onOpenDialog,
  notify,
  plan,
  nexusPoints,
  planExpiry,
  autoSpeak,
  redeemedRewards,
  transactions,
  onSelectFree,
  onPayWithCard,
  onPayWithPoints,
  onRedeemReward,
  onRequestUpgrade,
  streakRewardClaimed,
  onClaimStreakReward,
  onEarnNexusPoints,
}: WorkspaceProps) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<MainMessage[]>(() => copyInitialMessages())
  const [activeChatId, setActiveChatId] = useState(() => createId('chat'))
  const [chatHistory, setChatHistory] = useState<ChatThread[]>([])
  const [chatHistoryHydrated, setChatHistoryHydrated] = useState(false)
  const [chatHistoryCollapsed, setChatHistoryCollapsed] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [toolsOpen, setToolsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [pointsOpen, setPointsOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [suggestionVisible, setSuggestionVisible] = useState(true)
  const [completedItems, setCompletedItems] = useState([true, true, false, false])
  const [documentTitle, setDocumentTitle] = useState('Q4 Product Launch — Strategy Brief')
  const [renaming, setRenaming] = useState(false)

  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const savedSelectionRef = useRef<Range | null>(null)

  const { isListening, toggleListening: toggleMicrophone } = useVoiceInput({
    onTranscript: (transcript) => {
      setDraft((current) => (current ? current + ' ' : '') + transcript)
    },
    onError: (message) => notify(message, 'warning'),
  })
  const isDocument = activeSection === 'Documents' || activeSection === 'AI Chat'

  useEffect(() => {
    if (mainChatOpen) {
      window.setTimeout(() => composerRef.current?.focus(), 180)
    }
  }, [mainChatOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const stored = parseChatHistory(window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY))
      if (stored.length > 0) {
        setChatHistory(stored)
        setActiveChatId(stored[0].id)
        setMessages(stored[0].messages)
      } else {
        const starterThread = createChatThread(activeChatId, messages)
        setChatHistory([starterThread])
      }
      setChatHistoryHydrated(true)
    }, 0)
    return () => window.clearTimeout(timeoutId)
    // Run only once: this restores the most recent local chat history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chatHistoryHydrated) return
    const timeoutId = window.setTimeout(() => {
      const now = new Date().toISOString()
      setChatHistory((current) => {
        const existing = current.find((thread) => thread.id === activeChatId)
        const nextThread: ChatThread = {
          id: activeChatId,
          title: createChatTitle(messages),
          messages,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        return [nextThread, ...current.filter((thread) => thread.id !== activeChatId)].slice(0, MAX_CHAT_HISTORY_ITEMS)
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [activeChatId, chatHistoryHydrated, messages])

  useEffect(() => {
    if (!chatHistoryHydrated) return
    window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(chatHistory))
  }, [chatHistory, chatHistoryHydrated])

  useEffect(() => {
    const closeTransientUi = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setToolsOpen(false)
      setMoreOpen(false)
      setPointsOpen(false)
      setLinkOpen(false)
    }

    document.addEventListener('keydown', closeTransientUi)
    return () => document.removeEventListener('keydown', closeTransientUi)
  }, [])

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
    editorRef.current?.focus()
    restoreEditorSelection()
    document.execCommand(command, false, value)
    captureEditorSelection()
    notify('Document formatting updated', 'success')
  }

  const startNewChat = () => {
    const nextId = createId('chat')
    setActiveChatId(nextId)
    setMessages(copyInitialMessages())
    setDraft('')
    setAttachments([])
    setToolsOpen(false)
    notify('Started a fresh AI conversation', 'success')
  }

  const selectChatThread = (thread: ChatThread) => {
    setActiveChatId(thread.id)
    setMessages(thread.messages)
    setDraft('')
    setAttachments([])
    setToolsOpen(false)
    notify('Opened ' + thread.title, 'info')
  }

  const sendMessage = async () => {
    const content = draft.trim()
    if ((!content && attachments.length === 0) || isSending) return

    if (attachments.some((file) => file.status === 'processing')) {
      notify('Wait for AirGPT to finish reading the document.', 'info')
      return
    }
    const readableAttachments = attachments.filter((file) => file.status === 'ready')
    if (!content && readableAttachments.length === 0) {
      notify('Remove the unreadable attachment or choose another document.', 'warning')
      return
    }

    const attachmentText =
      readableAttachments.length > 0
        ? '\n\nAttachments: ' + readableAttachments.map((file) => file.name).join(', ')
        : ''
    const userContent = (content || 'Please review the attached documents.') + attachmentText
    const userMessage: MainMessage = {
      id: createId('user'),
      role: 'user',
      content: userContent,
      time: formatTime(),
    }

    setMessages((current) => [...current, userMessage])
    setDraft('')
    setAttachments([])
    setIsSending(true)

    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content || 'Please review and summarize the attached documents.',
          isPlus: plan !== 'Free',
          documents: readableAttachments.map((file) => ({ name: file.name, text: file.text })),
        }),
      })
      const data = (await response.json()) as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'AI service unavailable')
      const safeReply = sanitizeResponse(data.reply)
      setMessages((current) => [
        ...current,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: safeReply,
          time: formatTime(),
        },
      ])
      if (autoSpeak && plan !== 'Free') {
        void speakWithOrpheus(safeReply).catch((error: unknown) => {
          if (!isSpeechCancellation(error)) notify(error instanceof Error ? error.message : 'Speech playback failed.', 'warning')
        })
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: createId('assistant'),
          role: 'assistant',
          content:
            'Here’s a practical next step: turn the launch brief into three owner-led workstreams, confirm the at-risk onboarding milestone this week, and publish one shared scorecard for the November 12 keynote.',
          time: formatTime(),
        },
      ])
      notify('Using the local demo response while the AI service is unavailable', 'warning')
    } finally {
      setIsSending(false)
    }
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const remaining = Math.max(0, MAX_DOCUMENTS_PER_MESSAGE - attachments.length)
    const files = Array.from(event.target.files ?? []).slice(0, remaining)
    event.target.value = ''
    if (remaining === 0) {
      notify('Attach up to five documents per message.', 'warning')
      return
    }
    if (files.length === 0) return

    const pending = files.map((file) => ({ file, attachment: pendingDocument(file, createId('file')) }))
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


  const exportDocument = () => {
    const body = editorRef.current?.innerText ?? ''
    const markdown =
      '# ' + documentTitle + '\n\n' + body + '\n\n## Launch milestones\n' +
      milestones
        .map((item) => '- ' + item.workstream + ': ' + item.milestone + ' (' + item.status + ')')
        .join('\n')
    downloadText('airgpt-q4-strategy-brief.md', markdown)
    notify('Strategy brief exported', 'success')
  }

  const chooseTool = (prompt: string) => {
    setDraft(prompt)
    setToolsOpen(false)
    onOpenMainChat()
  }

  const askAiAboutSelection = () => {
    const selection = window.getSelection()?.toString().trim()
    setDraft(
      selection
        ? 'Improve this selected passage while keeping its meaning:\n\n' + selection
        : 'Improve the launch milestones section for clarity and executive impact.',
    )
    onOpenMainChat()
  }

  if (!isDocument) {
    return (
      <SectionWorkspace
        section={activeSection}
        onOpenSidebar={onOpenSidebar}
        onOpenContext={onOpenContext}
        onNavigate={onNavigate}
        notify={notify}
        plan={plan}
        nexusPoints={nexusPoints}
        planExpiry={planExpiry}
        redeemedRewards={redeemedRewards}
        transactions={transactions}
        onSelectFree={onSelectFree}
        onPayWithCard={onPayWithCard}
        onPayWithPoints={onPayWithPoints}
        onRedeemReward={onRedeemReward}
        onRequestUpgrade={onRequestUpgrade}
        streakRewardClaimed={streakRewardClaimed}
        onClaimStreakReward={onClaimStreakReward}
        onEarnNexusPoints={onEarnNexusPoints}
      />
    )
  }
  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <WorkspaceHeader
        title={documentTitle}
        renaming={renaming}
        pointsOpen={pointsOpen}
        moreOpen={moreOpen}
        onTitleChange={setDocumentTitle}
        onFinishRename={() => setRenaming(false)}
        onTogglePoints={() => {
          setPointsOpen((open) => !open)
          setMoreOpen(false)
        }}
        onToggleMore={() => {
          setMoreOpen((open) => !open)
          setPointsOpen(false)
        }}
        onOpenSidebar={onOpenSidebar}
        onOpenContext={onOpenContext}
        onOpenHistory={() => onOpenDialog('history')}
        onExport={exportDocument}
        onShare={() => onOpenDialog('share')}
        onRename={() => {
          setRenaming(true)
          setMoreOpen(false)
        }}
        onDuplicate={() => {
          exportDocument()
          setMoreOpen(false)
          notify('A duplicate was exported for safe editing', 'success')
        }}
        onPrint={() => {
          setMoreOpen(false)
          window.print()
        }}
        notify={notify}
      />

      {mainChatOpen ? (
        <FullPageChat
          draft={draft}
          messages={messages}
          chatHistory={chatHistory}
          activeChatId={activeChatId}
          chatHistoryCollapsed={chatHistoryCollapsed}
          attachments={attachments}
          isSending={isSending}
          isListening={isListening}
          toolsOpen={toolsOpen}
          composerRef={composerRef}
          fileInputRef={fileInputRef}
          messagesEndRef={messagesEndRef}
          onDraftChange={setDraft}
          onComposerKeyDown={handleComposerKeyDown}
          onSend={() => void sendMessage()}
          onBack={onCloseMainChat}
          onAttach={() => fileInputRef.current?.click()}
          onFilesAdded={addFiles}
          onRemoveAttachment={(id) =>
            setAttachments((current) => current.filter((file) => file.id !== id))
          }
          onToggleTools={() => setToolsOpen((open) => !open)}
          onChooseTool={chooseTool}
          onToggleMicrophone={plan === 'Free' ? () => onRequestUpgrade('Voice Chat', 'Plus') : toggleMicrophone}
          canUseVoice={plan !== 'Free'}
          onVoiceUpgrade={() => onRequestUpgrade('Text-to-Speech', 'Plus')}
          onSpeechError={(message) => notify(message, 'warning')}
          onNewChat={startNewChat}
          onSelectChat={selectChatThread}
          onToggleChatHistory={() => setChatHistoryCollapsed((collapsed) => !collapsed)}
        />
      ) : (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <CompactAiComposer
              draft={draft}
              attachments={attachments}
              isListening={isListening}
              toolsOpen={toolsOpen}
              composerRef={composerRef}
              fileInputRef={fileInputRef}
              onOpenChat={onOpenMainChat}
              onDraftChange={setDraft}
              onComposerKeyDown={handleComposerKeyDown}
              onSend={() => {
                onOpenMainChat()
                void sendMessage()
              }}
              onAttach={() => fileInputRef.current?.click()}
              onFilesAdded={addFiles}
              onRemoveAttachment={(id) =>
                setAttachments((current) => current.filter((file) => file.id !== id))
              }
              onToggleTools={() => setToolsOpen((open) => !open)}
              onChooseTool={chooseTool}
              onToggleMicrophone={plan === 'Free' ? () => onRequestUpgrade('Voice Chat', 'Plus') : toggleMicrophone}
            />

            <div className="mt-9 flex items-center gap-3">
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium">Brief</span>
              <span className="text-xs text-muted-foreground">Owned by Parth Nair</span>
            </div>

            <h1 className="mt-4 bg-gradient-to-r from-white via-orange-100 to-orange-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              {documentTitle}
            </h1>

            <div
              ref={editorRef}
              role="textbox"
              aria-label="Editable strategy brief introduction"
              aria-multiline="true"
              contentEditable
              suppressContentEditableWarning
              onMouseUp={captureEditorSelection}
              onKeyUp={captureEditorSelection}
              onBlur={captureEditorSelection}
              className="mt-4 rounded-xl text-base leading-relaxed text-slate-300 outline-none transition focus:bg-white/[0.025] focus:ring-2 focus:ring-orange-400/20"
            >
              A unified plan to ship AirGPT 3.0 across enterprise, mid-market, and the developer community. This brief consolidates positioning, GTM motions, and the cross-functional milestones leading into November.
            </div>

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
              onAskAi={askAiAboutSelection}
            />

            <div className="message-highlight glass mt-7 flex gap-4 rounded-3xl p-5">
              <div className="glow-orange-sm flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/40 to-orange-400/30">
                <Sparkles className="size-5 text-orange-100" />
              </div>
              <p className="text-sm leading-relaxed">
                <span className="font-bold text-orange-200">AI Summary — </span>
                AirGPT 3.0 targets a $42M ARR opportunity by year-end. Three growth motions are prioritized: enterprise design partners, self-serve developer activation, and a launch keynote on November 12.
              </p>
            </div>

            <h2 className="mt-10 text-2xl font-semibold tracking-tight">Launch milestones</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              The next eight weeks are organized around three workstreams. Each has a dedicated room, owner, and weekly checkpoint.
            </p>

            {suggestionVisible && (
              <div className="message-highlight mt-5 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-xs">
                <Wand2 className="size-5 text-orange-200" />
                <span className="min-w-[180px] flex-1 font-semibold">
                  AI suggestion: sharpen the owner language
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.innerHTML +=
                        '<br><br><strong>Owner alignment:</strong> Every workstream has one accountable lead and a weekly decision checkpoint.'
                    }
                    setSuggestionVisible(false)
                    notify('AI suggestion applied', 'success')
                  }}
                  className="rounded-lg bg-orange-500/30 px-3 py-2 font-semibold text-orange-100 hover:bg-orange-500/45"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuggestionVisible(false)
                    notify('Suggestion dismissed')
                  }}
                  className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-white/8 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            )}

            <MilestoneTable />

            <h2 className="mt-10 text-2xl font-semibold tracking-tight">
              This week’s action items
            </h2>
            <ul className="mt-4 space-y-2.5">
              {[
                'Finalize keynote storyboard with marketing',
                'Lock self-serve onboarding copy',
                'Confirm 5 enterprise LOIs',
                'Publish developer migration guide',
              ].map((item, index) => (
                <li key={item}>
                  <button
                    type="button"
                    aria-pressed={completedItems[index]}
                    onClick={() =>
                      setCompletedItems((current) =>
                        current.map((done, itemIndex) =>
                          itemIndex === index ? !done : done,
                        ),
                      )
                    }
                    className="glass-subtle flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition hover:bg-white/[0.06]"
                  >
                    <span
                      className={cn(
                        'flex size-5 items-center justify-center rounded-md border',
                        completedItems[index]
                          ? 'border-transparent bg-gradient-to-br from-orange-500 to-amber-500'
                          : 'border-white/20',
                      )}
                    >
                      {completedItems[index] && <Check className="size-3 text-white" />}
                    </span>
                    <span className={cn(completedItems[index] && 'text-muted-foreground line-through')}>
                      {item}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="h-16" />
          </div>
        </div>
      )}
    </main>
  )
}
function WorkspaceHeader({
  title,
  renaming,
  pointsOpen,
  moreOpen,
  onTitleChange,
  onFinishRename,
  onTogglePoints,
  onToggleMore,
  onOpenSidebar,
  onOpenContext,
  onOpenHistory,
  onExport,
  onShare,
  onRename,
  onDuplicate,
  onPrint,
  notify,
}: {
  title: string
  renaming: boolean
  pointsOpen: boolean
  moreOpen: boolean
  onTitleChange: (title: string) => void
  onFinishRename: () => void
  onTogglePoints: () => void
  onToggleMore: () => void
  onOpenSidebar: () => void
  onOpenContext: () => void
  onOpenHistory: () => void
  onExport: () => void
  onShare: () => void
  onRename: () => void
  onDuplicate: () => void
  onPrint: () => void
  notify: (message: string, tone?: NoticeTone) => void
}) {
  return (
    <header className="glass-subtle relative z-20 flex shrink-0 items-center justify-between gap-3 border-x-0 border-t-0 px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button type="button" onClick={onOpenSidebar} aria-label="Open navigation" className="interactive-icon lg:hidden">
          <Menu className="size-5" />
        </button>
        <span className="hidden size-9 items-center justify-center rounded-xl bg-orange-500/10 sm:flex">
          <Sparkles className="size-4 text-orange-300" />
        </span>
        <div className="min-w-0 leading-tight">
          {renaming ? (
            <input
              autoFocus
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              onBlur={onFinishRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') onFinishRename()
              }}
              aria-label="Document title"
              className="w-full min-w-0 rounded-lg bg-white/8 px-2 py-1 text-sm font-semibold outline-none ring-2 ring-orange-400/30"
            />
          ) : (
            <p className="truncate text-sm font-semibold sm:text-[15px]">{title}</p>
          )}
          <p className="hidden text-xs text-muted-foreground sm:block">
            Edited 2 minutes ago · Auto-saved
            <span className="ml-1 inline-block size-1.5 rounded-full bg-emerald-400" />
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="hidden items-center -space-x-2 xl:flex">
          {collaborators.map((person) => (
            <button
              key={person.initials}
              type="button"
              onClick={() => notify(person.name + ' is currently viewing')}
              aria-label={'View ' + person.name + ' presence'}
              className={cn(
                'flex size-7 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-bold text-white ring-2 ring-slate-950 transition hover:z-10 hover:scale-110',
                person.color,
              )}
            >
              {person.initials}
            </button>
          ))}
        </div>

        <div className="relative hidden lg:block">
          <button
            type="button"
            onClick={onTogglePoints}
            aria-expanded={pointsOpen}
            className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-white/10"
          >
            +14 Nexus
          </button>
          {pointsOpen && (
            <div className="menu-popover right-0 top-11 w-64">
              <p className="text-sm font-semibold">3,940 Nexus Points</p>
              <p className="mt-1 text-xs text-muted-foreground">
                60 points until your next workspace reward.
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-white/10">
                <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-amber-300 to-orange-300" />
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={onOpenHistory} aria-label="Open version history" className="interactive-icon hidden sm:flex">
          <History className="size-[18px]" />
        </button>
        <button type="button" onClick={onExport} aria-label="Download document" className="interactive-icon hidden sm:flex">
          <Download className="size-[18px]" />
        </button>

        <div className="relative hidden sm:block">
          <button type="button" onClick={onToggleMore} aria-label="Open document menu" aria-expanded={moreOpen} className="interactive-icon">
            <MoreHorizontal className="size-[18px]" />
          </button>
          {moreOpen && (
            <div className="menu-popover right-0 top-11 w-44">
              <MenuItem label="Rename" onClick={onRename} />
              <MenuItem label="Duplicate & export" onClick={onDuplicate} />
              <MenuItem label="Print" onClick={onPrint} />
            </div>
          )}
        </div>

        <button type="button" onClick={onShare} className="primary-action px-3 sm:px-5">
          <Share2 className="size-4" />
          <span className="hidden sm:inline">Share</span>
        </button>
        <button type="button" onClick={onOpenContext} aria-label="Open context panel" className="interactive-icon xl:hidden">
          <PanelRightOpen className="size-5" />
        </button>
      </div>
    </header>
  )
}

function CompactAiComposer({
  draft,
  attachments,
  isListening,
  toolsOpen,
  composerRef,
  fileInputRef,
  onOpenChat,
  onDraftChange,
  onComposerKeyDown,
  onSend,
  onAttach,
  onFilesAdded,
  onRemoveAttachment,
  onToggleTools,
  onChooseTool,
  onToggleMicrophone,
}: {
  draft: string
  attachments: LocalAttachment[]
  isListening: boolean
  toolsOpen: boolean
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onOpenChat: () => void
  onDraftChange: (draft: string) => void
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onAttach: () => void
  onFilesAdded: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveAttachment: (id: string) => void
  onToggleTools: () => void
  onChooseTool: (prompt: string) => void
  onToggleMicrophone: () => void
}) {
  return (
    <section aria-label="Ask AirGPT" className="relative">
      <div className="glass-input glass-glow flex items-center gap-2 rounded-[1.8rem] px-3 py-3 sm:gap-3 sm:px-5">
        <ThinkingLogo isThinking={false} className="hidden size-10 sm:block" />
        <textarea
          ref={composerRef}
          value={draft}
          rows={1}
          onFocus={onOpenChat}
          onClick={onOpenChat}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder="Ask AirGPT to write, research, summarize, brainstorm, or collaborate…"
          aria-label="Main AI prompt"
          className="max-h-32 min-h-7 min-w-0 flex-1 resize-none bg-transparent py-1 text-sm font-medium outline-none placeholder:text-muted-foreground"
        />
        <input ref={fileInputRef} type="file" accept={DOCUMENT_ACCEPT} multiple onChange={onFilesAdded} className="sr-only" tabIndex={-1} />
        <button type="button" onClick={onAttach} aria-label="Attach files" className="interactive-icon">
          <Paperclip className="size-5" />
        </button>
        <div className="relative hidden sm:block">
          <button type="button" onClick={onToggleTools} aria-expanded={toolsOpen} className="message-highlight flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold">
            <Wand2 className="size-4" />
            Tools
            <ChevronDown className="size-3.5" />
          </button>
          {toolsOpen && <ToolsMenu onChoose={onChooseTool} />}
        </div>
        <button
          type="button"
          onClick={onToggleMicrophone}
          aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
          aria-pressed={isListening}
          className={cn('interactive-icon', isListening && 'w-auto gap-1.5 bg-rose-500/20 px-2 text-rose-200')}
        >
          <Mic className="size-5" />
          {isListening && <span className="text-xs font-medium">Listening...</span>}
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={attachments.some((file) => file.status === 'processing') || (!draft.trim() && !attachments.some((file) => file.status === 'ready'))}
          aria-label="Send AI prompt"
          className="send-button"
        >
          <ArrowUp className="size-5" />
        </button>
      </div>
      <AttachmentChips attachments={attachments} onRemove={onRemoveAttachment} />
      <p className="mt-2 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
        <Zap className="size-3.5 text-amber-300" />
        Earn Nexus Points with every AI action — writing, summarizing, and collaboration.
      </p>
    </section>
  )
}
function FullPageChat({
  draft,
  messages,
  chatHistory,
  activeChatId,
  chatHistoryCollapsed,
  attachments,
  isSending,
  isListening,
  toolsOpen,
  composerRef,
  fileInputRef,
  messagesEndRef,
  onDraftChange,
  onComposerKeyDown,
  onSend,
  onBack,
  onAttach,
  onFilesAdded,
  onRemoveAttachment,
  onToggleTools,
  onChooseTool,
  onToggleMicrophone,
  canUseVoice,
  onVoiceUpgrade,
  onSpeechError,
  onNewChat,
  onSelectChat,
  onToggleChatHistory,
}: {
  draft: string
  messages: MainMessage[]
  chatHistory: ChatThread[]
  activeChatId: string
  chatHistoryCollapsed: boolean
  attachments: LocalAttachment[]
  isSending: boolean
  isListening: boolean
  toolsOpen: boolean
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onDraftChange: (draft: string) => void
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onBack: () => void
  onAttach: () => void
  onFilesAdded: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveAttachment: (id: string) => void
  onToggleTools: () => void
  onChooseTool: (prompt: string) => void
  onToggleMicrophone: () => void
  canUseVoice: boolean
  onVoiceUpgrade: () => void
  onSpeechError: (message: string) => void
  onNewChat: () => void
  onSelectChat: (thread: ChatThread) => void
  onToggleChatHistory: () => void
}) {
  return (
    <section className="animate-chat-enter flex min-h-0 flex-1 flex-col" aria-label="AirGPT full-page chat">
      <div className="flex shrink-0 items-center justify-between border-b border-white/6 px-4 py-3 sm:px-6">
        <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-white/7 hover:text-white">
          <ArrowLeft className="size-4" />
          Back to document
        </button>
        <div className="hidden items-center gap-2 text-sm font-semibold sm:flex">
          <ThinkingLogo isThinking={false} className="size-8" />
          AirGPT
        </div>
        <button type="button" onClick={onNewChat} className="rounded-xl px-3 py-2 text-sm text-orange-200 hover:bg-orange-300/10">
          New chat
        </button>
      </div>

      <ChatHistoryStrip threads={chatHistory} activeChatId={activeChatId} onSelectChat={onSelectChat} />

      <div className="min-h-0 flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              {messages.map((message) => (
                <article key={message.id} className={cn('flex gap-3', message.role === 'user' && 'justify-end')}>
                  {message.role === 'assistant' && (
                    <ThinkingLogo isThinking={false} className="size-9" />
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-3xl px-5 py-4 text-sm leading-7 shadow-xl',
                      message.role === 'user'
                        ? 'message-self rounded-br-lg text-white'
                        : 'glass rounded-bl-lg text-slate-200',
                    )}
                  >
                    {message.role === 'assistant' ? <AiMarkdown>{message.content}</AiMarkdown> : <p className="whitespace-pre-wrap">{message.content}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] opacity-50">{message.time}</p>
                      {message.role === 'assistant' && (canUseVoice ? <SpeakButton text={sanitizeResponse(message.content)} onError={onSpeechError} /> : <button type="button" onClick={onVoiceUpgrade} aria-label="Upgrade to use text-to-speech" className="interactive-icon size-8"><LockKeyhole className="size-3.5" /></button>)}
                    </div>
                  </div>
                </article>
              ))}
              {isSending && (
                <article className="flex gap-3">
                  <ThinkingLogo isThinking={isSending} className="size-9" />
                  <div className="glass rounded-3xl rounded-bl-lg px-5 py-4 text-sm text-muted-foreground">
                    Thinking…
                  </div>
                </article>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="shrink-0 px-3 pb-4 sm:px-6 sm:pb-6">
            <div className="relative mx-auto w-full max-w-3xl">
              <AttachmentChips attachments={attachments} onRemove={onRemoveAttachment} />
              <div className="glass-input glass-glow flex items-end gap-2 rounded-[2rem] px-3 py-3 sm:px-4">
                <input ref={fileInputRef} type="file" accept={DOCUMENT_ACCEPT} multiple onChange={onFilesAdded} className="sr-only" tabIndex={-1} />
                <button type="button" onClick={onAttach} aria-label="Attach files" className="interactive-icon mb-0.5">
                  <Paperclip className="size-5" />
                </button>
                <textarea
                  ref={composerRef}
                  value={draft}
                  rows={1}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder="Message AirGPT"
                  aria-label="Chat message"
                  className="max-h-40 min-h-8 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm leading-5 outline-none placeholder:text-muted-foreground"
                />
                <div className="relative hidden sm:block">
                  <button type="button" onClick={onToggleTools} aria-label="Open AI tools" aria-expanded={toolsOpen} className="interactive-icon mb-0.5">
                    <Wand2 className="size-5" />
                  </button>
                  {toolsOpen && <ToolsMenu onChoose={onChooseTool} alignBottom />}
                </div>
                <button
                  type="button"
                  onClick={onToggleMicrophone}
                  aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                  aria-pressed={isListening}
                  className={cn('interactive-icon mb-0.5', isListening && 'w-auto gap-1.5 bg-rose-500/20 px-2 text-rose-200')}
                >
                  <Mic className="size-5" />
                  {isListening && <span className="text-xs font-medium">Listening...</span>}
                </button>
                <button
                  type="button"
                  onClick={onSend}
                  disabled={isSending || attachments.some((file) => file.status === 'processing') || (!draft.trim() && !attachments.some((file) => file.status === 'ready'))}
                  aria-label="Send message"
                  className="send-button"
                >
                  <ArrowUp className="size-5" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Enter to send · Shift+Enter for a new line
              </p>
            </div>
          </div>
        </div>

        <ChatHistoryRail threads={chatHistory} activeChatId={activeChatId} collapsed={chatHistoryCollapsed} onToggleCollapsed={onToggleChatHistory} onNewChat={onNewChat} onSelectChat={onSelectChat} />
      </div>
    </section>
  )
}
function getThreadPreview(thread: ChatThread) {
  const message = thread.messages.find((item) => item.role === 'user') ?? thread.messages.find((item) => item.role === 'assistant')
  return (message?.content ?? 'Start a new AirGPT conversation')
    .replace(/\n\nAttachments:[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 86)
}

function ChatHistoryStrip({
  threads,
  activeChatId,
  onSelectChat,
}: {
  threads: ChatThread[]
  activeChatId: string
  onSelectChat: (thread: ChatThread) => void
}) {
  if (threads.length === 0) return null
  return (
    <div className="scrollbar-thin flex shrink-0 gap-2 overflow-x-auto border-b border-white/6 px-4 py-2 xl:hidden" aria-label="Recent chat history">
      {threads.map((thread) => (
        <button
          key={thread.id}
          type="button"
          onClick={() => onSelectChat(thread)}
          aria-current={thread.id === activeChatId ? 'page' : undefined}
          className={cn(
            'max-w-48 shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition',
            thread.id === activeChatId
              ? 'border-orange-300/35 bg-orange-500/15 text-orange-100'
              : 'border-white/8 bg-white/[0.035] text-slate-400 hover:bg-white/8 hover:text-white',
          )}
        >
          <span className="block truncate font-semibold">{thread.title}</span>
          <span className="mt-0.5 block text-[10px] text-slate-500">{formatThreadDate(thread.updatedAt)}</span>
        </button>
      ))}
    </div>
  )
}

function ChatHistoryRail({
  threads,
  activeChatId,
  collapsed,
  onToggleCollapsed,
  onNewChat,
  onSelectChat,
}: {
  threads: ChatThread[]
  activeChatId: string
  collapsed: boolean
  onToggleCollapsed: () => void
  onNewChat: () => void
  onSelectChat: (thread: ChatThread) => void
}) {
  if (collapsed) {
    return (
      <aside className="hidden w-14 shrink-0 flex-col items-center gap-2 border-l border-white/8 bg-black/20 px-2 py-4 xl:flex" aria-label="Collapsed chat history">
        <button type="button" onClick={onToggleCollapsed} aria-label="Expand chat history" title="Expand chat history" className="interactive-icon size-10">
          <ChevronLeft className="size-4" />
        </button>
        <div className="my-1 h-px w-8 bg-white/10" />
        <button type="button" onClick={() => { onNewChat(); onToggleCollapsed() }} aria-label="New chat" title="New chat" className="interactive-icon size-10">
          <Plus className="size-4" />
        </button>
        <div className="flex flex-1 items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">History</span>
        </div>
      </aside>
    )
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-white/8 bg-black/20 xl:flex" aria-label="Chat history">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-orange-300" />
          <h2 className="text-sm font-semibold">Chat history</h2>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onNewChat} aria-label="Start new chat" className="interactive-icon size-8">
            <Plus className="size-4" />
          </button>
          <button type="button" onClick={onToggleCollapsed} aria-label="Collapse chat history" title="Collapse chat history" className="interactive-icon size-8">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {threads.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-xs leading-5 text-slate-500">
            Your AirGPT conversations will appear here after you send a message.
          </div>
        ) : threads.map((thread) => {
          const active = thread.id === activeChatId
          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelectChat(thread)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group w-full rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/50',
                active
                  ? 'border-orange-300/35 bg-orange-500/15 shadow-[0_0_28px_-18px_#ff6a00]'
                  : 'border-white/8 bg-white/[0.035] hover:border-orange-300/20 hover:bg-orange-500/10',
              )}
            >
              <div className="flex items-start gap-2">
                <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border', active ? 'border-orange-300/30 bg-orange-500/20 text-orange-100' : 'border-white/8 bg-white/5 text-slate-400 group-hover:text-orange-200')}>
                  <MessageSquare className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-100">{thread.title}</span>
                  <span className="mt-1 block truncate text-[11px] text-slate-500">{getThreadPreview(thread)}</span>
                  <span className="mt-2 block text-[10px] font-medium uppercase tracking-wider text-slate-600">{formatThreadDate(thread.updatedAt)}</span>
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
function ToolsMenu({
  onChoose,
  alignBottom = false,
}: {
  onChoose: (prompt: string) => void
  alignBottom?: boolean
}) {
  return (
    <div className={cn('menu-popover right-0 w-52', alignBottom ? 'bottom-12' : 'top-11')}>
      {aiTools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onChoose(tool.prompt)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/8"
        >
          <Sparkles className="size-3.5 text-orange-300" />
          {tool.label}
        </button>
      ))}
    </div>
  )
}

function AttachmentChips({
  attachments,
  onRemove,
}: {
  attachments: LocalAttachment[]
  onRemove: (id: string) => void
}) {
  if (attachments.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-2 px-2">
      {attachments.map((file) => (
        <span key={file.id} className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
          {file.status === 'processing' ? <LoaderCircle className="size-3.5 animate-spin text-orange-300" /> : file.status === 'error' ? <CircleAlert className="size-3.5 text-rose-300" /> : <CheckCircle2 className="size-3.5 text-emerald-300" />}
          <span>{file.name}</span>
          <span className="text-muted-foreground">{file.size}</span>
          <span className={cn('text-[10px]', file.status === 'error' ? 'text-rose-300' : file.status === 'ready' ? 'text-emerald-300' : 'text-orange-200')} title={file.error}>
            {file.status === 'processing' ? 'Reading…' : file.status === 'error' ? 'Unreadable' : file.truncated ? 'Ready · shortened' : 'Ready'}
          </span>
          <button type="button" onClick={() => onRemove(file.id)} aria-label={'Remove ' + file.name} className="rounded-full p-0.5 hover:bg-white/10">
            <X className="size-3" />
          </button>
        </span>
      ))}
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
    <div className="relative mt-5 inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-orange-300/25 bg-orange-500/15 p-2 shadow-lg shadow-orange-500/10">
      <ToolbarButton label="Heading style" icon={Type} onMouseDown={preventSelectionLoss} onClick={() => onFormat('formatBlock', 'h3')} />
      <ToolbarButton label="Bold" icon={Bold} onMouseDown={preventSelectionLoss} onClick={() => onFormat('bold')} />
      <ToolbarButton label="Italic" icon={Italic} onMouseDown={preventSelectionLoss} onClick={() => onFormat('italic')} />
      <ToolbarButton label="Add link" icon={Link2} onMouseDown={preventSelectionLoss} onClick={onToggleLink} active={linkOpen} />
      <ToolbarButton label="Code block" icon={Code2} onMouseDown={preventSelectionLoss} onClick={() => onFormat('formatBlock', 'pre')} />
      <ToolbarButton label="Insert checklist" icon={ListChecks} onMouseDown={preventSelectionLoss} onClick={() => onFormat('insertText', '☐ ')} />
      <span className="mx-1 h-6 w-px bg-white/10" />
      <button type="button" onClick={onAskAi} className="flex items-center gap-2 rounded-xl bg-orange-500/25 px-3 py-2 text-xs font-bold text-orange-100 hover:bg-orange-500/40">
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
          <button type="button" onClick={onApplyLink} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold">
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
      className={cn('interactive-icon size-9', active && 'bg-orange-500/25 text-orange-100')}
    >
      <Icon className="size-4" />
    </button>
  )
}

function MilestoneTable() {
  return (
    <div className="glass mt-6 overflow-x-auto rounded-2xl">
      <div className="min-w-[650px]">
        <div className="grid grid-cols-[1.6fr_1fr_1.2fr_0.9fr] gap-2 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Workstream</span>
          <span>Owner</span>
          <span>Milestone</span>
          <span>Status</span>
        </div>
        {milestones.map((item) => (
          <div key={item.workstream} className="grid grid-cols-[1.6fr_1fr_1.2fr_0.9fr] items-center gap-2 border-b border-white/5 px-5 py-3.5 text-sm last:border-0">
            <span className="font-medium">{item.workstream}</span>
            <span className="text-muted-foreground">{item.owner}</span>
            <span className="text-muted-foreground">{item.milestone}</span>
            <span>
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', statusStyles[item.status])}>
                {item.status}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/8">
      {label}
    </button>
  )
}
function SectionWorkspace({
  section,
  onOpenSidebar,
  onOpenContext,
  onNavigate,
  notify,
  plan,
  nexusPoints,
  planExpiry,
  redeemedRewards,
  transactions,
  onSelectFree,
  onPayWithCard,
  onPayWithPoints,
  onRedeemReward,
  onRequestUpgrade,
  streakRewardClaimed,
  onClaimStreakReward,
  onEarnNexusPoints,
}: {
  section: string
  onOpenSidebar: () => void
  onOpenContext: () => void
  onNavigate: (section: string) => void
  notify: (message: string, tone?: NoticeTone) => void
  plan: NexusPlan
  nexusPoints: number
  planExpiry: string | null
  redeemedRewards: string[]
  transactions: NexusTransaction[]
  onSelectFree: () => void
  onPayWithCard: (plan: Exclude<NexusPlan, 'Free'>) => void
  onPayWithPoints: (plan: Exclude<NexusPlan, 'Free'>) => void
  onRedeemReward: (reward: { id: string; name: string; cost: number }) => void
  onRequestUpgrade: (feature: string, requiredPlan: Exclude<NexusPlan, 'Free'>) => void
  streakRewardClaimed: boolean
  onClaimStreakReward: () => void
  onEarnNexusPoints: (amount: number, description: string, actionId: string) => void
}) {
  const [seconds, setSeconds] = useState(25 * 60)
  const [timerRunning, setTimerRunning] = useState(false)
  const [roomName, setRoomName] = useState('')

  useEffect(() => {
    if (!timerRunning) return

    const id = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false)
          notify('Panic Mode focus sprint complete', 'success')
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(id)
  }, [timerRunning, notify])

  const createRoom = () => {
    const name = roomName.trim()
    if (!name) return
    notify('Created room “' + name + '”', 'success')
    setRoomName('')
  }

  const icon =
    section === 'Dashboard' ? Gauge :
    section === 'Collaboration Rooms' ? Users :
    section === 'Panic Mode' ? TimerReset :
    section === 'Tasks' ? CheckCircle2 :
    section === 'Calendar' ? CalendarDays :
    section === 'Calculators' ? Calculator :
    section === 'Calculators' ? Calculator :
    section === 'Analytics' ? BarChart3 :
    section === 'Leaderboard' ? Trophy :
    section === 'Notifications' ? Bell :
    section === 'Integrations' ? Plug :
    section === 'Marketplace' ? Store :
    section === 'AI Chat' ? MessageSquare :
    BookOpen

  const SectionIcon = icon

  return (
    <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
      <header className="glass-subtle sticky top-0 z-20 flex items-center justify-between border-x-0 border-t-0 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onOpenSidebar} aria-label="Open navigation" className="interactive-icon lg:hidden">
            <Menu className="size-5" />
          </button>
          <SectionIcon className="size-5 text-orange-300" />
          <h1 className="font-semibold">{section}</h1>
        </div>
        <button type="button" onClick={onOpenContext} aria-label="Open context panel" className="interactive-icon xl:hidden">
          <PanelRightOpen className="size-5" />
        </button>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {section === 'Dashboard' && (
          <DashboardPage plan={plan} streakRewardClaimed={streakRewardClaimed} onClaimStreakReward={onClaimStreakReward} onNavigate={onNavigate} onRequestUpgrade={onRequestUpgrade} />
        )}

        {section === 'Collaboration Rooms' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <section className="glass rounded-3xl p-5">
              <h2 className="font-semibold">Create a room</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a focused space for a team or workstream.
              </p>
              <input
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') createRoom()
                }}
                placeholder="Room name"
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-orange-400/50"
              />
              <button type="button" disabled={!roomName.trim()} onClick={createRoom} className="primary-action mt-3 w-full">
                <Plus className="size-4" />
                Create room
              </button>
            </section>
            <section className="glass rounded-3xl p-5">
              <h2 className="font-semibold">Room activity</h2>
              <div className="mt-4 space-y-3">
                {['Product Launch Q4', 'Design System', 'Growth & GTM'].map((room, index) => (
                  <button key={room} type="button" onClick={() => notify('Opened ' + room)} className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-4 text-left hover:bg-white/8">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-200">#</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{room}</span>
                      <span className="block text-xs text-muted-foreground">{4 - index} collaborators online</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {section === 'Panic Mode' && (
          <section className="glass mx-auto max-w-xl rounded-[2rem] p-8 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-200">
              <TimerReset className="size-7" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold">Distraction-free sprint</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Silence the noise and finish one important thing.
            </p>
            <p className="mt-7 font-mono text-6xl font-bold tracking-tight">
              {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <button type="button" onClick={() => setTimerRunning((running) => !running)} className="primary-action px-6">
                {timerRunning ? 'Pause' : 'Start focus'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimerRunning(false)
                  setSeconds(25 * 60)
                }}
                className="secondary-action"
              >
                Reset
              </button>
            </div>
          </section>
        )}
        {['Tasks', 'Calendar', 'Analytics', 'Leaderboard', 'Notifications', 'Integrations'].includes(section) && (
          <WorkspacePages page={section} onNavigate={onNavigate} notify={notify} onEarnNexusPoints={onEarnNexusPoints} />
        )}

        {section === 'Calculators' && (
          <CalculatorsPage plan={plan} onRequestUpgrade={onRequestUpgrade} />
        )}

        {section === 'Marketplace' && (
          <MarketplacePage currentPlan={plan} nexusPoints={nexusPoints} planExpiry={planExpiry} redeemedRewards={redeemedRewards} transactions={transactions} onSelectFree={onSelectFree} onPayWithCard={onPayWithCard} onPayWithPoints={onPayWithPoints} onRedeem={onRedeemReward} />
        )}

        {!['Dashboard', 'Collaboration Rooms', 'Panic Mode', 'Tasks', 'Calendar', 'Analytics', 'Leaderboard', 'Notifications', 'Integrations', 'Marketplace', 'Calculators'].includes(section) && (
          <section className="glass rounded-3xl p-6">
            <h2 className="text-xl font-semibold">{section} workspace</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              This section is connected to the AirGPT shell and ready for its data provider. Use the actions below to continue working now.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate('Documents')} className="primary-action">
                Open strategy brief
              </button>
              <button type="button" onClick={() => onNavigate('AI Chat')} className="secondary-action">
                Ask AirGPT
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

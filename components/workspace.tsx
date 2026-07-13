'use client'

import dynamic from 'next/dynamic'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import {
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bell,
  Brain,
  BookOpen,
  CalendarDays,
  Calculator,
  CheckCircle2,
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  Command,
  ClipboardList,
  Compass,
  FilePlus2,
  Gauge,
  GraduationCap,
  History,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MessageSquare,
  Mic,
  Paperclip,
  PanelRightOpen,
  Pin,
  Plug,
  Plus,
  Search,
  Shield,
  Sparkles,
  Star,
  Store,
  TimerReset,
  Trophy,
  UserSearch,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { ThinkingLogo } from '@/components/thinking-logo'
import { AiMarkdown } from '@/components/ai-markdown'
import { SpeakButton } from '@/components/speak-button'
import { sanitizeResponse } from '@/lib/ai/sanitize-response'
import { apiUrl, fetchWithRetry } from '@/lib/api-client'
import { isSpeechCancellation, speakWithOrpheus } from '@/lib/voice/orpheus'
import { useVoiceInput } from '@/lib/voice/use-voice-input'
import { publicModelName } from '@/lib/ai/model-router'
import type { NexusPlan } from '@/lib/plans'
import type { NexusTransaction } from '@/lib/nexus-points'
import type { CosmeticCategory } from '@/lib/cosmetics'
import type { RoomSummary } from '@/lib/rooms/types'
import type { NoticeTone } from '@/components/airnexus-app'
import { cn } from '@/lib/utils'
import { CHAT_HISTORY_STORAGE_KEY } from '@/lib/chat-history'
import {
  DOCUMENT_ACCEPT,
  MAX_DOCUMENTS_PER_MESSAGE,
  pendingDocument,
  readDocument,
  type DocumentAttachment,
} from '@/lib/documents/client'
import {
  FLASHCARD_DECK_STORAGE_KEY,
  detectStudyIntent,
  parseFlashcardDeck,
  parseGraphSpec,
  parseQuiz,
  type FlashcardDeck,
  type GraphSpec,
  type Quiz,
  type StudyIntent,
} from '@/lib/ai/study-artifacts'
import { QuizCard } from '@/components/study/quiz-card'
import { FunctionGraphCard } from '@/components/study/function-graph'
import { FlashcardPreviewCard } from '@/components/study/flashcard-preview-card'

function SectionLoading() {
  return <div className="grid gap-4" role="status" aria-label="Loading workspace section"><div className="premium-skeleton h-28 rounded-3xl" /><div className="grid gap-4 md:grid-cols-2"><div className="premium-skeleton h-64 rounded-3xl" /><div className="premium-skeleton h-64 rounded-3xl" /></div></div>
}

const ApexHome = dynamic(() => import('@/components/apex/apex-home').then((module) => module.ApexHome), { loading: SectionLoading })
const CoursesPage = dynamic(() => import('@/components/courses-page').then((module) => module.CoursesPage), { loading: SectionLoading })
const PeopleHub = dynamic(() => import('@/components/people/people-hub').then((module) => module.PeopleHub), { loading: SectionLoading })
const AiStudyCoachPage = dynamic(() => import('@/components/ai-study-coach-page').then((module) => module.AiStudyCoachPage), { loading: SectionLoading })
const AiTutorPage = dynamic(() => import('@/components/ai-tutor-page').then((module) => module.AiTutorPage), { loading: SectionLoading })
const AssignmentWorkspacePage = dynamic(() => import('@/components/assignment-workspace-page').then((module) => module.AssignmentWorkspacePage), { loading: SectionLoading })
const CalculatorsPage = dynamic(() => import('@/components/calculators-page').then((module) => module.CalculatorsPage), { loading: SectionLoading })
const DashboardPage = dynamic(() => import('@/components/dashboard-page').then((module) => module.DashboardPage), { loading: SectionLoading })
const DocsPage = dynamic(() => import('@/components/docs-page').then((module) => module.DocsPage), { loading: SectionLoading })
const IntelligentDashboardPage = dynamic(() => import('@/components/intelligent-dashboard-page').then((module) => module.IntelligentDashboardPage), { loading: SectionLoading })
const LessonRecorderPage = dynamic(() => import('@/components/lesson-recorder-page').then((module) => module.LessonRecorderPage), { loading: SectionLoading })
const MarketplacePage = dynamic(() => import('@/components/marketplace-page').then((module) => module.MarketplacePage), { loading: SectionLoading })
const MemoryPage = dynamic(() => import('@/components/memory-page').then((module) => module.MemoryPage), { loading: SectionLoading })
const WorkspacePages = dynamic(() => import('@/components/workspace-pages').then((module) => module.WorkspacePages), { loading: SectionLoading })

type WorkspaceProps = {
  activeSection: string
  mainChatOpen: boolean
  onOpenMainChat: () => void
  onCloseMainChat: () => void
  activeDocId: string | null
  onOpenDoc: (id: string | null) => void
  onOpenSidebar: () => void
  onOpenContext: () => void
  onOpenRoom: (roomId: string) => void
  onNavigate: (section: string) => void
  notify: (message: string, tone?: NoticeTone) => void
  motivationUserId: string
  profileName: string
  plan: NexusPlan
  nexusPoints: number
  planExpiry: string | null
  autoSpeak: boolean
  redeemedRewards: string[]
  equippedAvatar: string | null
  equippedBadge: string | null
  transactions: NexusTransaction[]
  onSelectFree: () => void
  onPayWithCard: (plan: Exclude<NexusPlan, 'Free'>) => void
  onPayWithPoints: (plan: Exclude<NexusPlan, 'Free'>) => void
  onRedeemReward: (reward: { id: string; name: string; cost: number }) => void
  onEquipCosmetic: (category: CosmeticCategory, id: string | null) => void
  onRequestUpgrade: (feature: string, requiredPlan: Exclude<NexusPlan, 'Free'>) => void
  streakRewardClaimed: boolean
  onClaimStreakReward: () => void
  onEarnNexusPoints: (amount: number, description: string, actionId: string) => void
  onRecordStudyActivity: (activity: { id: string; xp: number; description: string; room?: string }) => void
}

type MessageArtifact =
  | { kind: 'quiz'; quiz: Quiz }
  | { kind: 'flashcards'; deck: FlashcardDeck }
  | { kind: 'graph'; graph: GraphSpec }

type MainMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
  tools?: string[]
  model?: string
  artifact?: MessageArtifact
}

type ChatThread = {
  id: string
  title: string
  messages: MainMessage[]
  createdAt: string
  updatedAt: string
  pinned: boolean
  favorite: boolean
}

type LocalAttachment = DocumentAttachment

const aiTools = [
  { id: 'essay-writer', label: 'Essay / Report Writer', prompt: 'Write a well-structured, original essay or report on this topic, with a clear introduction, developed body paragraphs, and a conclusion: ' },
  { id: 'writing-improve', label: 'Improve My Writing', prompt: 'Improve the clarity, flow, grammar, and structure of the following writing while keeping my meaning and voice intact. Return the improved version in full:\n\n' },
  { id: 'flashcards', label: 'Flashcard Generator', prompt: 'Turn the attached documents or material I provide into grounded active-recall flashcards.' },
  { id: 'quiz', label: 'Quiz Generator', prompt: 'Create an interactive quiz from the attached documents or topic.' },
  { id: 'graph', label: 'Graph Generator', prompt: 'Graph this function: ' },
  { id: 'exam-plan', label: 'Exam Planner', prompt: 'Create an exam revision plan from my exam date, topics, and available time.' },
  { id: 'notes', label: 'Notes', prompt: 'Turn my material into clear, structured study notes.' },
  { id: 'calculator', label: 'Calculator', prompt: 'Calculate this accurately and show the key working: ' },
  { id: 'study-plan', label: 'Study Planner', prompt: 'Create a realistic study plan from my priorities and available time.' },
  { id: 'grade', label: 'Grade Calculator', prompt: 'Calculate my current grade from these assessment scores and weights: ' },
  { id: 'document-summary', label: 'Summarise documents', prompt: 'Summarise the attached documents, preserving the main argument, evidence, and conclusions. Identify each source by file name.' },
  { id: 'document-explain', label: 'Explain documents', prompt: 'Explain the attached documents in student-friendly steps. Define unfamiliar terms and use slide or section references when available.' },
  { id: 'document-question', label: 'Ask documents', prompt: 'Answer this question using only the attached documents, and identify which file supports each part: ' },
  { id: 'document-highlights', label: 'Highlight key points', prompt: 'Highlight the most important points in the attached documents and explain why each matters.' },
  { id: 'document-difficulty', label: 'Find difficult concepts', prompt: 'Identify the most difficult concepts in the attached documents, explain why they are challenging, and teach them simply.' },
  { id: 'document-compare', label: 'Compare documents', prompt: 'Compare the attached documents. Show agreements, differences, unique evidence, and any contradictions, using file names.' },
  { id: 'diagram', label: 'Diagram Generator', prompt: 'Create a clear learning diagram for this topic: ' },
]

const MAX_CHAT_HISTORY_ITEMS = 30

// New chats start empty — ChatLanding's greeting screen replaces the old
// scripted assistant welcome bubble (which had drifted to reference a
// specific hardcoded brief that no longer exists).
function copyInitialMessages(): MainMessage[] {
  return []
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
  return typeof message.id === 'string' && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string' && typeof message.time === 'string' && (message.tools === undefined || (Array.isArray(message.tools) && message.tools.every((tool) => typeof tool === 'string'))) && (message.model === undefined || typeof message.model === 'string')
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
        pinned: thread.pinned === true,
        favorite: thread.favorite === true,
      }]
    }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_CHAT_HISTORY_ITEMS)
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
    pinned: false,
    favorite: false,
  }
}

function sortChatThreads(threads: ChatThread[]) {
  return [...threads].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt))
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

export function Workspace({
  activeSection,
  mainChatOpen,
  onOpenMainChat,
  onCloseMainChat,
  activeDocId,
  onOpenDoc,
  onOpenSidebar,
  onOpenContext,
  onOpenRoom,
  onNavigate,
  notify,
  motivationUserId,
  profileName,
  plan,
  nexusPoints,
  planExpiry,
  autoSpeak,
  redeemedRewards,
  equippedAvatar,
  equippedBadge,
  transactions,
  onSelectFree,
  onPayWithCard,
  onPayWithPoints,
  onRedeemReward,
  onEquipCosmetic,
  onRequestUpgrade,
  streakRewardClaimed,
  onClaimStreakReward,
  onEarnNexusPoints,
  onRecordStudyActivity,
}: WorkspaceProps) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<MainMessage[]>(() => copyInitialMessages())
  const [activeChatId, setActiveChatId] = useState(() => createId('chat'))
  const [chatHistory, setChatHistory] = useState<ChatThread[]>([])
  const [chatHistoryHydrated, setChatHistoryHydrated] = useState(false)
  const [chatHistoryCollapsed, setChatHistoryCollapsed] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [toolsOpen, setToolsOpen] = useState(false)
  const [chatLandingVisible, setChatLandingVisible] = useState(true)
  const [chatLandingExiting, setChatLandingExiting] = useState(false)

  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatSearchInputRef = useRef<HTMLInputElement>(null)

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
    const textarea = composerRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`
  }, [draft, mainChatOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isSending ? 'auto' : 'smooth' })
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
          pinned: existing?.pinned ?? false,
          favorite: existing?.favorite ?? false,
        }
        return sortChatThreads([nextThread, ...current.filter((thread) => thread.id !== activeChatId)]).slice(0, MAX_CHAT_HISTORY_ITEMS)
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [activeChatId, chatHistoryHydrated, messages])

  useEffect(() => {
    if (!chatHistoryHydrated) return
    // Interactive artifacts (quiz/flashcards/graph) are re-derived from the
    // AI's reply, not simple JSON — they're intentionally not persisted, so
    // a reloaded chat always shows the caption text instead of stale or
    // unvalidated widget data.
    const persisted = chatHistory.map((thread) => ({
      ...thread,
      messages: thread.messages.map((message): MainMessage => ({
        id: message.id,
        role: message.role,
        content: message.content,
        time: message.time,
        tools: message.tools,
        model: message.model,
      })),
    }))
    window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(persisted))
  }, [chatHistory, chatHistoryHydrated])

  useEffect(() => {
    const closeTransientUi = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setToolsOpen(false)
    }

    document.addEventListener('keydown', closeTransientUi)
    return () => document.removeEventListener('keydown', closeTransientUi)
  }, [])

  // Plays the landing screen's exit animation, then swaps in the full chat
  // shell — the message send itself (if any) runs in parallel, not gated on
  // the animation finishing.
  const beginChatTransition = () => {
    if (chatLandingExiting || !chatLandingVisible) return
    setChatLandingExiting(true)
    window.setTimeout(() => {
      setChatLandingVisible(false)
      setChatLandingExiting(false)
    }, 260)
  }

  const startNewChat = () => {
    if (isSending) {
      notify('Wait for the current response to finish before starting another chat.', 'info')
      return
    }
    const nextId = createId('chat')
    setActiveChatId(nextId)
    setMessages(copyInitialMessages())
    setDraft('')
    setAttachments([])
    setToolsOpen(false)
    setChatLandingVisible(true)
    setChatLandingExiting(false)
    notify('Started a fresh AI conversation', 'success')
  }

  const selectChatThread = (thread: ChatThread) => {
    if (isSending) {
      notify('Wait for the current response to finish before switching conversations.', 'info')
      return
    }
    setActiveChatId(thread.id)
    setMessages(thread.messages)
    setDraft('')
    setAttachments([])
    setToolsOpen(false)
    setChatLandingVisible(false)
    setChatLandingExiting(false)
    notify('Opened ' + thread.title, 'info')
  }

  const toggleChatPreference = (id: string, preference: 'pinned' | 'favorite') => {
    const thread = chatHistory.find((item) => item.id === id)
    if (!thread) return
    const nextValue = !thread[preference]
    setChatHistory((current) => sortChatThreads(current.map((item) => item.id === id ? { ...item, [preference]: nextValue } : item)))
    notify(`${nextValue ? preference === 'pinned' ? 'Pinned' : 'Favourited' : preference === 'pinned' ? 'Unpinned' : 'Removed favourite from'} ${thread.title}`, 'success')
  }

  useEffect(() => {
    const handleChatShortcuts = (event: globalThis.KeyboardEvent) => {
      if (!mainChatOpen) return
      const target = event.target as HTMLElement | null
      const isEditable = target?.matches('input, textarea, [contenteditable="true"]') ?? false
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setChatHistoryCollapsed(false)
        window.setTimeout(() => chatSearchInputRef.current?.focus(), 0)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        if (isSending) return
        const nextId = createId('chat')
        setActiveChatId(nextId)
        setMessages(copyInitialMessages())
        setDraft('')
        setAttachments([])
        setToolsOpen(false)
        setChatLandingVisible(true)
        setChatLandingExiting(false)
        composerRef.current?.focus()
        notify('Started a fresh AI conversation', 'success')
        return
      }
      if (event.key === '/' && !isEditable) {
        event.preventDefault()
        composerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleChatShortcuts)
    return () => document.removeEventListener('keydown', handleChatShortcuts)
  }, [isSending, mainChatOpen, notify])

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

    const studyIntent = content ? detectStudyIntent(content) : null
    if (studyIntent) {
      void sendStructuredArtifact(studyIntent, content, readableAttachments)
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
    const assistantId = createId('assistant')
    const assistantMessage: MainMessage = { id: assistantId, role: 'assistant', content: '', time: formatTime() }

    setMessages((current) => [...current, userMessage, assistantMessage])
    setDraft('')
    setAttachments([])
    setIsSending(true)

    try {
      const response = await fetchWithRetry(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content || 'Please review and summarize the attached documents.',
          history: messages
            .filter((message) => message.id !== 'welcome')
            .slice(-16)
            .map(({ role, content: historyContent }) => ({ role, content: historyContent })),
          mode: 'auto',
          action: 'teach',
          purpose: readableAttachments.length > 0 ? 'document-analysis' : 'conversation',
          isPlus: plan !== 'Free',
          documents: readableAttachments.map((file) => ({ name: file.name, text: file.text })),
          stream: true,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error || 'AI service unavailable')
      }
      const usedTools = (response.headers.get('X-AirNexus-Tools') ?? '').split('|').filter(Boolean).flatMap((value) => {
        try { return [decodeURIComponent(value)] } catch { return [] }
      })
      const selectedModel = response.headers.get('X-AirNexus-Model') ?? undefined
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, tools: usedTools, model: selectedModel } : message))
      if (usedTools.length > 0) {
        notify(`${usedTools.join(' + ')} selected`, 'info')
      }
      if (!response.body) throw new Error('AI response streaming is unavailable')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let streamedReply = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        streamedReply += decoder.decode(value, { stream: true })
        const partialReply = sanitizeResponse(streamedReply)
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: partialReply } : message))
      }
      streamedReply += decoder.decode()
      const safeReply = sanitizeResponse(streamedReply)
      if (!safeReply) throw new Error('AI returned an empty response')
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: safeReply } : message))
      onRecordStudyActivity({ id: `ai-study-${assistantId}`, xp: readableAttachments.length > 0 ? 15 : 10, description: readableAttachments.length > 0 ? 'AI study: analysed documents' : 'AI study session completed' })
      if (autoSpeak && plan !== 'Free') {
        void speakWithOrpheus(safeReply).catch((error: unknown) => {
          if (!isSpeechCancellation(error)) notify(error instanceof Error ? error.message : 'Speech playback failed.', 'warning')
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI service unavailable'
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: `I could not reach the AI tutor: ${errorMessage}. Please try again in a moment.` } : message))
      notify(errorMessage, 'warning')
    } finally {
      setIsSending(false)
    }
  }

  /**
   * Quiz/flashcards/graph requests skip the normal streaming teach-mode call
   * entirely and go through a dedicated non-streaming, JSON-schema action
   * instead — the same proven pattern the Flashcards tab already uses. This
   * is far more reliable than hoping a streamed prose reply happens to
   * contain parseable structure; if the model still returns something
   * unparseable, the raw reply is shown as plain text rather than erroring.
   */
  const sendStructuredArtifact = async (
    intent: StudyIntent,
    content: string,
    readableAttachments: LocalAttachment[],
  ) => {
    const action = intent === 'flashcards' ? 'flashcards' as const : intent === 'graph' ? 'graph' as const : 'quiz' as const
    const userMessage: MainMessage = { id: createId('user'), role: 'user', content, time: formatTime() }
    const assistantId = createId('assistant')
    const assistantMessage: MainMessage = { id: assistantId, role: 'assistant', content: '', time: formatTime() }

    setMessages((current) => [...current, userMessage, assistantMessage])
    setDraft('')
    setAttachments([])
    setIsSending(true)
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: messages
            .filter((message) => message.id !== 'welcome')
            .slice(-16)
            .map(({ role, content: historyContent }) => ({ role, content: historyContent })),
          mode: 'auto',
          action,
          purpose: readableAttachments.length > 0 ? 'document-analysis' : 'study-generation',
          isPlus: plan !== 'Free',
          documents: readableAttachments.map((file) => ({ name: file.name, text: file.text })),
        }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'AI service unavailable')

      if (intent === 'quiz') {
        const quiz = parseQuiz(data.reply)
        if (quiz) {
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: `Here's your quiz: ${quiz.title}`, artifact: { kind: 'quiz', quiz } } : message))
          onRecordStudyActivity({ id: `ai-quiz-${assistantId}`, xp: 15, description: 'AI study: generated a quiz' })
          return
        }
      } else if (intent === 'flashcards') {
        const deck = parseFlashcardDeck(data.reply)
        if (deck) {
          window.localStorage.setItem(FLASHCARD_DECK_STORAGE_KEY, JSON.stringify(deck))
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: `Created ${deck.cards.length} flashcards: ${deck.title}`, artifact: { kind: 'flashcards', deck } } : message))
          onRecordStudyActivity({ id: `ai-flashcards-${assistantId}`, xp: 15, description: 'AI study: generated flashcards' })
          return
        }
      } else {
        const graph = parseGraphSpec(data.reply)
        if (graph) {
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: `Here's your graph: ${graph.title}`, artifact: { kind: 'graph', graph } } : message))
          onRecordStudyActivity({ id: `ai-graph-${assistantId}`, xp: 10, description: 'AI study: generated a graph' })
          return
        }
      }
      // The model didn't return parseable JSON — degrade to plain text
      // instead of failing the whole request.
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: data.reply as string } : message))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI service unavailable'
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: `I could not build that right now: ${errorMessage}. Please try again.` } : message))
      notify(errorMessage, 'warning')
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


  const chooseTool = (prompt: string) => {
    setDraft(prompt)
    setToolsOpen(false)
    onOpenMainChat()
  }

  // Appends an AI reply to the user's document, resolving (opening or
  // silently creating) one first if none is open yet — mirrors DocsPage's
  // own no-manual-creation-step resolution so this works even if the
  // student never visited Documents this session.
  const insertToActiveDocument = async (text: string) => {
    let docId = activeDocId
    if (!docId) {
      const listResponse = await fetch('/api/docs', { credentials: 'include', cache: 'no-store' })
      if (listResponse.ok) {
        const data = await listResponse.json() as { docs: Array<{ id: string; role: string; updatedAt: string }> }
        const owned = data.docs.filter((item) => item.role === 'owner').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        docId = owned[0]?.id ?? null
      }
      if (!docId) {
        const createResponse = await fetch('/api/docs', { method: 'POST', credentials: 'include' })
        const created = await createResponse.json().catch(() => ({})) as { id?: string; error?: string }
        if (!createResponse.ok || !created.id) {
          notify(created.error ?? 'Could not reach your document.', 'warning')
          return
        }
        docId = created.id
      }
    }
    const response = await fetch(`/api/docs/${docId}`, { credentials: 'include', cache: 'no-store' })
    if (!response.ok) {
      notify('Could not reach the document to insert into.', 'warning')
      return
    }
    const current = await response.json() as { body: string; role: string }
    if (current.role === 'viewer') {
      notify('You have view-only access to this document.', 'warning')
      return
    }
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
    if (docId !== activeDocId) onOpenDoc(docId)
    notify('Added to your document', 'success')
  }

  if (!isDocument) {
    return (
      <SectionWorkspace
        section={activeSection}
        onOpenSidebar={onOpenSidebar}
        onOpenContext={onOpenContext}
        onOpenRoom={onOpenRoom}
        onNavigate={onNavigate}
        onContinueStudy={onOpenMainChat}
        notify={notify}
        profileName={profileName}
        motivationUserId={motivationUserId}
        plan={plan}
        nexusPoints={nexusPoints}
        planExpiry={planExpiry}
        redeemedRewards={redeemedRewards}
        equippedAvatar={equippedAvatar}
        equippedBadge={equippedBadge}
        transactions={transactions}
        onSelectFree={onSelectFree}
        onPayWithCard={onPayWithCard}
        onPayWithPoints={onPayWithPoints}
        onRedeemReward={onRedeemReward}
        onEquipCosmetic={onEquipCosmetic}
        onRequestUpgrade={onRequestUpgrade}
        streakRewardClaimed={streakRewardClaimed}
        onClaimStreakReward={onClaimStreakReward}
        onEarnNexusPoints={onEarnNexusPoints}
        onRecordStudyActivity={onRecordStudyActivity}
      />
    )
  }
  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      {mainChatOpen ? (
        chatLandingVisible ? (
          <ChatLanding
            profileName={profileName}
            draft={draft}
            onDraftChange={setDraft}
            isExiting={chatLandingExiting}
            onFocusInput={beginChatTransition}
            onSubmit={() => { beginChatTransition(); void sendMessage() }}
            onOpenSidebar={onOpenSidebar}
            onOpenContext={onOpenContext}
          />
        ) : (
        <FullPageChat
          draft={draft}
          messages={messages}
          chatHistory={chatHistory}
          activeChatId={activeChatId}
          chatHistoryCollapsed={chatHistoryCollapsed}
          chatHistoryHydrated={chatHistoryHydrated}
          chatSearchQuery={chatSearchQuery}
          chatSearchInputRef={chatSearchInputRef}
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
          onToggleMicrophone={toggleMicrophone}
          canUseVoice={plan !== 'Free'}
          onVoiceUpgrade={() => onRequestUpgrade('Text-to-Speech', 'Plus')}
          onSpeechError={(message) => notify(message, 'warning')}
          onNewChat={startNewChat}
          onSelectChat={selectChatThread}
          onSearchChat={setChatSearchQuery}
          onTogglePinned={(id) => toggleChatPreference(id, 'pinned')}
          onToggleFavorite={(id) => toggleChatPreference(id, 'favorite')}
          onToggleChatHistory={() => setChatHistoryCollapsed((collapsed) => !collapsed)}
          onOpenFlashcards={() => onNavigate('Flashcards')}
          onInsertToDocument={(text) => void insertToActiveDocument(text)}
        />
        )
      ) : (
        <DocsPage
          activeDocId={activeDocId}
          onOpenDoc={onOpenDoc}
          onOpenSidebar={onOpenSidebar}
          onOpenContext={onOpenContext}
          notify={notify}
        />
      )}
    </main>
  )
}

function ChatLanding({
  profileName,
  draft,
  onDraftChange,
  isExiting,
  onFocusInput,
  onSubmit,
  onOpenSidebar,
  onOpenContext,
}: {
  profileName: string
  draft: string
  onDraftChange: (value: string) => void
  isExiting: boolean
  onFocusInput: () => void
  onSubmit: () => void
  onOpenSidebar: () => void
  onOpenContext: () => void
}) {
  const firstName = profileName.trim().split(/\s+/)[0] || 'there'
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', isExiting && 'animate-landing-exit pointer-events-none')}>
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-5">
        <button type="button" onClick={onOpenSidebar} aria-label="Open navigation" className="interactive-icon lg:hidden">
          <Menu className="size-5" />
        </button>
        <span />
        <button type="button" onClick={onOpenContext} aria-label="Open context panel" className="interactive-icon xl:hidden">
          <PanelRightOpen className="size-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl text-center">
          <ThinkingLogo isThinking={false} className="mx-auto size-12" />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{firstName}, ready to learn?</h1>
          <p className="mt-2 text-sm text-slate-400">Ask a question, paste your notes, or tell AirGPT what you&apos;re studying.</p>
          <form
            onSubmit={(event) => { event.preventDefault(); if (draft.trim()) onSubmit() }}
            className="glass-input mt-8 flex items-center gap-2 rounded-2xl px-4 py-3.5 text-left"
          >
            <Sparkles className="size-5 shrink-0 text-zinc-300" />
            <input
              autoFocus
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onFocus={onFocusInput}
              placeholder="Ask AirGPT anything…"
              aria-label="Ask AirGPT"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-500"
            />
            <button type="submit" disabled={!draft.trim()} aria-label="Send message" className="send-button">
              <ArrowUp className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function FullPageChat({
  draft,
  messages,
  chatHistory,
  activeChatId,
  chatHistoryCollapsed,
  chatHistoryHydrated,
  chatSearchQuery,
  chatSearchInputRef,
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
  onSearchChat,
  onTogglePinned,
  onToggleFavorite,
  onToggleChatHistory,
  onOpenFlashcards,
  onInsertToDocument,
}: {
  draft: string
  messages: MainMessage[]
  chatHistory: ChatThread[]
  activeChatId: string
  chatHistoryCollapsed: boolean
  chatHistoryHydrated: boolean
  chatSearchQuery: string
  chatSearchInputRef: React.RefObject<HTMLInputElement | null>
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
  onSearchChat: (query: string) => void
  onTogglePinned: (id: string) => void
  onToggleFavorite: (id: string) => void
  onToggleChatHistory: () => void
  onOpenFlashcards: () => void
  onInsertToDocument: (text: string) => void
}) {
  const activeThread = chatHistory.find((thread) => thread.id === activeChatId)
  const lastMessage = messages[messages.length - 1]
  return (
    <section className="animate-chat-enter premium-chat-shell flex min-h-0 flex-1 flex-col" aria-label="AirGPT full-page chat">
      <div className="glass-subtle flex shrink-0 items-center justify-between gap-3 border-x-0 border-t-0 px-3 py-3 sm:px-5">
        <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/7 hover:text-white">
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Workspace</span>
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <ThinkingLogo isThinking={isSending} className="size-8 shrink-0" />
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{activeThread?.title ?? 'New chat'}</p><p className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className={cn('size-1.5 rounded-full', isSending ? 'animate-pulse bg-white' : 'bg-emerald-400')} />{isSending ? 'AirGPT is responding' : 'AirGPT ready'}</p></div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => { onToggleChatHistory(); window.setTimeout(() => chatSearchInputRef.current?.focus(), 0) }} aria-label="Search conversations" className="interactive-icon sm:hidden"><Search className="size-4" /></button>
          <span className="hidden items-center gap-1 rounded-lg border border-white/8 bg-white/[0.035] px-2 py-1 text-[10px] text-slate-500 lg:inline-flex"><Command className="size-3" />K search</span>
          <button type="button" onClick={onNewChat} className="primary-action min-h-8 px-3 py-1.5 text-xs"><Plus className="size-3.5" /><span className="hidden sm:inline">New chat</span></button>
        </div>
      </div>

      <ChatHistoryStrip threads={chatHistory} activeChatId={activeChatId} searchQuery={chatSearchQuery} onSearchChat={onSearchChat} onSelectChat={onSelectChat} />

      <div className="min-h-0 flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="scrollbar-thin min-h-0 flex-1 scroll-smooth overflow-y-auto px-3 py-7 sm:px-6 sm:py-10">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
              {messages.map((message) => {
                const streaming = isSending && message.role === 'assistant' && message.id === lastMessage?.id
                return <article key={message.id} className={cn('premium-message flex gap-3', message.role === 'user' && 'justify-end')}>
                  {message.role === 'assistant' && (
                    <ThinkingLogo isThinking={streaming} className="mt-1 size-9 shrink-0" />
                  )}
                  <div className={cn('flex min-w-0 flex-col gap-3', message.artifact ? 'w-full max-w-full sm:max-w-[90%]' : 'max-w-[88%] sm:max-w-[82%]')}>
                    <div
                      className={cn(
                        'rounded-[1.65rem] px-5 py-4 text-sm leading-7 shadow-xl',
                        message.role === 'user'
                          ? 'message-self rounded-br-lg text-black'
                          : 'glass premium-assistant-message rounded-bl-lg text-slate-200',
                      )}
                    >
                      {message.role === 'assistant' ? message.content ? <><AiMarkdown>{message.content}</AiMarkdown>{streaming && <span aria-hidden="true" className="streaming-caret" />}</> : <TypingIndicator /> : <p className="whitespace-pre-wrap">{message.content}</p>}
                      <div className="mt-2 flex items-center justify-between gap-2">
                      {message.role === 'assistant' && message.tools && message.tools.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{message.tools.map((tool) => <span key={tool} className="tool-activity-chip"><Wand2 className="size-3" />{tool}</span>)}</div>}
                        <p className="text-[10px] opacity-45">{message.model ? `${publicModelName(message.model)} · ` : ''}{streaming ? 'Streaming' : message.time}</p>
                        {message.role === 'assistant' && message.content && !streaming && (
                          <span className="flex items-center gap-1">
                            <button type="button" onClick={() => onInsertToDocument(message.content)} aria-label="Save to document" title="Save to document" className="interactive-icon size-8"><FilePlus2 className="size-3.5" /></button>
                            {canUseVoice ? <SpeakButton text={sanitizeResponse(message.content)} onError={onSpeechError} /> : <button type="button" onClick={onVoiceUpgrade} aria-label="Upgrade to use text-to-speech" className="interactive-icon size-8"><LockKeyhole className="size-3.5" /></button>}
                          </span>
                        )}
                      </div>
                    </div>
                    {message.artifact?.kind === 'quiz' && <QuizCard quiz={message.artifact.quiz} />}
                    {message.artifact?.kind === 'flashcards' && <FlashcardPreviewCard deck={message.artifact.deck} onOpenDeck={onOpenFlashcards} />}
                    {message.artifact?.kind === 'graph' && <FunctionGraphCard graph={message.artifact.graph} />}
                  </div>
                </article>
              })}
              {isSending && lastMessage?.role !== 'assistant' && (
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
                  onFocus={() => window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 120)}
                  enterKeyHint="send"
                  autoCapitalize="sentences"
                  autoCorrect="on"
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

        <ChatHistoryRail threads={chatHistory} activeChatId={activeChatId} collapsed={chatHistoryCollapsed} hydrated={chatHistoryHydrated} searchQuery={chatSearchQuery} searchInputRef={chatSearchInputRef} onSearchChat={onSearchChat} onToggleCollapsed={onToggleChatHistory} onNewChat={onNewChat} onSelectChat={onSelectChat} onTogglePinned={onTogglePinned} onToggleFavorite={onToggleFavorite} />
      </div>
    </section>
  )
}

const THINKING_MICROCOPY = [
  'Connecting ideas',
  'Analysing the question',
  'Building an explanation',
  'Following the concept',
]

function TypingIndicator() {
  const [labelIndex, setLabelIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setLabelIndex((index) => (index + 1) % THINKING_MICROCOPY.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  return (
    <span role="status" aria-label="AirGPT is thinking" className="thinking-dots">
      <span className="thinking-dots__dot" />
      <span className="thinking-dots__dot" />
      <span className="thinking-dots__dot" />
      <span className="thinking-dots__label">{THINKING_MICROCOPY[labelIndex]}</span>
    </span>
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

function filterChatThreads(threads: ChatThread[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return threads
  return threads.filter((thread) => thread.title.toLowerCase().includes(normalized) || thread.messages.some((message) => message.content.toLowerCase().includes(normalized)))
}

function ChatHistoryStrip({
  threads,
  activeChatId,
  searchQuery,
  onSearchChat,
  onSelectChat,
}: {
  threads: ChatThread[]
  activeChatId: string
  searchQuery: string
  onSearchChat: (query: string) => void
  onSelectChat: (thread: ChatThread) => void
}) {
  if (threads.length === 0) return null
  const visibleThreads = filterChatThreads(threads, searchQuery)
  return (
    <div className="scrollbar-thin flex shrink-0 gap-2 overflow-x-auto border-b border-white/6 px-3 py-2.5 xl:hidden" aria-label="Recent chat history">
      <label className="glass-subtle sticky left-0 z-10 flex min-w-44 shrink-0 items-center gap-2 rounded-xl px-3"><Search className="size-3.5 text-slate-500" /><input aria-label="Search conversations" value={searchQuery} onChange={(event) => onSearchChat(event.target.value)} placeholder="Search chats" className="min-w-0 flex-1 bg-transparent py-2 text-xs text-white outline-none placeholder:text-slate-600" /></label>
      {visibleThreads.map((thread) => (
        <button
          key={thread.id}
          type="button"
          onClick={() => onSelectChat(thread)}
          aria-current={thread.id === activeChatId ? 'page' : undefined}
          className={cn(
            'max-w-48 shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition',
            thread.id === activeChatId
              ? 'border-white/35 bg-white/15 text-white'
              : 'border-white/8 bg-white/[0.035] text-slate-400 hover:bg-white/8 hover:text-white',
          )}
        >
          <span className="flex items-center gap-1 truncate font-semibold">{thread.pinned && <Pin className="size-3 shrink-0 fill-current" />}{thread.favorite && <Star className="size-3 shrink-0 fill-current" />}<span className="truncate">{thread.title}</span></span>
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
  hydrated,
  searchQuery,
  searchInputRef,
  onSearchChat,
  onToggleCollapsed,
  onNewChat,
  onSelectChat,
  onTogglePinned,
  onToggleFavorite,
}: {
  threads: ChatThread[]
  activeChatId: string
  collapsed: boolean
  hydrated: boolean
  searchQuery: string
  searchInputRef: React.RefObject<HTMLInputElement | null>
  onSearchChat: (query: string) => void
  onToggleCollapsed: () => void
  onNewChat: () => void
  onSelectChat: (thread: ChatThread) => void
  onTogglePinned: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const activeThread = threads.find((thread) => thread.id === activeChatId)
  if (collapsed) {
    return (
      <aside className="glass-subtle hidden w-14 shrink-0 flex-col items-center gap-2 border-y-0 border-r-0 px-2 py-4 xl:flex" aria-label="Collapsed chat history">
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

  const visibleThreads = filterChatThreads(threads, searchQuery)
  return (
    <aside className="glass-subtle hidden w-80 shrink-0 flex-col border-y-0 border-r-0 xl:flex" aria-label="Chat history">
      <div className="flex items-center justify-between border-b border-white/8 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-zinc-300" />
          <div><h2 className="text-sm font-semibold">Conversations</h2><p className="text-[10px] text-slate-600">{threads.length} saved locally</p></div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => activeThread && onTogglePinned(activeThread.id)} disabled={!activeThread} aria-label={activeThread?.pinned ? 'Unpin current chat' : 'Pin current chat'} aria-pressed={activeThread?.pinned ?? false} className={cn('interactive-icon size-8', activeThread?.pinned && 'bg-white/12 text-white')}><Pin className={cn('size-3.5', activeThread?.pinned && 'fill-current')} /></button>
          <button type="button" onClick={() => activeThread && onToggleFavorite(activeThread.id)} disabled={!activeThread} aria-label={activeThread?.favorite ? 'Remove current chat from favourites' : 'Favourite current chat'} aria-pressed={activeThread?.favorite ?? false} className={cn('interactive-icon size-8', activeThread?.favorite && 'bg-white/12 text-white')}><Star className={cn('size-3.5', activeThread?.favorite && 'fill-current')} /></button>
          <button type="button" onClick={onNewChat} aria-label="Start new chat" className="interactive-icon size-8">
            <Plus className="size-4" />
          </button>
          <button type="button" onClick={onToggleCollapsed} aria-label="Collapse chat history" title="Collapse chat history" className="interactive-icon size-8">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="px-3 pt-3"><label className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 transition focus-within:border-white/30 focus-within:bg-black/30"><Search className="size-4 text-slate-600" /><input ref={searchInputRef} aria-label="Search conversations" value={searchQuery} onChange={(event) => onSearchChat(event.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-slate-600" /><span className="flex items-center gap-0.5 rounded-md border border-white/8 px-1.5 py-0.5 text-[9px] text-slate-600"><Command className="size-2.5" />K</span></label></div>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {!hydrated ? [0, 1, 2, 3].map((item) => <div key={item} className="premium-skeleton h-20 rounded-2xl" />) : visibleThreads.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-xs leading-5 text-slate-500">
            {searchQuery ? 'No conversations match this search.' : 'Your AirGPT conversations will appear here after you send a message.'}
          </div>
        ) : visibleThreads.map((thread) => {
          const active = thread.id === activeChatId
          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelectChat(thread)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group w-full rounded-2xl border p-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                active
                  ? 'border-white/35 bg-white/15 shadow-[0_0_28px_-18px_rgba(255,255,255,0.6)]'
                  : 'border-white/8 bg-white/[0.028] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8',
              )}
            >
              <div className="flex items-start gap-2">
                <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border', active ? 'border-white/30 bg-white/20 text-white' : 'border-white/8 bg-white/5 text-slate-400 group-hover:text-white')}>
                  <MessageSquare className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-100">{thread.pinned && <Pin className="size-3 shrink-0 fill-current text-white" />}{thread.favorite && <Star className="size-3 shrink-0 fill-current text-zinc-300" />}<span className="truncate">{thread.title}</span></span>
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
    <div className={cn('menu-popover scrollbar-thin right-0 max-h-96 w-64 overflow-y-auto', alignBottom ? 'bottom-12' : 'top-11')}>
      {aiTools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onChoose(tool.prompt)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/8"
        >
          <Sparkles className="size-3.5 text-zinc-300" />
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
          {file.status === 'processing' ? <LoaderCircle className="size-3.5 animate-spin text-zinc-300" /> : file.status === 'error' ? <CircleAlert className="size-3.5 text-rose-300" /> : <CheckCircle2 className="size-3.5 text-emerald-300" />}
          <span>{file.name}</span>
          <span className="text-muted-foreground">{file.size}</span>
          <span className={cn('text-[10px]', file.status === 'error' ? 'text-rose-300' : file.status === 'ready' ? 'text-emerald-300' : 'text-zinc-300')} title={file.error}>
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
function SectionWorkspace({
  section,
  onOpenSidebar,
  onOpenContext,
  onOpenRoom,
  onNavigate,
  onContinueStudy,
  notify,
  profileName,
  motivationUserId,
  plan,
  nexusPoints,
  planExpiry,
  redeemedRewards,
  equippedAvatar,
  equippedBadge,
  transactions,
  onSelectFree,
  onPayWithCard,
  onPayWithPoints,
  onRedeemReward,
  onEquipCosmetic,
  onRequestUpgrade,
  streakRewardClaimed,
  onClaimStreakReward,
  onEarnNexusPoints,
  onRecordStudyActivity,
}: {
  section: string
  onOpenSidebar: () => void
  onOpenContext: () => void
  onOpenRoom: (roomId: string) => void
  onNavigate: (section: string) => void
  onContinueStudy: () => void
  notify: (message: string, tone?: NoticeTone) => void
  profileName: string
  motivationUserId: string
  plan: NexusPlan
  nexusPoints: number
  planExpiry: string | null
  redeemedRewards: string[]
  equippedAvatar: string | null
  equippedBadge: string | null
  transactions: NexusTransaction[]
  onSelectFree: () => void
  onPayWithCard: (plan: Exclude<NexusPlan, 'Free'>) => void
  onPayWithPoints: (plan: Exclude<NexusPlan, 'Free'>) => void
  onRedeemReward: (reward: { id: string; name: string; cost: number }) => void
  onEquipCosmetic: (category: CosmeticCategory, id: string | null) => void
  onRequestUpgrade: (feature: string, requiredPlan: Exclude<NexusPlan, 'Free'>) => void
  streakRewardClaimed: boolean
  onClaimStreakReward: () => void
  onEarnNexusPoints: (amount: number, description: string, actionId: string) => void
  onRecordStudyActivity: (activity: { id: string; xp: number; description: string; room?: string }) => void
}) {
  const [seconds, setSeconds] = useState(25 * 60)
  const [timerRunning, setTimerRunning] = useState(false)

  useEffect(() => {
    if (!timerRunning) return

    const id = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false)
          notify('Panic Mode focus sprint complete', 'success')
          onRecordStudyActivity({ id: `focus-sprint-${Date.now()}`, xp: 25, description: 'Completed a 25-minute focus sprint' })
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(id)
  }, [timerRunning, notify, onRecordStudyActivity])

  const icon =
    section === 'Dashboard' ? Gauge :
    section === 'Daily Dashboard' ? Sparkles :
    section === 'AI Memory' ? Brain :
    section === 'Study Coach' ? Compass :
    section === 'Courses' ? BookOpen :
    section === 'AI Tutor' ? GraduationCap :
    section === 'Flashcards' ? Layers3 :
    section === 'Assignment Workspace' ? ClipboardList :
    section === 'Record Lesson' ? Mic :
    section === 'Collaboration Rooms' ? Users :
    section === 'People' ? UserSearch :
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
    section === 'Apex' ? Shield :
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
          <SectionIcon className="size-5 text-zinc-300" />
          <h1 className="font-semibold">{section}</h1>
        </div>
        <button type="button" onClick={onOpenContext} aria-label="Open context panel" className="interactive-icon xl:hidden">
          <PanelRightOpen className="size-5" />
        </button>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {section === 'Dashboard' && (
          <DashboardPage plan={plan} motivationUserId={motivationUserId} profileName={profileName} streakRewardClaimed={streakRewardClaimed} onClaimStreakReward={onClaimStreakReward} onNavigate={onNavigate} onRequestUpgrade={onRequestUpgrade} />
        )}

        {section === 'Daily Dashboard' && (
          <IntelligentDashboardPage
            profileName={profileName}
            transactions={transactions}
            onContinueStudy={onContinueStudy}
            onNavigate={onNavigate}
            notify={notify}
          />
        )}
        {section === 'AI Memory' && (
          <MemoryPage notify={notify} />
        )}


        {section === 'Study Coach' && (
          <AiStudyCoachPage
            profileName={profileName}
            transactions={transactions}
            onNavigate={onNavigate}
            notify={notify}
          />
        )}

        {(section === 'AI Tutor' || section === 'Flashcards') && (
          <AiTutorPage
            activeTab={section === 'Flashcards' ? 'flashcards' : 'tutor'}
            onNavigate={onNavigate}
            notify={notify}
          />
        )}

        {section === 'Assignment Workspace' && (
          <AssignmentWorkspacePage
            profileName={profileName}
            notify={notify}
          />
        )}

        {section === 'Record Lesson' && (
          <LessonRecorderPage onNavigate={onNavigate} notify={notify} />
        )}

        {section === 'Collaboration Rooms' && (
          <CollaborationRoomsSection notify={notify} onOpenRoom={onOpenRoom} />
        )}

        {section === 'People' && (
          <PeopleHub notify={notify} onNavigate={onNavigate} />
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
          <WorkspacePages page={section} onNavigate={onNavigate} notify={notify} onEarnNexusPoints={onEarnNexusPoints} motivationUserId={motivationUserId} profileName={profileName} />
        )}

        {section === 'Calculators' && (
          <CalculatorsPage plan={plan} onRequestUpgrade={onRequestUpgrade} />
        )}

        {section === 'Marketplace' && (
          <MarketplacePage currentPlan={plan} nexusPoints={nexusPoints} planExpiry={planExpiry} redeemedRewards={redeemedRewards} equippedAvatar={equippedAvatar} equippedBadge={equippedBadge} transactions={transactions} onSelectFree={onSelectFree} onPayWithCard={onPayWithCard} onPayWithPoints={onPayWithPoints} onRedeem={onRedeemReward} onEquip={onEquipCosmetic} />
        )}

        {section === 'Courses' && (
          <CoursesPage plan={plan} notify={notify} onRequestUpgrade={onRequestUpgrade} />
        )}

        {section === 'Apex' && (
          <ApexHome notify={notify} nexusPoints={nexusPoints} onRedeemReward={onRedeemReward} />
        )}

        {!['Dashboard', 'Daily Dashboard', 'AI Memory', 'Study Coach', 'AI Tutor', 'Flashcards', 'Assignment Workspace', 'Record Lesson', 'Collaboration Rooms', 'People', 'Panic Mode', 'Tasks', 'Calendar', 'Analytics', 'Leaderboard', 'Notifications', 'Integrations', 'Marketplace', 'Calculators', 'Courses', 'Apex'].includes(section) && (
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

function CollaborationRoomsSection({ notify, onOpenRoom }: { notify: (message: string, tone?: NoticeTone) => void; onOpenRoom: (roomId: string) => void }) {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null)
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const load = useCallback(async () => {
    const [roomsResponse, adminResponse] = await Promise.all([
      fetch('/api/rooms', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/admin/auth/session', { credentials: 'include', cache: 'no-store' }),
    ])
    if (roomsResponse.ok) setRooms(((await roomsResponse.json()) as { rooms: RoomSummary[] }).rooms)
    if (adminResponse.ok) {
      const admin = (await adminResponse.json()) as { role: string; permissions: string[] }
      setIsAdmin(admin.role === 'super_admin' || admin.permissions.includes('rooms.create'))
    } else {
      setIsAdmin(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const createRoom = async () => {
    const name = roomName.trim()
    if (!name) return
    setCreating(true)
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        notify(data?.error ?? 'Could not create room.', 'warning')
        return
      }
      setRoomName('')
      notify(`Created room "${name}"`, 'success')
      void load()
    } catch {
      notify('Network error. Please try again.', 'warning')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={cn('grid gap-5', isAdmin && 'lg:grid-cols-[1fr_1.4fr]')}>
      {isAdmin && (
        <section className="glass rounded-3xl p-5">
          <h2 className="font-semibold">Create a room</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a focused space for a team or workstream.
          </p>
          <input
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void createRoom()
            }}
            placeholder="Room name"
            className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-white/50"
          />
          <button type="button" disabled={!roomName.trim() || creating} onClick={() => void createRoom()} className="primary-action mt-3 w-full">
            <Plus className="size-4" />
            Create room
          </button>
        </section>
      )}
      <section className="glass rounded-3xl p-5">
        <h2 className="font-semibold">Room activity</h2>
        {!isAdmin && <p className="mt-1 text-xs text-muted-foreground">Only admins can create rooms — ask one to add you.</p>}
        {rooms == null ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading rooms…</p>
        ) : rooms.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-muted-foreground">
            No rooms yet. Create one to start collaborating.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {rooms.map((room) => (
              <button key={room.id} type="button" onClick={() => onOpenRoom(room.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-4 text-left hover:bg-white/8">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 text-white">#</span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{room.name}</span>
                  <span className="block text-xs text-muted-foreground">{room.memberCount} member{room.memberCount === 1 ? '' : 's'}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

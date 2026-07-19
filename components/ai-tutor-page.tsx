'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import {
  BookOpenCheck,
  BrainCircuit,
  FileText,
  GraduationCap,
  Layers3,
  Lightbulb,
  LoaderCircle,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { AiMarkdown } from '@/components/ai-markdown'
import { QuizCard } from '@/components/study/quiz-card'
import { FlashcardDeckPlayer } from '@/components/study/flashcard-deck-player'
import { Modal } from '@/components/ui/modal'
import { apiUrl, fetchWithRetry } from '@/lib/api-client'
import { DOCUMENT_ACCEPT, readDocument } from '@/lib/documents/client'
import { TUTOR_MODES, type TutorAction, type TutorHistoryMessage, type TutorMode } from '@/lib/ai/tutor-types'
import { loadFlashcardDecks, parseFlashcardDeck, parseQuiz, saveFlashcardDeck, type FlashcardDeck, type Quiz } from '@/lib/ai/study-artifacts'
import { cn } from '@/lib/utils'

type TutorMessage = TutorHistoryMessage & {
  id: string
  createdAt: string
}

type AiTutorPageProps = {
  activeTab: 'tutor' | 'flashcards'
  onNavigate: (section: string) => void
  notify: (message: string, tone?: 'success' | 'info' | 'warning') => void
}

const MAX_TUTOR_HISTORY = 16
const MAX_FLASHCARD_NOTES = 10_000

const modeLabels: Record<TutorMode, { label: string; detail: string }> = {
  auto: { label: 'Auto', detail: 'Adjusts from your answers' },
  beginner: { label: 'Beginner', detail: 'Foundations and guided steps' },
  intermediate: { label: 'Intermediate', detail: 'Apply ideas with support' },
  advanced: { label: 'Advanced', detail: 'Deeper reasoning and challenge' },
}

const starterMessage: TutorMessage = {
  id: 'tutor-welcome',
  role: 'assistant',
  content: 'Tell me what you are learning. I’ll teach it step by step, check your understanding, and adjust the difficulty from your answers.',
  createdAt: new Date(0).toISOString(),
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function AiTutorPage({ activeTab, onNavigate, notify }: AiTutorPageProps) {
  const [mode, setMode] = useState<TutorMode>('auto')
  const [messages, setMessages] = useState<TutorMessage[]>([starterMessage])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingAnswer, setAwaitingAnswer] = useState(false)
  const [tutorError, setTutorError] = useState('')

  const [practiceTestOpen, setPracticeTestOpen] = useState(false)
  const [practiceTestLoading, setPracticeTestLoading] = useState(false)
  const [practiceTestError, setPracticeTestError] = useState('')
  const [practiceTestQuiz, setPracticeTestQuiz] = useState<Quiz | null>(null)
  const [practiceTestTopic, setPracticeTestTopic] = useState('')

  const [notes, setNotes] = useState('')
  const [cardCount, setCardCount] = useState(10)
  const [deckHistory, setDeckHistory] = useState<FlashcardDeck[]>(() => loadFlashcardDecks())
  const [activeDeckId, setActiveDeckId] = useState<string | null>(() => loadFlashcardDecks()[0]?.id ?? null)
  const deck = deckHistory.find((item) => item.id === activeDeckId) ?? null
  const [generatingCards, setGeneratingCards] = useState(false)
  const [flashcardError, setFlashcardError] = useState('')
  const [sourceName, setSourceName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tutorMessagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    tutorMessagesEndRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' })
  }, [messages, loading])

  const sendTutorMessage = async (text: string, requestedAction: TutorAction = 'teach') => {
    const content = text.trim()
    if (!content || loading) return
    const action: TutorAction = awaitingAnswer && requestedAction === 'teach' ? 'feedback' : requestedAction
    const userMessage: TutorMessage = { id: createId('student'), role: 'user', content, createdAt: new Date().toISOString() }
    const history = messages
      .filter((message) => message.id !== 'tutor-welcome')
      .slice(-MAX_TUTOR_HISTORY)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }))

    setMessages((current) => [...current, userMessage])
    setDraft('')
    setLoading(true)
    setTutorError('')
    try {
      const response = await fetchWithRetry(apiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, mode, action, purpose: 'tutoring', history, documents: [], isPlus: true }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'The tutor could not respond')
      setMessages((current) => [...current, {
        id: createId('tutor'),
        role: 'assistant',
        content: data.reply as string,
        createdAt: new Date().toISOString(),
      }])
      setAwaitingAnswer(action === 'practice')
    } catch (error) {
      setTutorError(error instanceof Error ? error.message : 'The tutor could not respond')
    } finally {
      setLoading(false)
    }
  }

  const runLessonAction = (action: TutorAction) => {
    const prompts: Record<'hint' | 'practice', string> = {
      hint: 'Give me the next useful hint for the problem or topic we are currently working on. Do not reveal the complete answer yet.',
      practice: 'Give me one practice question at the right difficulty based on this lesson. Wait for my answer before giving feedback.',
    }
    if (action === 'hint' || action === 'practice') void sendTutorMessage(prompts[action], action)
  }

  const hasLessonContext = messages.some((message) => message.role === 'user')

  const generatePracticeTest = async (topic?: string) => {
    setPracticeTestLoading(true)
    setPracticeTestError('')
    const history = messages
      .filter((message) => message.id !== 'tutor-welcome')
      .slice(-MAX_TUTOR_HISTORY)
      .map(({ role, content }) => ({ role, content }))
    const promptText = topic ? `Create a short practice test on: ${topic}` : 'Create a short practice test based on this lesson so far.'

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: promptText, mode, action: 'quiz', purpose: 'tutoring', history, documents: [], isPlus: true }),
        })
        const data = await response.json() as { reply?: string; error?: string }
        if (!response.ok || !data.reply) throw new Error(data.error || 'Could not generate a practice test')
        const quiz = parseQuiz(data.reply)
        if (quiz) {
          setPracticeTestQuiz(quiz)
          setPracticeTestLoading(false)
          return
        }
        if (attempt === 1) throw new Error('AirGPT could not build a valid practice test. Try again.')
      } catch (error) {
        if (attempt === 1) {
          setPracticeTestError(error instanceof Error ? error.message : 'Could not generate a practice test')
          setPracticeTestLoading(false)
          return
        }
      }
    }
  }

  const openPracticeTest = () => {
    setPracticeTestOpen(true)
    setPracticeTestQuiz(null)
    setPracticeTestError('')
    setPracticeTestTopic('')
    if (hasLessonContext) void generatePracticeTest()
  }

  const handleTutorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendTutorMessage(draft)
    }
  }

  const attachNotes = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSourceName(file.name)
    setFlashcardError('')
    try {
      const document = await readDocument(file, createId('flashcard-source'))
      setNotes((current) => `${current}${current ? '\n\n' : ''}${document.text}`.slice(0, MAX_FLASHCARD_NOTES))
      notify(`${file.name} is ready for flashcards`, 'success')
    } catch (error) {
      setFlashcardError(error instanceof Error ? error.message : 'AirNexus could not read this file')
    }
  }

  const generateFlashcards = async () => {
    const material = notes.trim()
    if (material.length < 40 || generatingCards) {
      if (material.length < 40) setFlashcardError('Add at least a short paragraph of notes before generating cards.')
      return
    }
    setGeneratingCards(true)
    setFlashcardError('')
    try {
      const response = await fetchWithRetry(apiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Create ${cardCount} high-quality active-recall flashcards from these notes. Cover the most important ideas without adding facts that are not present.\n\n${material.slice(0, MAX_FLASHCARD_NOTES)}`,
          mode: 'auto',
          action: 'flashcards',
          history: [],
          documents: [],
          isPlus: true,
        }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Flashcard generation failed')
      const generated = parseFlashcardDeck(data.reply)
      if (!generated) throw new Error('AirGPT returned an invalid flashcard deck')
      setDeckHistory(saveFlashcardDeck(generated))
      setActiveDeckId(generated.id)
      notify(`Created ${generated.cards.length} flashcards`, 'success')
    } catch (error) {
      setFlashcardError(error instanceof Error ? error.message : 'Flashcard generation failed')
    } finally {
      setGeneratingCards(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">Adaptive learning studio</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">{activeTab === 'tutor' ? 'AI Tutor' : 'AI Flashcards'}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{activeTab === 'tutor' ? 'A teacher that checks understanding, gives hints, adapts difficulty, and finishes each lesson with a recap.' : 'Turn notes or files into active-recall cards, then review difficult ideas until they stick.'}</p>
        </div>
        <div className="flex rounded-2xl border border-white/8 bg-white/[0.035] p-1">
          <button type="button" onClick={() => onNavigate('AI Tutor')} className={cn('rounded-xl px-4 py-2 text-sm font-medium transition', activeTab === 'tutor' ? 'bg-white text-black' : 'text-slate-400 hover:text-white')}><GraduationCap className="mr-2 inline size-4" />Tutor</button>
          <button type="button" onClick={() => onNavigate('Flashcards')} className={cn('rounded-xl px-4 py-2 text-sm font-medium transition', activeTab === 'flashcards' ? 'bg-white text-black' : 'text-slate-400 hover:text-white')}><Layers3 className="mr-2 inline size-4" />Flashcards</button>
        </div>
      </div>

      {activeTab === 'tutor' ? (
        // Fixed (not min-) height: this is a chat panel — the message list
        // needs a bounded box so its own overflow-y-auto can scroll
        // internally. A min-height never constrains a growing flex child,
        // so with min-h the whole panel just grew taller on every message
        // instead of scrolling, pushing the composer down the page.
        <div className="grid h-[min(680px,calc(100dvh-220px))] min-h-[420px] gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="glass rounded-3xl p-4">
              <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"><BrainCircuit className="size-5" /></span><div><p className="text-sm font-semibold">Difficulty</p><p className="text-[10px] text-slate-500">Change anytime</p></div></div>
              <div className="mt-4 space-y-2">
                {TUTOR_MODES.map((candidate) => (
                  <button key={candidate} type="button" aria-pressed={mode === candidate} onClick={() => setMode(candidate)} className={cn('w-full rounded-2xl border p-3 text-left transition', mode === candidate ? 'border-white/25 bg-white/10' : 'border-white/7 bg-white/[0.025] hover:bg-white/[0.055]')}>
                    <p className="text-sm font-medium text-white">{modeLabels[candidate].label}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{modeLabels[candidate].detail}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="glass rounded-3xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson tools</p>
              <div className="mt-3 grid gap-2">
                <button type="button" disabled={loading} onClick={() => runLessonAction('hint')} className="secondary-action justify-start"><Lightbulb className="size-4" />Give me a hint</button>
                <button type="button" disabled={loading} onClick={() => runLessonAction('practice')} className="secondary-action justify-start"><Target className="size-4" />Quick check</button>
                <button type="button" disabled={practiceTestLoading} onClick={openPracticeTest} className="secondary-action justify-start"><BookOpenCheck className="size-4" />Practice test</button>
              </div>
            </section>

            <div className="rounded-3xl border border-emerald-300/15 bg-emerald-400/[0.055] p-4 text-xs leading-5 text-emerald-100">
              <p className="font-semibold">Teacher mode is active</p>
              <p className="mt-1 text-emerald-100/65">AirGPT uses your answers to detect confusion and automatically move the difficulty up or down.</p>
            </div>
          </aside>

          <section className="glass flex min-h-0 flex-col overflow-hidden rounded-3xl" aria-label="Adaptive tutor lesson">
            <div className="flex items-center justify-between border-b border-white/7 px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"><GraduationCap className="size-5" /></span><div><p className="text-sm font-semibold">AirGPT Teacher</p><p className="text-[10px] text-emerald-300">{modeLabels[mode].label} mode · ready</p></div></div>{awaitingAnswer && <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white">Waiting for your answer</span>}</div>
            <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              {messages.map((message) => (
                <article key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[88%] rounded-3xl px-5 py-4 text-sm leading-7', message.role === 'user' ? 'message-self rounded-br-lg text-white' : 'border border-white/8 bg-white/[0.045] text-slate-200')}>
                    {message.role === 'assistant' ? <AiMarkdown>{message.content}</AiMarkdown> : <p className="whitespace-pre-wrap">{message.content}</p>}
                  </div>
                </article>
              ))}
              {loading && <div className="flex items-center gap-3 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin text-zinc-300" />Your tutor is planning the next teaching step…</div>}
              <div ref={tutorMessagesEndRef} />
            </div>
            <div className="border-t border-white/7 p-4 sm:p-5">
              {tutorError && <p role="alert" className="mb-3 rounded-xl border border-rose-300/15 bg-rose-400/[0.06] p-3 text-xs text-rose-200">{tutorError}</p>}
              <div className="glass-input flex items-end gap-2 rounded-2xl px-3 py-3"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleTutorKeyDown} rows={2} placeholder={awaitingAnswer ? 'Type your answer for instant feedback…' : 'What would you like to learn?'} aria-label="Tutor message" className="max-h-32 min-h-12 min-w-0 flex-1 resize-none bg-transparent px-1 text-sm outline-none" /><button type="button" onClick={() => void sendTutorMessage(draft)} disabled={loading || !draft.trim()} aria-label="Send tutor message" className="send-button mb-1"><Send className="size-4" /></button></div>
              <p className="mt-2 text-center text-[10px] text-slate-600">Enter to send · The tutor gives feedback before moving on</p>
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="glass rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Source notes</p><h3 className="mt-1 text-xl font-semibold">Build a study deck</h3></div><span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white"><Layers3 className="size-5" /></span></div>
            <p className="mt-2 text-sm leading-6 text-slate-400">Paste notes or attach a document. AirGPT will extract the concepts that are worth actively recalling.</p>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, MAX_FLASHCARD_NOTES))} rows={13} placeholder="Paste class notes, a chapter summary, key definitions, or revision material…" aria-label="Flashcard source notes" className="mt-5 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 outline-none transition placeholder:text-slate-600 focus:border-white/35" />
            <div className="mt-3 flex flex-wrap items-center gap-2"><input ref={fileInputRef} type="file" accept={DOCUMENT_ACCEPT} onChange={attachNotes} className="sr-only" /><button type="button" onClick={() => fileInputRef.current?.click()} className="secondary-action"><Paperclip className="size-4" />Attach notes</button>{sourceName && <span className="inline-flex items-center gap-1 rounded-full bg-white/7 px-3 py-1.5 text-xs text-slate-300"><FileText className="size-3" />{sourceName}<button type="button" onClick={() => setSourceName('')} aria-label="Clear attached file label"><X className="size-3" /></button></span>}</div>
            <label className="mt-5 block text-xs text-slate-400">Number of cards<select value={cardCount} onChange={(event) => setCardCount(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none"><option value={8}>8 focused cards</option><option value={10}>10 balanced cards</option><option value={16}>16 detailed cards</option><option value={25}>25 cards</option><option value={35}>35 cards</option><option value={50}>50 cards — full deck</option></select></label>
            {flashcardError && <p role="alert" className="mt-4 rounded-xl border border-rose-300/15 bg-rose-400/[0.06] p-3 text-xs text-rose-200">{flashcardError}</p>}
            <button type="button" onClick={() => void generateFlashcards()} disabled={generatingCards || notes.trim().length < 40} className="primary-action mt-5 w-full">{generatingCards ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generatingCards ? 'Creating your deck…' : 'Generate flashcards'}</button>
          </section>

          <section className="glass min-h-[650px] rounded-3xl p-5 sm:p-6" aria-label="Flashcard study area">
            {deckHistory.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {deckHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveDeckId(item.id)}
                    className={cn(
                      'max-w-[12rem] truncate rounded-full border px-3 py-1 text-xs font-medium transition',
                      item.id === activeDeckId ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
                    )}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            )}
            {!deck ? (
              <div className="flex min-h-[580px] flex-col items-center justify-center text-center"><span className="flex size-16 items-center justify-center rounded-3xl bg-white/10 text-white"><BrainCircuit className="size-8" /></span><h3 className="mt-5 text-xl font-semibold">Your active-recall deck appears here</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Generate cards from your own notes, reveal each answer, then rate how well you remembered it.</p></div>
            ) : (
              <FlashcardDeckPlayer deck={deck} key={deck.createdAt} />
            )}
          </section>
        </div>
      )}

      <Modal
        open={practiceTestOpen}
        title="Practice test"
        description="A short graded test AirGPT builds from your lesson."
        onClose={() => setPracticeTestOpen(false)}
        className="max-w-2xl"
      >
        {practiceTestLoading ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <LoaderCircle className="size-6 animate-spin text-zinc-300" />
            <p className="text-sm text-slate-400">Building your test…</p>
          </div>
        ) : practiceTestError ? (
          <div className="py-6 text-center">
            <p className="text-sm text-rose-300">{practiceTestError}</p>
            <button type="button" onClick={() => void generatePracticeTest(practiceTestTopic || undefined)} className="primary-action mx-auto mt-4">
              Try again
            </button>
          </div>
        ) : practiceTestQuiz ? (
          <div className="space-y-4">
            <QuizCard quiz={practiceTestQuiz} />
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={practiceTestTopic}
                onChange={(event) => setPracticeTestTopic(event.target.value)}
                placeholder="Test me on something specific…"
                aria-label="Practice test topic"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-white/30"
              />
              <button type="button" onClick={() => void generatePracticeTest(practiceTestTopic || undefined)} className="secondary-action shrink-0">
                <RefreshCw className="size-4" />New test
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">What would you like to be tested on?</p>
            <input
              autoFocus
              value={practiceTestTopic}
              onChange={(event) => setPracticeTestTopic(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && practiceTestTopic.trim()) void generatePracticeTest(practiceTestTopic) }}
              placeholder="e.g. Photosynthesis, quadratic equations, World War I causes…"
              aria-label="Practice test topic"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-white/30"
            />
            <button type="button" disabled={!practiceTestTopic.trim()} onClick={() => void generatePracticeTest(practiceTestTopic)} className="primary-action w-full disabled:cursor-not-allowed disabled:opacity-40">
              <BookOpenCheck className="size-4" />Generate test
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

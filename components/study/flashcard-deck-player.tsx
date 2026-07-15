'use client'

import { useState } from 'react'
import { ArrowLeft, Check, CircleHelp, Lightbulb, RefreshCw, RotateCcw, Target, Trophy } from 'lucide-react'
import type { FlashcardDeck } from '@/lib/ai/study-artifacts'
import { cn } from '@/lib/utils'

type FlashcardDeckPlayerProps = {
  deck: FlashcardDeck
  /** Smaller card + tighter spacing for embedding inline in a chat message, vs. the full-height Tutor page layout. */
  compact?: boolean
}

/**
 * The tap-to-flip, rate-your-recall review experience — shared by the AI
 * Tutor's Flashcards tab and the inline deck rendered directly in AI Chat.
 * Owns its own queue/flip/rating state so either caller can mount it with
 * nothing more than a deck.
 */
export function FlashcardDeckPlayer({ deck, compact = false }: FlashcardDeckPlayerProps) {
  const [queue, setQueue] = useState<number[]>(() => deck.cards.map((_, index) => index))
  const [flipped, setFlipped] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [ratings, setRatings] = useState<Record<number, number>>({})

  const rateCard = (score: number) => {
    const currentIndex = queue[0]
    if (currentIndex === undefined) return
    setRatings((current) => ({ ...current, [currentIndex]: Math.max(current[currentIndex] ?? 0, score) }))
    const remaining = queue.slice(1)
    if (score === 0 && remaining.length > 0) remaining.push(currentIndex)
    setQueue(remaining)
    setFlipped(false)
    setShowHint(false)
  }

  const restartDeck = (missedOnly: boolean) => {
    const nextQueue = deck.cards.map((_, index) => index).filter((index) => !missedOnly || (ratings[index] ?? 0) < 2)
    setQueue(nextQueue.length ? nextQueue : deck.cards.map((_, index) => index))
    setFlipped(false)
    setShowHint(false)
  }

  const currentCardIndex = queue[0]
  const currentCard = currentCardIndex !== undefined ? deck.cards[currentCardIndex] : null
  const mastered = deck.cards.filter((_, index) => (ratings[index] ?? 0) >= 2).length

  return (
    <div className={compact ? 'flex flex-col' : 'flex min-h-[580px] flex-col'}>
      {currentCard ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{deck.title}</p>
              <p className="mt-1 text-sm text-slate-500">{mastered}/{deck.cards.length} mastered · {queue.length} in this round</p>
            </div>
            <button type="button" onClick={() => restartDeck(false)} aria-label="Restart flashcard deck" className="interactive-icon"><RefreshCw className="size-4" /></button>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/7">
            <div className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-white transition-all" style={{ width: `${(mastered / deck.cards.length) * 100}%` }} />
          </div>
          <button
            type="button"
            onClick={() => setFlipped((current) => !current)}
            aria-label="Flip flashcard"
            className={cn(
              'group mt-6 flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-white/15 bg-[radial-gradient(circle_at_top,rgba(255,255,255,.08),transparent_55%),rgba(255,255,255,.035)] p-6 text-center shadow-2xl transition hover:border-white/30',
              compact ? 'min-h-56' : 'min-h-80 p-8',
            )}
          >
            <span className="rounded-full bg-white/7 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{flipped ? 'Answer' : 'Question'} · {currentCard.difficulty}</span>
            <p className={cn('mt-5 max-w-2xl text-white', flipped ? 'text-lg leading-7' : 'text-xl font-semibold leading-8')}>{flipped ? currentCard.back : currentCard.front}</p>
            {!flipped && showHint && currentCard.hint && <p className="mt-4 rounded-2xl bg-white/8 px-4 py-3 text-sm leading-6 text-white">Hint: {currentCard.hint}</p>}
            <span className="mt-6 inline-flex items-center gap-2 text-xs text-slate-500"><RotateCcw className="size-3.5 transition group-hover:rotate-180" />Tap to {flipped ? 'see the question' : 'reveal the answer'}</span>
          </button>
          {!flipped ? (
            <button type="button" onClick={() => setShowHint((current) => !current)} disabled={!currentCard.hint} className="secondary-action mx-auto mt-4">
              <Lightbulb className="size-4" />{showHint ? 'Hide hint' : 'Show hint'}
            </button>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => rateCard(0)} className="rounded-xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-400/10"><RotateCcw className="mr-2 inline size-4" />Again</button>
              <button type="button" onClick={() => rateCard(1)} className="rounded-xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-400/10"><CircleHelp className="mr-2 inline size-4" />Learning</button>
              <button type="button" onClick={() => rateCard(2)} className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/10"><Check className="mr-2 inline size-4" />Know it</button>
            </div>
          )}
        </>
      ) : (
        <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'min-h-56' : 'min-h-[580px]')}>
          <span className="flex size-14 items-center justify-center rounded-3xl bg-emerald-400/10 text-emerald-200"><Trophy className="size-7" /></span>
          <h3 className="mt-4 text-xl font-semibold">Round complete</h3>
          <p className="mt-2 text-sm text-slate-400">You mastered {mastered} of {deck.cards.length} cards in this session.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => restartDeck(true)} className="primary-action"><Target className="size-4" />Review weak cards</button>
            <button type="button" onClick={() => restartDeck(false)} className="secondary-action"><ArrowLeft className="size-4" />Study all again</button>
          </div>
        </div>
      )}
    </div>
  )
}

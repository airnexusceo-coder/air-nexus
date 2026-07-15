'use client'

import { Layers3 } from 'lucide-react'
import { FlashcardDeckPlayer } from '@/components/study/flashcard-deck-player'
import type { FlashcardDeck } from '@/lib/ai/study-artifacts'

type FlashcardPreviewCardProps = {
  deck: FlashcardDeck
  onOpenDeck: () => void
}

/** Renders the deck directly playable in the chat message — flip, rate, and track progress without leaving the conversation — with a shortcut into the full Tutor-page Flashcards tab for anyone who wants the larger layout. */
export function FlashcardPreviewCard({ deck, onOpenDeck }: FlashcardPreviewCardProps) {
  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white"><Layers3 className="size-5" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Flashcard deck</p>
            <p className="text-xs text-slate-500">{deck.cards.length} cards</p>
          </div>
        </div>
        <button type="button" onClick={onOpenDeck} className="secondary-action shrink-0 text-xs">
          Open full view
        </button>
      </div>

      <div className="mt-4">
        <FlashcardDeckPlayer deck={deck} compact />
      </div>
    </div>
  )
}

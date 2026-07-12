'use client'

import { Layers3 } from 'lucide-react'
import type { FlashcardDeck } from '@/lib/ai/study-artifacts'

type FlashcardPreviewCardProps = {
  deck: FlashcardDeck
  onOpenDeck: () => void
}

export function FlashcardPreviewCard({ deck, onOpenDeck }: FlashcardPreviewCardProps) {
  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white"><Layers3 className="size-5" /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Flashcard deck</p>
          <h3 className="text-lg font-semibold text-white">{deck.title}</h3>
          <p className="text-xs text-slate-500">{deck.cards.length} cards</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {deck.cards.slice(0, 4).map((card) => (
          <div key={card.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="truncate text-xs font-medium text-white">{card.front}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{card.difficulty}</p>
          </div>
        ))}
      </div>
      {deck.cards.length > 4 && <p className="mt-2 text-xs text-slate-500">+{deck.cards.length - 4} more</p>}

      <button type="button" onClick={onOpenDeck} className="primary-action mt-4 w-full">
        <Layers3 className="size-4" />Study these flashcards
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { BookOpen, LifeBuoy, X } from 'lucide-react'
import { GLOSSARY_TERMS } from '@/lib/market-masters/glossary'
import type { MarketMastersView } from '@/components/market-masters/nav-items'

const PAGE_TIPS: Partial<Record<MarketMastersView, string>> = {
  dashboard: 'Your dashboard separates cash you can spend from the value of shares you own — they only combine into "portfolio value," never into spendable cash, until you actually sell.',
  market: 'Search, sort, and filter companies here. Tap a card to see its full price history and news, or the star to add it to your Watchlist.',
  portfolio: 'The Cash History section is a complete record of every reason your cash balance has ever changed — nothing happens off the books.',
  watchlist: 'Star companies from the Market to track them here without spending any cash.',
  news: 'Some headlines are written to sound more dramatic than the news actually is. Practice spotting them with the flag button.',
  learn: 'Short lessons with quizzes. Completing one earns XP and sometimes bonus cash — no minimum score required.',
  missions: 'Missions reward good investing habits — like diversifying — not just high returns.',
  achievements: 'Badges track milestones over the life of this game. They never affect your cash.',
  settings: 'You can change difficulty, learning support, and simulation speed here at any time without resetting your progress.',
}

type TeachingHelpButtonProps = {
  view: MarketMastersView
  onOpenGlossary: () => void
  onOpenLearningCentre: () => void
  onOpenTutorial: () => void
}

/** A help entry point reachable from every page without leaving the current activity — opens a lightweight panel instead of navigating away. */
export function TeachingHelpButton({ view, onOpenGlossary, onOpenLearningCentre, onOpenTutorial }: TeachingHelpButtonProps) {
  const [open, setOpen] = useState(false)
  const tip = PAGE_TIPS[view]
  const randomTerm = GLOSSARY_TERMS[Math.floor((view.length * 7) % GLOSSARY_TERMS.length)]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open teaching help"
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/95 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl backdrop-blur transition hover:bg-slate-800 lg:bottom-6"
      >
        <LifeBuoy className="size-4 text-cyan-300" aria-hidden="true" />
        Teaching Help
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/60 p-4 sm:items-center" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Teaching help"
            onClick={(event) => event.stopPropagation()}
            className="glass-strong w-full max-w-sm rounded-3xl border border-white/15 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><LifeBuoy className="size-4 text-cyan-300" aria-hidden="true" />Teaching Help</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close teaching help" className="interactive-icon"><X className="size-4" /></button>
            </div>

            {tip && (
              <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.06] p-3 text-xs leading-5 text-cyan-100">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200">On this page</p>
                <p className="mt-1">{tip}</p>
              </div>
            )}

            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-300">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Term of the moment</p>
              <p className="mt-1"><span className="font-semibold text-white">{randomTerm.term}:</span> {randomTerm.definition}</p>
            </div>

            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => { setOpen(false); onOpenGlossary() }} className="secondary-action justify-start">
                <BookOpen className="size-4" />Open the full glossary
              </button>
              <button type="button" onClick={() => { setOpen(false); onOpenLearningCentre() }} className="secondary-action justify-start">
                <BookOpen className="size-4" />Go to the Learning Centre
              </button>
              <button type="button" onClick={() => { setOpen(false); onOpenTutorial() }} className="secondary-action justify-start">
                <LifeBuoy className="size-4" />Replay the how-to-play guide
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

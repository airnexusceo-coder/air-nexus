'use client'

import { useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { findGlossaryEntry } from '@/lib/business-empire/glossary'

type InfoTipProps = {
  term: string
  /** Optional override — otherwise looked up from the shared glossary by exact term match. */
  definition?: string
}

/** An inline "what does this mean?" control for business jargon. Click/tap and keyboard-focus triggered — never hover-only — so touch and keyboard users get the same explanation a mouse user would. */
export function InfoTip({ term, definition }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const resolved = definition ?? findGlossaryEntry(term)?.definition
  if (!resolved) return null

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={`What does "${term}" mean?`}
        className="inline-flex size-4 items-center justify-center rounded-full text-slate-500 transition hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
      >
        <CircleHelp className="size-3.5" />
      </button>
      {open && (
        <span role="tooltip" className="absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-xl border border-amber-300/20 bg-slate-950/95 p-3 text-left text-xs leading-5 text-slate-200 shadow-2xl">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-amber-200">{term}</span>
          <span className="mt-1 block text-slate-300">{resolved}</span>
        </span>
      )}
    </span>
  )
}

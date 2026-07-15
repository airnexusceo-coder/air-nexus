'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { GLOSSARY_TERMS } from '@/lib/market-masters/glossary'

type TermTooltipProps = {
  term: string
  /** Optional override — otherwise looked up from the shared glossary by exact term match. */
  definition?: string
}

/**
 * An inline "what does this mean?" button for jargon. Deliberately click/tap
 * and keyboard-focus triggered, not hover-only, so touch and keyboard users
 * get the same explanation a mouse user would.
 */
export function TermTooltip({ term, definition }: TermTooltipProps) {
  const [open, setOpen] = useState(false)
  const resolvedDefinition = definition ?? GLOSSARY_TERMS.find((entry) => entry.term.toLowerCase() === term.toLowerCase())?.definition

  if (!resolvedDefinition) return null

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={`What does "${term}" mean?`}
        className="inline-flex size-4 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <Info className="size-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-xl border border-white/15 bg-slate-950/95 p-3 text-left text-xs leading-5 text-slate-200 shadow-2xl"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-white">{term}</span>
          <span className="mt-1 block text-slate-300">{resolvedDefinition}</span>
        </span>
      )}
    </span>
  )
}

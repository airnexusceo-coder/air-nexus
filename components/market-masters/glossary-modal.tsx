'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { GLOSSARY_TERMS } from '@/lib/market-masters/glossary'

type GlossaryModalProps = {
  open: boolean
  onClose: () => void
}

export function GlossaryModal({ open, onClose }: GlossaryModalProps) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = GLOSSARY_TERMS.filter((entry) => q.length === 0 || entry.term.toLowerCase().includes(q) || entry.definition.toLowerCase().includes(q))

  return (
    <Modal open={open} title="Investing Glossary" description="Plain-language definitions for terms used throughout Market Masters." onClose={onClose} className="max-w-xl">
      <div className="glass-input mb-4 flex items-center gap-2 rounded-xl px-3 py-2">
        <Search className="size-4 shrink-0 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search terms..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
        />
      </div>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {filtered.length === 0 && <p className="text-center text-sm text-slate-500">No terms match your search.</p>}
        {filtered.map((entry) => (
          <div key={entry.term} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-semibold text-white">{entry.term}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{entry.definition}</p>
          </div>
        ))}
      </div>
    </Modal>
  )
}

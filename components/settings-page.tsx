'use client'

import { useState } from 'react'
import { Check, Type } from 'lucide-react'
import { applyFontPreference, FONT_CHOICES, FONT_PREFERENCE_STORAGE_KEY, isFontOption, type FontOption } from '@/lib/font-preference'
import { cn } from '@/lib/utils'

function loadStoredFontPreference(): FontOption {
  if (typeof window === 'undefined') return 'geist'
  const stored = window.localStorage.getItem(FONT_PREFERENCE_STORAGE_KEY)
  return isFontOption(stored) ? stored : 'geist'
}

export function SettingsPage() {
  const [selected, setSelected] = useState<FontOption>(loadStoredFontPreference)

  const choose = (option: FontOption) => {
    setSelected(option)
    window.localStorage.setItem(FONT_PREFERENCE_STORAGE_KEY, option)
    applyFontPreference(option)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300/80">Appearance</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Settings</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Choose the interface font AirNexus uses everywhere — takes effect immediately.</p>
      </div>

      <section className="glass rounded-2xl p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Type className="size-4 text-white/70" />Interface font
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FONT_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={selected === choice.id}
              onClick={() => choose(choice.id)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition',
                selected === choice.id ? 'border-white/30 bg-white/10' : 'border-white/8 bg-white/[0.025] hover:bg-white/[0.05]',
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  {choice.label}
                  {choice.id === 'geist' && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">Recommended</span>
                  )}
                </span>
                {selected === choice.id && <Check className="size-4 shrink-0 text-white" />}
              </div>
              <p className="text-xs leading-5 text-slate-500">{choice.description}</p>
              <p className="mt-1 text-lg text-white" style={{ fontFamily: choice.stack }}>The quick brown fox jumps.</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

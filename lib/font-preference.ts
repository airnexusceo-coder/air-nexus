export const FONT_PREFERENCE_STORAGE_KEY = 'airnexus-font-preference'

export type FontOption = 'geist' | 'inter' | 'lora' | 'system'

/**
 * Anthropic's actual Claude.ai interface font is a proprietary, commercially
 * licensed typeface — it can't be sourced or embedded here. Geist is the
 * closest freely-licensed match (a clean modern grotesque in the same
 * visual family) and stays the default; the others are real alternatives,
 * not filler.
 */
export const FONT_CHOICES: Array<{ id: FontOption; label: string; description: string; stack: string }> = [
  {
    id: 'geist',
    label: 'Geist',
    description: "The closest available match to Claude's own interface font — Anthropic's actual typeface is proprietary and can't be embedded here.",
    stack: 'var(--font-geist-sans), ui-sans-serif, sans-serif',
  },
  {
    id: 'inter',
    label: 'Inter',
    description: 'A clean, widely-used interface font.',
    stack: 'var(--font-inter), ui-sans-serif, sans-serif',
  },
  {
    id: 'lora',
    label: 'Lora',
    description: 'A gentle serif, easier on the eyes for long reading.',
    stack: 'var(--font-lora), ui-serif, serif',
  },
  {
    id: 'system',
    label: 'System default',
    description: "Your device's own default interface font.",
    stack: 'ui-sans-serif, system-ui, sans-serif',
  },
]

export function isFontOption(value: unknown): value is FontOption {
  return typeof value === 'string' && FONT_CHOICES.some((choice) => choice.id === value)
}

export function applyFontPreference(option: FontOption) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-font', option)
}

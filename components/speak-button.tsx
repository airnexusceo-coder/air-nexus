'use client'

import { useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { cancelOrpheusSpeech, isSpeechCancellation, speakWithOrpheus } from '@/lib/voice/orpheus'
import { cn } from '@/lib/utils'

type SpeakButtonProps = {
  text: string
  onError: (message: string) => void
  className?: string
}

export function SpeakButton({ text, onError, className }: SpeakButtonProps) {
  const [active, setActive] = useState(false)

  const toggleSpeech = async () => {
    if (active) {
      cancelOrpheusSpeech()
      setActive(false)
      return
    }
    if (!text.trim()) return

    setActive(true)
    try {
      await speakWithOrpheus(text)
    } catch (error) {
      if (!isSpeechCancellation(error)) {
        onError(error instanceof Error ? error.message : 'Orpheus speech playback failed.')
      }
    } finally {
      setActive(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggleSpeech()}
      aria-label={active ? 'Stop AI speech' : 'Speak AI response with Orpheus'}
      aria-pressed={active}
      title={active ? 'Stop speech' : 'Speak with Orpheus'}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/8 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/50',
        active && 'bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/30',
        className,
      )}
    >
      {active ? <Square className="size-3 fill-current" /> : <Volume2 className="size-3.5" />}
    </button>
  )
}

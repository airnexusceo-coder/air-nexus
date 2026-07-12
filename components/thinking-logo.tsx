'use client'

import { cn } from '@/lib/utils'
import { NexusLogo, NexusMark } from '@/components/brand/nexus-mark'

type ThinkingLogoProps = {
  isThinking: boolean
  className?: string
  /** @deprecated kept for backward compatibility with existing call sites; no longer used. */
  priority?: boolean
}

/**
 * The AirNexus brand mark with a busy state. Idle: the app-icon tile.
 * Thinking: the bare glyph inside a spinning progress ring — driven
 * purely by the `isThinking` flag so callers don't need changes.
 */
export function ThinkingLogo({ isThinking, className }: ThinkingLogoProps) {
  return (
    <span
      role={isThinking ? 'status' : 'img'}
      aria-label={isThinking ? 'AI is thinking' : 'AirNexus logo'}
      aria-live={isThinking ? 'polite' : undefined}
      className={cn('relative flex size-8 shrink-0 items-center justify-center', className)}
    >
      {isThinking ? (
        <>
          <span className="nexus-thinking-ring" aria-hidden="true" />
          <NexusMark className="size-[58%] text-white" />
        </>
      ) : (
        <NexusLogo className="size-full" />
      )}
    </span>
  )
}

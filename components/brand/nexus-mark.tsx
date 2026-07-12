import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * The AirNexus brand mark — an ascending peak with a single node beneath
 * it (the "nexus point"). Two forms:
 *
 * - NexusMark: the bare glyph in currentColor, for use on any surface.
 * - NexusLogo: the app-icon tile (white gradient rounded square, dark
 *   glyph), matching the app's white-on-black primary-action language.
 */

function PeakGlyph({ fill }: { fill: string }) {
  return (
    <>
      <path d="M24 5 L43.5 42 H35.5 L24 19.8 L12.5 42 H4.5 Z" fill={fill} />
      <circle cx="24" cy="36" r="4.2" fill={fill} />
    </>
  )
}

export function NexusMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-8 shrink-0', className)} aria-hidden="true" focusable="false">
      <PeakGlyph fill="currentColor" />
    </svg>
  )
}

export function NexusLogo({ className }: { className?: string }) {
  const gradientId = useId()
  return (
    <svg viewBox="0 0 48 48" className={cn('size-8 shrink-0', className)} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9c9ce" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="12" fill={`url(#${gradientId})`} />
      <g transform="translate(24 24.5) scale(0.66) translate(-24 -24)">
        <PeakGlyph fill="#101013" />
      </g>
    </svg>
  )
}

import Image from 'next/image'
import { cn } from '@/lib/utils'

type ThinkingLogoProps = {
  isThinking: boolean
  className?: string
  priority?: boolean
}

export function ThinkingLogo({
  isThinking,
  className,
  priority = false,
}: ThinkingLogoProps) {
  return (
    <span
      role={isThinking ? 'status' : 'img'}
      aria-label={isThinking ? 'AI is thinking' : 'AirGPT logo'}
      aria-live={isThinking ? 'polite' : undefined}
      className={cn(
        'relative block size-8 shrink-0 overflow-hidden bg-transparent',
        className,
      )}
    >
      <Image
        src="/airnexus-logo.png"
        alt=""
        aria-hidden="true"
        fill
        sizes="(min-width: 640px) 40px, 32px"
        priority={priority}
        draggable={false}
        className={cn(
          'select-none object-contain',
          isThinking && 'airnexus-thinking',
        )}
      />
    </span>
  )
}
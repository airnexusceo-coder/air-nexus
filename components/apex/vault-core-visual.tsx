import { NexusMark } from '@/components/brand/nexus-mark'
import { cn } from '@/lib/utils'

type VaultCoreVisualProps = {
  integrityPercent: number
  className?: string
}

const OUTER_RING = '120,10 190,45 220,115 190,185 120,220 50,185 20,115 50,45'
const MID_RING = '120,40 175,65 198,115 175,165 120,190 65,165 42,115 65,65'
const INNER_CORE = '120,68 158,85 174,115 158,145 120,162 82,145 66,115 82,85'
const OUTER_NODES = OUTER_RING.split(' ').map((pair) => pair.split(',').map(Number) as [number, number])
const SPOKE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

/** The Vault's geometric centerpiece — a wireframe octagon "core" with the AirNexus wolf mark standing over it. Pure monochrome (white/zinc), matching the app's glass design system; integrity below 40% dims the core and mutes the wolf to read as "at risk" without introducing a new accent color. */
export function VaultCoreVisual({ integrityPercent, className }: VaultCoreVisualProps) {
  const safeIntegrity = Number.isFinite(integrityPercent) ? Math.max(0, Math.min(100, integrityPercent)) : 100
  const critical = safeIntegrity < 40

  return (
    <div className={cn('relative mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center', className)}>
      <svg viewBox="0 0 240 240" className="size-full" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="vault-core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity={critical ? 0.14 : 0.28} />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="120" cy="120" r="115" fill="url(#vault-core-glow)" />
        {SPOKE_ANGLES.map((angle) => {
          const rad = (angle * Math.PI) / 180
          return (
            <line
              key={angle}
              x1={120 + Math.cos(rad) * 82}
              y1={120 + Math.sin(rad) * 82}
              x2={120 + Math.cos(rad) * 108}
              y2={120 + Math.sin(rad) * 108}
              stroke="white"
              strokeOpacity="0.14"
              strokeWidth="1"
            />
          )
        })}
        <polygon points={OUTER_RING} fill="none" stroke="white" strokeOpacity="0.16" strokeWidth="1.5" />
        <polygon points={MID_RING} fill="none" stroke="white" strokeOpacity="0.26" strokeWidth="1.5" />
        <polygon
          points={INNER_CORE}
          fill="white"
          fillOpacity={critical ? 0.04 : 0.08}
          stroke="white"
          strokeOpacity={critical ? 0.3 : 0.55}
          strokeWidth="1.5"
        />
        {OUTER_NODES.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" fill="white" fillOpacity="0.35" />
        ))}
      </svg>
      <NexusMark className={cn('pointer-events-none absolute size-16 text-white transition-opacity', critical ? 'opacity-35' : 'opacity-85')} />
    </div>
  )
}

'use client'

import { useState, type PointerEvent } from 'react'
import { BrainCircuit, CalendarClock, Eye, FileText, HelpCircle, Layers } from 'lucide-react'
import { NexusLogo } from './nexus-mark'
import { useReducedEffects } from './use-reduced-effects'

type Callout = {
  title: string
  description: string
  icon: typeof BrainCircuit
  top: string
  side: 'left' | 'right'
  offset: string
  dot: { x: number; y: number }
}

const CALLOUTS: Callout[] = [
  { title: 'AI Tutor', description: 'Get instant help and explanations', icon: BrainCircuit, top: '2%', side: 'left', offset: '0%', dot: { x: 26, y: 14 } },
  { title: 'Flashcards', description: 'Memorise and recall better', icon: Layers, top: '2%', side: 'right', offset: '0%', dot: { x: 74, y: 14 } },
  { title: 'Notes', description: 'Organise and summarise key concepts', icon: FileText, top: '42%', side: 'left', offset: '0%', dot: { x: 18, y: 50 } },
  { title: 'Quizzes', description: 'Test yourself and improve', icon: HelpCircle, top: '42%', side: 'right', offset: '0%', dot: { x: 82, y: 50 } },
  { title: 'Visualiser', description: 'See complex ideas come to life', icon: Eye, top: '80%', side: 'left', offset: '0%', dot: { x: 26, y: 86 } },
  { title: 'Exam Planner', description: 'Plan smarter. Stress less.', icon: CalendarClock, top: '80%', side: 'right', offset: '0%', dot: { x: 74, y: 86 } },
]

/**
 * Landing hero visual: the AirNexus mark at the centre of a dark field
 * with two slow orbital rings, and six always-visible feature callouts
 * connected to it by thin lines. Callouts only render on lg+ (six
 * absolutely-positioned labels don't fit a mobile viewport). Subtly
 * reacts to pointer movement on desktop only.
 */
export function BrandHeroVisual() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const reducedEffects = useReducedEffects()

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reducedEffects || event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const relX = (event.clientX - bounds.left) / bounds.width - 0.5
    const relY = (event.clientY - bounds.top) / bounds.height - 0.5
    setTilt({ x: relX * 10, y: relY * 8 })
  }

  function handlePointerLeave() {
    setTilt({ x: 0, y: 0 })
  }

  return (
    <div className="brand-hero" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      <div className="brand-hero__field" aria-hidden="true" />

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 hidden size-full lg:block" aria-hidden="true">
        {CALLOUTS.map((callout, index) => (
          <line
            key={callout.title}
            className="brand-hero__line"
            vectorEffect="non-scaling-stroke"
            x1={callout.dot.x}
            y1={callout.dot.y}
            x2={50}
            y2={48 + (index % 2 === 0 ? -4 : 4)}
          />
        ))}
      </svg>

      {CALLOUTS.map((callout) => {
        const Icon = callout.icon
        return (
          <div
            key={callout.title}
            className="brand-hero__callout hidden lg:flex"
            style={{ top: callout.top, [callout.side]: callout.offset }}
            data-side={callout.side}
          >
            <span className="brand-hero__callout-icon"><Icon className="size-4" /></span>
            <span>
              <span className="brand-hero__callout-title">{callout.title}</span>
              <span className="brand-hero__callout-desc">{callout.description}</span>
            </span>
          </div>
        )
      })}

      <div className="brand-hero__center" style={{ transform: `translate(${tilt.x}px, ${tilt.y}px)` }} aria-hidden="true">
        <div className="relative flex size-64 items-center justify-center sm:size-72">
          <svg viewBox="0 0 288 288" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            <g className="brand-hero__ring brand-hero__ring--outer">
              <circle className="brand-hero__orbit" cx="144" cy="144" r="136" />
              <circle className="brand-hero__orbit-node" cx="144" cy="8" r="3" />
            </g>
            <g className="brand-hero__ring brand-hero__ring--inner">
              <circle className="brand-hero__orbit" cx="144" cy="144" r="102" />
              <circle className="brand-hero__orbit-node" cx="42" cy="144" r="2.4" />
            </g>
          </svg>
          <span className="brand-hero__glow" />
          <NexusLogo className="relative size-28 drop-shadow-[0_18px_50px_rgba(0,0,0,0.6)] sm:size-32" />
        </div>
      </div>
    </div>
  )
}

'use client'

import type { AiLessonDiagram, AiLessonDiagramNode } from '@/lib/courses/lesson-pack-types'

/**
 * Renders an AI-authored AiLessonDiagram (flow/cycle/hierarchy/timeline/
 * comparison) as plain SVG — no charting/diagram library needed, following
 * the same "AI structured JSON -> validated -> typed component" pattern as
 * FunctionGraphCard, just for labelled-node diagrams instead of numeric plots.
 */

type DiagramViewProps = {
  diagram: AiLessonDiagram
}

const NODE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185', '#facc15', '#4ade80']
const WIDTH = 640
const HEIGHT = 260
const NODE_WIDTH = 132
const NODE_HEIGHT = 54

type PositionedNode = AiLessonDiagramNode & { x: number; y: number }

function spreadAlong(count: number, span: number, offset: number) {
  if (count <= 1) return [offset + span / 2]
  const gap = span / (count - 1)
  return Array.from({ length: count }, (_, index) => offset + index * gap)
}

function layoutFlowOrTimeline(nodes: AiLessonDiagramNode[]): PositionedNode[] {
  const xs = spreadAlong(nodes.length, WIDTH - NODE_WIDTH, 0)
  return nodes.map((node, index) => ({ ...node, x: xs[index], y: HEIGHT / 2 - NODE_HEIGHT / 2 }))
}

function layoutCycle(nodes: AiLessonDiagramNode[]): PositionedNode[] {
  const centerX = WIDTH / 2
  const centerY = HEIGHT / 2
  const radius = Math.min(WIDTH, HEIGHT) / 2 - NODE_WIDTH / 2 - 8
  return nodes.map((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2
    return { ...node, x: centerX + radius * Math.cos(angle) - NODE_WIDTH / 2, y: centerY + radius * Math.sin(angle) - NODE_HEIGHT / 2 }
  })
}

function layoutHierarchy(nodes: AiLessonDiagramNode[]): PositionedNode[] {
  if (nodes.length === 0) return []
  const [root, ...children] = nodes
  const positioned: PositionedNode[] = [{ ...root, x: WIDTH / 2 - NODE_WIDTH / 2, y: 6 }]
  const xs = spreadAlong(children.length, WIDTH - NODE_WIDTH, 0)
  children.forEach((child, index) => positioned.push({ ...child, x: xs[index], y: HEIGHT - NODE_HEIGHT - 6 }))
  return positioned
}

function layoutComparison(nodes: AiLessonDiagramNode[]): PositionedNode[] {
  const half = Math.ceil(nodes.length / 2)
  const left = nodes.slice(0, half)
  const right = nodes.slice(half)
  const leftYs = spreadAlong(left.length, HEIGHT - NODE_HEIGHT, 0)
  const rightYs = spreadAlong(right.length, HEIGHT - NODE_HEIGHT, 0)
  return [
    ...left.map((node, index) => ({ ...node, x: 16, y: leftYs[index] })),
    ...right.map((node, index) => ({ ...node, x: WIDTH - NODE_WIDTH - 16, y: rightYs[index] })),
  ]
}

function layoutNodes(diagram: AiLessonDiagram): PositionedNode[] {
  if (diagram.layout === 'cycle') return layoutCycle(diagram.nodes)
  if (diagram.layout === 'hierarchy') return layoutHierarchy(diagram.nodes)
  if (diagram.layout === 'comparison') return layoutComparison(diagram.nodes)
  return layoutFlowOrTimeline(diagram.nodes)
}

export function DiagramView({ diagram }: DiagramViewProps) {
  const positioned = layoutNodes(diagram)
  const byId = new Map(positioned.map((node) => [node.id, node]))
  const notes = positioned.filter((node) => node.detail)

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">{diagram.title}</p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={diagram.title}>
        <defs>
          <marker id={`arrow-${diagram.title.replace(/\W+/g, '')}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="rgba(255,255,255,0.4)" />
          </marker>
        </defs>
        {diagram.edges.map((edge, index) => {
          const from = byId.get(edge.from)
          const to = byId.get(edge.to)
          if (!from || !to) return null
          const x1 = from.x + NODE_WIDTH / 2
          const y1 = from.y + NODE_HEIGHT / 2
          const x2 = to.x + NODE_WIDTH / 2
          const y2 = to.y + NODE_HEIGHT / 2
          return (
            <g key={`${edge.from}-${edge.to}-${index}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.38)" strokeWidth={1.5} markerEnd={`url(#arrow-${diagram.title.replace(/\W+/g, '')})`} />
              {edge.label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.55)">{edge.label}</text>}
            </g>
          )
        })}
        {positioned.map((node, index) => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={NODE_WIDTH} height={NODE_HEIGHT} rx={10} fill="rgba(15,23,42,0.85)" stroke={NODE_COLORS[index % NODE_COLORS.length]} strokeWidth={1.5} />
            <foreignObject x={node.x + 6} y={node.y + 4} width={NODE_WIDTH - 12} height={NODE_HEIGHT - 8}>
              <div className="flex h-full flex-col items-center justify-center text-center leading-tight">
                <p className="text-[11px] font-semibold text-white">{node.label}</p>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
      {notes.length > 0 && (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {notes.map((node) => (
            <p key={node.id} className="text-[11px] leading-5 text-white/45"><span className="font-semibold text-white/65">{node.label}:</span> {node.detail}</p>
          ))}
        </div>
      )}
    </div>
  )
}

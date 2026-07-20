import { Fragment, type ReactNode } from 'react'
import { sanitizeResponse } from '@/lib/ai/sanitize-response'
import { cn } from '@/lib/utils'

type AiMarkdownProps = {
  children: string
  className?: string
}

type MathSegment = {
  type: 'text' | 'inlineMath'
  value: string
}

type FractionParts = {
  before: string
  numerator: string
  denominator: string
  after: string
}

const inlinePattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\\\([\s\S]+?\\\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g
const displayMathSingleLinePattern = /^\s*(?:\\\[([\s\S]*)\\\]|\$\$([\s\S]*)\$\$)\s*$/
const superscriptMap: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ' }
const subscriptMap: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' }

function safeHref(value: string) {
  try {
    const url = new URL(value, 'https://nexuspoint.local')
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : null
  } catch {
    return null
  }
}

function toRaised(value: string) {
  return value.split('').map((character) => superscriptMap[character] ?? character).join('')
}

function toLowered(value: string) {
  return value.split('').map((character) => subscriptMap[character] ?? character).join('')
}

function estimateTextWidth(value: string, size: number) {
  return Math.max(8, value.length * size * 0.58)
}

function readLatexGroup(value: string, startIndex: number) {
  if (value[startIndex] !== '{') return null
  let depth = 0
  for (let index = startIndex; index < value.length; index += 1) {
    const character = value[index]
    if (character === '{') depth += 1
    if (character === '}') depth -= 1
    if (depth === 0) {
      return { body: value.slice(startIndex + 1, index), end: index + 1 }
    }
  }
  return null
}

function extractFraction(value: string): FractionParts | null {
  const match = value.match(/\\(?:d|t)?frac/)
  if (!match || match.index === undefined) return null
  let cursor = match.index + match[0].length
  while (value[cursor] === ' ') cursor += 1
  const numerator = readLatexGroup(value, cursor)
  if (!numerator) return null
  cursor = numerator.end
  while (value[cursor] === ' ') cursor += 1
  const denominator = readLatexGroup(value, cursor)
  if (!denominator) return null

  return {
    before: value.slice(0, match.index),
    numerator: numerator.body,
    denominator: denominator.body,
    after: value.slice(denominator.end),
  }
}

function normalizeLatex(value: string): string {
  return value
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\!/g, '')
    .replace(/\\;/g, ' ')
    .replace(/\\quad/g, '  ')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\operatorname\{([^{}]*)\}/g, '$1')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\div/g, '÷')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞')
    .replace(/\^\{([^{}]+)\}/g, (_, exponent: string) => toRaised(exponent))
    .replace(/_\{([^{}]+)\}/g, (_, subscript: string) => toLowered(subscript))
    .replace(/\^([A-Za-z0-9+\-=()])/g, (_, exponent: string) => toRaised(exponent))
    .replace(/_([A-Za-z0-9+\-=()])/g, (_, subscript: string) => toLowered(subscript))
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function mathAriaLabel(value: string) {
  const fraction = extractFraction(value)
  if (!fraction) return normalizeLatex(value)
  return [
    normalizeLatex(fraction.before),
    normalizeLatex(fraction.numerator),
    'over',
    normalizeLatex(fraction.denominator),
    normalizeLatex(fraction.after),
  ].filter(Boolean).join(' ')
}

function MathSvg({ latex, inline = false }: { latex: string; inline?: boolean }) {
  const fraction = extractFraction(latex)
  const fontSize = inline ? 17 : 24
  const smallFontSize = inline ? 12 : 16
  const baseline = inline ? 29 : 44

  if (fraction) {
    const before = normalizeLatex(fraction.before)
    const numerator = normalizeLatex(fraction.numerator)
    const denominator = normalizeLatex(fraction.denominator)
    const after = normalizeLatex(fraction.after)
    const beforeWidth = before ? estimateTextWidth(before, fontSize) + 10 : 0
    const fractionWidth = Math.max(estimateTextWidth(numerator, smallFontSize), estimateTextWidth(denominator, smallFontSize)) + (inline ? 16 : 22)
    const afterWidth = after ? estimateTextWidth(after, fontSize) + 12 : 0
    const width = Math.ceil(24 + beforeWidth + fractionWidth + afterWidth)
    const height = inline ? 46 : 68
    const fractionX = 12 + beforeWidth
    const fractionCenter = fractionX + fractionWidth / 2

    return (
      <svg width={width} height={height} className={cn('ai-math-svg', inline && 'ai-math-svg--inline')} viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={mathAriaLabel(latex)}>
        {before && <text x="12" y={baseline} className="ai-math-svg__text">{before}</text>}
        <text x={fractionCenter} y={inline ? 16 : 23} textAnchor="middle" className="ai-math-svg__small">{numerator}</text>
        <line x1={fractionX + 4} x2={fractionX + fractionWidth - 4} y1={inline ? 22 : 33} y2={inline ? 22 : 33} className="ai-math-svg__bar" />
        <text x={fractionCenter} y={inline ? 38 : 55} textAnchor="middle" className="ai-math-svg__small">{denominator}</text>
        {after && <text x={fractionX + fractionWidth + 8} y={baseline} className="ai-math-svg__text">{after}</text>}
      </svg>
    )
  }

  const normalized = normalizeLatex(latex)
  const width = Math.ceil(Math.min(920, Math.max(inline ? 28 : 180, estimateTextWidth(normalized, fontSize) + 24)))
  const height = inline ? 32 : 48
  return (
    <svg width={width} height={height} className={cn('ai-math-svg', inline && 'ai-math-svg--inline')} viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={normalized}>
      <text x="12" y={inline ? 23 : 33} className="ai-math-svg__text">{normalized}</text>
    </svg>
  )
}

function AiMath({ value, display = false }: { value: string; display?: boolean }) {
  return display ? (
    <div className="ai-math-display">
      <MathSvg latex={value} />
    </div>
  ) : (
    <span className="ai-math-inline">
      <MathSvg latex={value} inline />
    </span>
  )
}

function splitInlineMath(value: string): MathSegment[] {
  const segments: MathSegment[] = []
  const pattern = /\\\(([\s\S]+?)\\\)/g
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) segments.push({ type: 'text', value: value.slice(cursor, match.index) })
    segments.push({ type: 'inlineMath', value: match[1] })
    cursor = match.index + match[0].length
  }
  if (cursor < value.length) segments.push({ type: 'text', value: value.slice(cursor) })
  return segments.length ? segments : [{ type: 'text', value }]
}

function renderInline(value: string): ReactNode[] {
  return value.split(inlinePattern).filter(Boolean).flatMap((part, index) => {
    const key = part + '-' + index
    if (part.startsWith('\\(') && part.endsWith('\\)')) {
      return [<AiMath key={key} value={part.slice(2, -2)} />]
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = safeHref(link[2])
      return [href ? (
        <a key={key} href={href} target="_blank" rel="noreferrer" className="text-white underline decoration-white/35 underline-offset-2 hover:text-zinc-300">
          {link[1]}
        </a>
      ) : <Fragment key={key}>{link[1]}</Fragment>]
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return [<code key={key} className="rounded-md bg-slate-950/70 px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-200">{part.slice(1, -1)}</code>]
    }
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return [<strong key={key} className="font-semibold text-white">{renderInline(part.slice(2, -2))}</strong>]
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return [<em key={key}>{renderInline(part.slice(1, -1))}</em>]
    }
    return splitInlineMath(part).map((segment, segmentIndex) => segment.type === 'inlineMath'
      ? <AiMath key={key + '-math-' + segmentIndex} value={segment.value} />
      : <Fragment key={key + '-text-' + segmentIndex}>{segment.value}</Fragment>,
    )
  })
}

function readDisplayMathBlock(lines: string[], index: number) {
  const line = lines[index]
  const singleLine = line.match(displayMathSingleLinePattern)
  if (singleLine) {
    const value = singleLine[2] !== undefined ? singleLine[2] : singleLine[3] !== undefined ? singleLine[3] : ''
    return { value, nextIndex: index + 1 }
  }

  const start = line.trim()
  if (start !== '\\[' && start !== '$$') return null
  const end = start === '\\[' ? '\\]' : '$$'
  const mathLines: string[] = []
  let cursor = index + 1
  while (cursor < lines.length && lines[cursor].trim() !== end) {
    mathLines.push(lines[cursor])
    cursor += 1
  }
  if (cursor >= lines.length) return null
  return { value: mathLines.join('\n'), nextIndex: cursor + 1 }
}

function isBlockStart(line: string) {
  return /^(#{1,6})\s|^\s*[-*+]\s+|^\s*\d+[.)]\s+|^\s*```/.test(line) || displayMathSingleLinePattern.test(line) || line.trim() === '\\[' || line.trim() === '$$'
}

function renderBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    const displayMath = readDisplayMathBlock(lines, index)
    if (displayMath) {
      blocks.push(<AiMath key={'math-' + index} value={displayMath.value} display />)
      index = displayMath.nextIndex
      continue
    }

    if (line.trimStart().startsWith('```')) {
      const language = line.trim().slice(3).trim()
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trimStart().startsWith('```')) {
        code.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(
        <div key={'code-' + index} className="my-3 overflow-hidden rounded-xl border border-white/10 bg-slate-950/75">
          {language && <div className="border-b border-white/8 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">{language}</div>}
          <pre className="scrollbar-thin overflow-x-auto p-3 text-xs leading-relaxed text-zinc-100"><code>{code.join('\n')}</code></pre>
        </div>,
      )
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const classes = level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : level === 3 ? 'text-base' : 'text-sm'
      blocks.push(<div key={'heading-' + index} role="heading" aria-level={level} className={cn('mb-2 mt-3 font-semibold tracking-tight text-white', classes)}>{renderInline(heading[2])}</div>)
      index += 1
      continue
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
    if (unordered) {
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*+]\s+(.+)$/)
        if (!item) break
        items.push(item[1])
        index += 1
      }
      blocks.push(<ul key={'ul-' + index} className="my-2 list-disc space-y-1 pl-5 marker:text-zinc-400">{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>)
      continue
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (ordered) {
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index].match(/^\s*\d+[.)]\s+(.+)$/)
        if (!item) break
        items.push(item[1])
        index += 1
      }
      blocks.push(<ol key={'ol-' + index} className="my-2 list-decimal space-y-1 pl-5 marker:text-zinc-300">{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>)
      continue
    }

    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push(<p key={'p-' + index} className="my-2 whitespace-pre-wrap first:mt-0 last:mb-0">{renderInline(paragraph.join('\n'))}</p>)
  }

  return blocks
}

export function AiMarkdown({ children, className }: AiMarkdownProps) {
  const safeMarkdown = sanitizeResponse(children)
  return <div className={cn('ai-markdown break-words leading-relaxed', className)}>{renderBlocks(safeMarkdown)}</div>
}
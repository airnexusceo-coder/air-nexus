import { Fragment, type ReactNode } from 'react'
import { sanitizeResponse } from '@/lib/ai/sanitize-response'
import { cn } from '@/lib/utils'

type AiMarkdownProps = {
  children: string
  className?: string
}

const inlinePattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g

function safeHref(value: string) {
  try {
    const url = new URL(value, 'https://nexuspoint.local')
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : null
  } catch {
    return null
  }
}

function renderInline(value: string): ReactNode[] {
  return value.split(inlinePattern).filter(Boolean).map((part, index) => {
    const key = part + '-' + index
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = safeHref(link[2])
      return href ? (
        <a key={key} href={href} target="_blank" rel="noreferrer" className="text-white underline decoration-white/35 underline-offset-2 hover:text-zinc-300">
          {link[1]}
        </a>
      ) : <Fragment key={key}>{link[1]}</Fragment>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key} className="rounded-md bg-slate-950/70 px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-200">{part.slice(1, -1)}</code>
    }
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={key} className="font-semibold text-white">{renderInline(part.slice(2, -2))}</strong>
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{renderInline(part.slice(1, -1))}</em>
    }
    return <Fragment key={key}>{part}</Fragment>
  })
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
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s|^\s*[-*+]\s+|^\s*\d+[.)]\s+|^\s*```/.test(lines[index])) {
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

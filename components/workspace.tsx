'use client'

import {
  History,
  Download,
  MoreHorizontal,
  Share2,
  Paperclip,
  Mic,
  ChevronDown,
  ArrowUp,
  Sparkles,
  Type,
  Bold,
  Italic,
  Link2,
  Code2,
  ListChecks,
  Coins,
  Wand2,
  Search,
} from 'lucide-react'
import { milestones } from '@/lib/data'
import { cn } from '@/lib/utils'

function Avatar({
  initials,
  color,
  className,
}: {
  initials: string
  color: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white ring-2 ring-background/50',
        color,
        className,
      )}
    >
      {initials}
    </span>
  )
}

const collaborators = [
  { initials: 'EM', color: 'from-cyan-400 to-blue-500' },
  { initials: 'JK', color: 'from-blue-400 to-indigo-500' },
  { initials: 'AT', color: 'from-emerald-400 to-teal-500' },
  { initials: 'RP', color: 'from-violet-400 to-purple-500' },
]

const toolbarTools = [
  { icon: Type, label: 'Text' },
  { icon: Bold, label: 'Bold' },
  { icon: Italic, label: 'Italic' },
  { icon: Link2, label: 'Link' },
  { icon: Code2, label: 'Code' },
  { icon: ListChecks, label: 'Checklist' },
]

const statusStyles: Record<string, string> = {
  'On track': 'bg-emerald-500/15 text-emerald-300',
  'At risk': 'bg-amber-500/15 text-amber-300',
  Done: 'bg-blue-500/15 text-blue-300',
}

export function Workspace() {
  return (
    <main className="scrollbar-thin flex h-screen flex-1 flex-col overflow-y-auto">
      {/* Sticky header */}
      <header className="glass-subtle sticky top-0 z-10 flex items-center justify-between gap-4 border-x-0 border-t-0 px-6 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/5">
            <Sparkles className="size-4 text-[oklch(0.78_0.15_240)]" />
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[15px] font-semibold">
              Q4 Product Launch — Strategy Brief
            </h1>
            <p className="text-xs text-muted-foreground">
              Edited 2 minutes ago · Auto-saved
              <span className="ml-1 inline-block size-1.5 translate-y-px rounded-full bg-emerald-400" />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center -space-x-2 md:flex">
            {collaborators.map((c) => (
              <Avatar
                key={c.initials}
                initials={c.initials}
                color={c.color}
                className="size-7"
              />
            ))}
            <span className="flex size-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold ring-2 ring-background/50">
              +3
            </span>
          </div>

          <span className="glass-subtle hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-amber-300 lg:flex">
            <Coins className="size-3.5" />
            +14 Nexus
          </span>

          <div className="flex items-center gap-1">
            <IconButton icon={History} label="Version history" />
            <IconButton icon={Download} label="Export" />
            <IconButton icon={MoreHorizontal} label="More" />
          </div>

          <button className="glass-glow glow-blue-md flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:scale-[1.05] active:scale-95 shadow-lg">
            <Share2 className="size-4" />
            Share
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        {/* AI command bar */}
        <div className="glass-input glass-glow flex items-center gap-3 rounded-3xl px-5 py-3.5">
          <div className="glow-blue-sm flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400">
            <Sparkles className="size-5 text-white" />
          </div>
          <input
            type="text"
            placeholder="Ask AirNexus to write, research, summarize, brainstorm, or collaborate…"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          <button className="text-muted-foreground transition-colors hover:text-[oklch(0.7_0.16_250)]">
            <Paperclip className="size-5" />
          </button>
          <button className="message-highlight flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all hover:bg-[oklch(0.7_0.16_250_/_25%)]">
            <Wand2 className="size-4" />
            Tools
            <ChevronDown className="size-3.5" />
          </button>
          <button className="text-muted-foreground transition-all hover:text-[oklch(0.75_0.18_250)] hover:scale-110">
            <Mic className="size-5" />
          </button>
          <button className="glow-blue-md flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400 text-white shadow-lg transition-all hover:scale-125 active:scale-90 font-bold">
            <ArrowUp className="size-5" />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
          <Coins className="size-3.5 text-amber-300" />
          Earn Nexus Points with every AI action — writing, summarizing, and
          collaboration.
        </p>

        {/* Doc meta */}
        <div className="mt-8 flex items-center gap-3">
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium">
            Brief
          </span>
          <span className="text-xs text-muted-foreground">
            Owned by Parth Sharma
          </span>
        </div>

        <h2 className="mt-4 bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent text-balance">
          Q4 Product Launch — Strategy Brief
        </h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          A unified plan to ship Nexus 3.0 across enterprise, mid-market, and the
          developer community. This brief consolidates positioning, GTM motions,
          and the cross-functional milestones leading into November.
        </p>

        {/* Floating formatting toolbar */}
        <div className="glass message-highlight inline-flex items-center gap-2 rounded-2xl p-2.5 shadow-lg border border-[oklch(0.7_0.16_250_/_35%)]">
          {toolbarTools.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.label}
                aria-label={t.label}
                className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-[oklch(0.7_0.16_250_/_20%)] hover:text-[oklch(0.78_0.17_250)] active:scale-95"
              >
                <Icon className="size-4.5" />
              </button>
            )
          })}
          <span className="mx-1.5 h-5 w-px bg-[oklch(0.7_0.16_250_/_30%)]" />
          <button className="glow-blue-md flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500/35 to-cyan-400/25 px-4 py-2.5 text-xs font-bold text-[oklch(0.88_0.16_250)] transition-all hover:from-blue-500/45 hover:to-cyan-400/35 active:scale-95">
            <Sparkles className="size-4" />
            Ask AI
          </button>
        </div>

        {/* AI summary callout */}
        <div className="message-highlight glass mt-6 flex gap-4 rounded-2xl p-5 border border-[oklch(0.7_0.16_250_/_30%)] shadow-lg">
          <div className="glow-blue-sm flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/40 to-cyan-400/30">
            <Sparkles className="size-5 text-[oklch(0.85_0.15_250)]" />
          </div>
          <p className="text-sm leading-relaxed font-medium">
            <span className="bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent font-bold">AI Summary — </span>
            <span className="text-foreground">Nexus 3.0 targets a $42M ARR opportunity by year-end. Three growth
            motions are prioritized: enterprise design partners, self-serve
            developer activation, and a launch keynote on November 12.</span>
          </p>
        </div>

        {/* Section */}
        <h3 className="mt-10 text-2xl font-semibold tracking-tight">
          Launch milestones
        </h3>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The next eight weeks are organized around three workstreams. Each has a
          dedicated room, owner, and weekly checkpoint synced to the workspace
          calendar.
        </p>

        {/* Inline AI suggestion */}
        <div className="message-highlight glass-subtle mt-4 flex items-center gap-4 rounded-xl px-5 py-3.5 text-xs border border-[oklch(0.7_0.16_250_/_35%)] bg-gradient-to-r from-[oklch(0.32_0.05_265_/_40%)] to-[oklch(0.36_0.055_250_/_30%)] shadow-md">
          <Wand2 className="size-5 shrink-0 text-[oklch(0.88_0.16_250)]" />
          <span className="flex-1 font-bold text-foreground">
            AI suggestion: Improve writing in this section
          </span>
          <button className="glow-blue-sm rounded-lg bg-gradient-to-r from-blue-500/45 to-cyan-400/35 px-4 py-2 font-bold text-[oklch(0.88_0.16_250)] transition-all hover:from-blue-500/55 hover:to-cyan-400/45 active:scale-95 whitespace-nowrap">
            Apply
          </button>
          <button className="rounded-lg px-4 py-2 font-semibold text-muted-foreground hover:text-[oklch(0.78_0.17_250)] transition-colors">
            Dismiss
          </button>
        </div>

        {/* Milestones table */}
        <div className="glass mt-6 overflow-hidden rounded-2xl">
          <div className="grid grid-cols-[1.6fr_1fr_1.2fr_0.9fr] gap-2 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Workstream</span>
            <span>Owner</span>
            <span>Milestone</span>
            <span>Status</span>
          </div>
          {milestones.map((m) => (
            <div
              key={m.workstream}
              className="grid grid-cols-[1.6fr_1fr_1.2fr_0.9fr] items-center gap-2 border-b border-white/5 px-5 py-3.5 text-sm last:border-b-0"
            >
              <span className="font-medium">{m.workstream}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Avatar
                  initials={m.owner.slice(0, 2).toUpperCase()}
                  color={m.ownerColor}
                  className="size-6"
                />
                <span className="truncate">{m.owner}</span>
              </span>
              <span className="text-muted-foreground">{m.milestone}</span>
              <span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    statusStyles[m.status],
                  )}
                >
                  {m.status}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Checklist callout */}
        <h3 className="mt-10 text-2xl font-semibold tracking-tight">
          This week&apos;s action items
        </h3>
        <ul className="mt-4 space-y-2.5">
          {[
            { t: 'Finalize keynote storyboard with marketing', done: true },
            { t: 'Lock self-serve onboarding copy', done: true },
            { t: 'Confirm 5 enterprise LOIs', done: false },
            { t: 'Publish developer migration guide', done: false },
          ].map((item) => (
            <li
              key={item.t}
              className="glass-subtle flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-md border',
                  item.done
                    ? 'border-transparent bg-gradient-to-br from-blue-500 to-violet-500'
                    : 'border-white/20',
                )}
              >
                {item.done && <ListChecks className="size-3 text-white" />}
              </span>
              <span
                className={cn(
                  item.done && 'text-muted-foreground line-through',
                )}
              >
                {item.t}
              </span>
            </li>
          ))}
        </ul>

        <div className="h-16" />
      </div>
    </main>
  )
}

function IconButton({
  icon: Icon,
  label,
}: {
  icon: typeof Search
  label: string
}) {
  return (
    <button
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
    >
      <Icon className="size-[18px]" />
    </button>
  )
}

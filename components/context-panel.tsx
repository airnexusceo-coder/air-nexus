'use client'

import { useState } from 'react'
import {
  Sparkles,
  MessageSquare,
  MessageCircle,
  ListTodo,
  Activity,
  Trophy,
  Search,
  AtSign,
  Paperclip,
  Smile,
  Send,
  FileText,
  Download,
  Coins,
  Flame,
  ChevronRight,
} from 'lucide-react'
import { chatMessages, leaderboard, rewardTiers } from '@/lib/data'
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
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white ring-2 ring-background/50',
        color,
        className,
      )}
    >
      {initials}
    </span>
  )
}

const tabs = [
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'comments', label: 'Comments', icon: MessageCircle },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'rank', label: 'Rank', icon: Trophy },
]

export function ContextPanel() {
  const [tab, setTab] = useState('chat')

  return (
    <aside className="glass-strong z-20 hidden h-screen w-[320px] shrink-0 flex-col rounded-none border-y-0 border-r-0 lg:flex">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5">
        <h2 className="text-sm font-semibold">Context</h2>
        <button className="text-muted-foreground transition-colors hover:text-foreground">
          <Search className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="scrollbar-thin flex gap-1 overflow-x-auto px-3 pb-3">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'glass text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'chat' && <ChatView />}
        {tab === 'ai' && <AiView />}
        {tab === 'rank' && <RankView />}
        {tab === 'comments' && <CommentsView />}
        {tab === 'tasks' && <TasksView />}
        {tab === 'activity' && <ActivityView />}
      </div>

      {/* Composer (chat only) */}
      {tab === 'chat' && (
        <div className="px-4 pb-4">
          <div className="glass-input flex items-center gap-3 rounded-2xl px-5 py-3.5">
            <button className="text-muted-foreground transition-all hover:text-[oklch(0.75_0.18_250)] hover:scale-110">
              <AtSign className="size-4.5" />
            </button>
            <button className="text-muted-foreground transition-all hover:text-[oklch(0.75_0.18_250)] hover:scale-110">
              <Paperclip className="size-4.5" />
            </button>
            <input
              placeholder="Message #product-launch"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
            <button className="text-muted-foreground transition-all hover:text-[oklch(0.75_0.18_250)] hover:scale-110">
              <Smile className="size-4.5" />
            </button>
            <button className="glow-blue-md flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400 text-white transition-all hover:scale-120 active:scale-95 shadow-lg font-bold">
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

function ChatView() {
  return (
    <div className="space-y-4">
      <div className="glass-subtle flex items-center gap-3 rounded-2xl p-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/40 to-blue-500/40 text-sm font-semibold">
          #
        </div>
        <div className="leading-tight">
          <p className="text-sm font-medium">Product Launch Q4</p>
          <p className="text-xs text-emerald-400">4 online · 12 members</p>
        </div>
      </div>

      <p className="text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        Today
      </p>

      {chatMessages.map((m, i) => (
        <div
          key={i}
          className={cn('flex gap-2.5', m.self && 'flex-row-reverse')}
        >
          <Avatar initials={m.initials} color={m.color} className="size-7" />
          <div className={cn('max-w-[80%]', m.self && 'items-end text-right')}>
            <div
              className={cn(
                'flex items-center gap-2',
                m.self && 'flex-row-reverse',
              )}
            >
              <span className="text-xs font-medium">{m.author}</span>
              <span className="text-[10px] text-muted-foreground">
                {m.time}
              </span>
            </div>
            <div
              className={cn(
                'mt-1 rounded-2xl px-5 py-3 text-sm leading-relaxed font-semibold',
                m.self
                  ? 'message-self glow-blue-md text-white'
                  : 'message-highlight backdrop-blur-sm',
              )}
            >
              {m.text}
            </div>
            {m.highlighted && (
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-[oklch(0.8_0.14_250)]">
                <Sparkles className="size-2.5" />
                AI flagged important
              </span>
            )}
          </div>
        </div>
      ))}

      <div className="glass-subtle flex items-center gap-3 rounded-2xl p-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15">
          <FileText className="size-4 text-blue-300" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">narrative-v3.pdf</p>
          <p className="text-xs text-muted-foreground">
            Shared by Elena · 2.4 MB
          </p>
        </div>
        <button className="text-muted-foreground hover:text-foreground">
          <Download className="size-4" />
        </button>
      </div>
    </div>
  )
}

function AiView() {
  const suggestions = [
    'Summarize this document into 5 key points',
    'Extract action items and assign owners',
    'Draft a launch announcement from the brief',
    'Identify risks in the developer workstream',
  ]
  return (
    <div className="space-y-4">
      <div className="glass flex gap-3 rounded-2xl p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
          <Sparkles className="size-4 text-white" />
        </div>
        <p className="text-sm leading-relaxed font-medium text-foreground">
          I&apos;ve analyzed this brief. The keynote workstream is on track, but
          developer activation is{' '}
          <span className="font-bold text-amber-300">at risk</span> — the onboarding
          milestone has no owner confirmed.
        </p>
      </div>
      <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Suggested next steps
      </p>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <button
            key={s}
            className="glass-subtle flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
          >
            <Sparkles className="size-3.5 shrink-0 text-[oklch(0.8_0.14_250)]" />
            <span className="flex-1">{s}</span>
            <ChevronRight className="size-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  )
}

function RankView() {
  const you = leaderboard.find((u) => u.you)!
  const nextTier = rewardTiers.find((t) => t.points > 940) ?? rewardTiers[2]
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Your rank this week</span>
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-300">
            AI Strategist
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold">#3</span>
          <span className="flex items-center gap-1 text-sm text-amber-300">
            <Coins className="size-3.5" />
            {you.points.toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-sm text-orange-300">
            <Flame className="size-3.5" />
            {you.streak}d
          </span>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Next reward: {nextTier.label}</span>
            <span>940 / {nextTier.points}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
              style={{ width: `${(940 / nextTier.points) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Leaderboard
      </p>
      <div className="space-y-2">
        {leaderboard.map((u) => (
          <div
            key={u.rank}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5',
              u.you ? 'glass-glow' : 'glass-subtle',
            )}
          >
            <span
              className={cn(
                'w-4 text-center text-sm font-bold',
                u.rank === 1
                  ? 'text-amber-300'
                  : u.rank === 2
                    ? 'text-slate-300'
                    : u.rank === 3
                      ? 'text-orange-300'
                      : 'text-muted-foreground',
              )}
            >
              {u.rank}
            </span>
            <Avatar initials={u.initials} color={u.color} className="size-7" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{u.name}</p>
              <p className="flex items-center gap-1 text-[10px] text-orange-300">
                <Flame className="size-2.5" />
                {u.streak}d streak
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-300">
              <Coins className="size-3" />
              {u.points.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CommentsView() {
  const comments = [
    {
      author: 'Julian K.',
      initials: 'JK',
      color: 'from-blue-400 to-indigo-500',
      text: 'Should the $42M figure be net or gross ARR? Worth a footnote.',
      anchor: 'on "AI Summary"',
    },
    {
      author: 'Maya N.',
      initials: 'MN',
      color: 'from-amber-400 to-orange-500',
      text: 'Love the three-motion framing. Can we add a slide ref?',
      anchor: 'on "Launch milestones"',
    },
  ]
  return (
    <div className="space-y-3">
      {comments.map((c, i) => (
        <div key={i} className="glass-subtle rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <Avatar initials={c.initials} color={c.color} className="size-6" />
            <span className="text-sm font-medium">{c.author}</span>
          </div>
          <p className="mt-1 text-[11px] text-[oklch(0.8_0.14_250)]">
            {c.anchor}
          </p>
          <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
            {c.text}
          </p>
          <button className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            Reply
          </button>
        </div>
      ))}
    </div>
  )
}

function TasksView() {
  const tasks = [
    { t: 'Confirm 5 enterprise LOIs', who: 'EM', color: 'from-cyan-400 to-blue-500', due: 'Today' },
    { t: 'Publish migration guide', who: 'JK', color: 'from-blue-400 to-indigo-500', due: 'Wed' },
    { t: 'Keynote storyboard frame', who: 'AT', color: 'from-emerald-400 to-teal-500', due: 'Fri' },
  ]
  return (
    <div className="space-y-2">
      {tasks.map((task, i) => (
        <div
          key={i}
          className="glass-subtle flex items-center gap-3 rounded-xl px-3 py-3"
        >
          <span className="size-4 shrink-0 rounded-md border border-white/20" />
          <span className="flex-1 text-sm">{task.t}</span>
          <Avatar initials={task.who} color={task.color} className="size-6" />
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {task.due}
          </span>
        </div>
      ))}
    </div>
  )
}

function ActivityView() {
  const feed = [
    { who: 'Elena M.', action: 'edited section 2', time: '2m', points: '+3' },
    { who: 'AI Moderator', action: 'summarized 14 messages', time: '8m', points: '' },
    { who: 'Julian K.', action: 'left a comment', time: '15m', points: '+1' },
    { who: 'You', action: 'completed a task', time: '22m', points: '+1' },
    { who: 'Aarav T.', action: 'shared narrative-v3.pdf', time: '1h', points: '+2' },
  ]
  return (
    <div className="space-y-1">
      {feed.map((f, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm"
        >
          <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[oklch(0.78_0.15_240)]" />
          <p className="flex-1 leading-snug">
            <span className="font-medium">{f.who}</span>{' '}
            <span className="text-muted-foreground">{f.action}</span>
          </p>
          {f.points && (
            <span className="text-xs font-semibold text-amber-300">
              {f.points}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{f.time}</span>
        </div>
      ))}
    </div>
  )
}

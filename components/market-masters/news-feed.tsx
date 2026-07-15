'use client'

import { useState } from 'react'
import { AlertTriangle, Flag, Newspaper, TrendingDown, TrendingUp } from 'lucide-react'
import type { DecisionChallenge, DecisionOptionQuality, NewsItem } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

type NewsFeedProps = {
  news: NewsItem[]
  identifiedMisleadingNewsIds: string[]
  onFlagNews: (newsId: string) => boolean
  activeChallenge: DecisionChallenge | null
  onAnswerChallenge: (challengeId: string, optionId: string, quality: DecisionOptionQuality) => void
}

export function NewsFeed({ news, identifiedMisleadingNewsIds, onFlagNews, activeChallenge, onAnswerChallenge }: NewsFeedProps) {
  const ordered = [...news].reverse()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Newspaper className="size-5 text-slate-400" />News Feed</h1>
        <p className="mt-1 text-sm text-slate-400">Some headlines are useful. Some are exaggerated. Practice telling the difference with the flag button.</p>
      </div>

      {activeChallenge && <DecisionChallengeCard challenge={activeChallenge} onAnswer={onAnswerChallenge} />}

      {ordered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No news yet — advance the day to see the market move.</p>
      ) : (
        <div className="space-y-3">
          {ordered.map((item) => {
            const flagged = identifiedMisleadingNewsIds.includes(item.id)
            return <NewsCard key={item.id} item={item} flagged={flagged} onFlag={() => onFlagNews(item.id)} />
          })}
        </div>
      )}
    </div>
  )
}

function NewsCard({ item, flagged, onFlag }: { item: NewsItem; flagged: boolean; onFlag: () => boolean }) {
  const [checked, setChecked] = useState(false)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)

  const handleFlag = () => {
    const correct = onFlag()
    setWasCorrect(correct)
    setChecked(true)
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {item.tone === 'positive' ? (
            <TrendingUp className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          ) : item.tone === 'negative' ? (
            <TrendingDown className="mt-0.5 size-4 shrink-0 text-rose-300" />
          ) : (
            <Newspaper className="mt-0.5 size-4 shrink-0 text-slate-400" />
          )}
          <div>
            <p className="text-sm font-semibold text-white">{item.headline}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{item.body}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tickers.map((ticker) => (
                <span key={ticker} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{ticker}</span>
              ))}
              <span className="text-[10px] text-slate-600">Day {item.day}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={checked || flagged}
          onClick={handleFlag}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
            flagged || checked ? 'border-white/10 bg-white/5 text-slate-500' : 'border-amber-300/25 bg-amber-400/10 text-amber-200 hover:bg-amber-400/16',
          )}
        >
          <Flag className="size-3" />
          {flagged || checked ? 'Flagged' : 'Looks like hype?'}
        </button>
      </div>
      {checked && (
        <p className={cn('mt-3 rounded-lg px-3 py-2 text-xs leading-5', wasCorrect ? 'bg-emerald-400/10 text-emerald-100' : 'bg-white/5 text-slate-400')}>
          {wasCorrect
            ? 'Good catch — this headline was written to sound more dramatic than the actual news justified.'
            : 'This one was straightforward, factual news. Not every attention-grabbing headline is misleading — the skill is checking the substance either way.'}
        </p>
      )}
    </div>
  )
}

function DecisionChallengeCard({ challenge, onAnswer }: { challenge: DecisionChallenge; onAnswer: (challengeId: string, optionId: string, quality: DecisionOptionQuality) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedOption = challenge.options.find((option) => option.id === selectedId) ?? null

  return (
    <div className="glass-glow rounded-2xl border-amber-300/25 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-200">Decision challenge</p>
          <p className="mt-1 text-sm text-slate-400">{challenge.context}</p>
          <p className="mt-2 text-sm font-semibold text-white">{challenge.prompt}</p>
        </div>
      </div>

      {!selectedOption ? (
        <div className="mt-4 grid gap-2">
          {challenge.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedId(option.id)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-slate-200 transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div
            className={cn(
              'rounded-xl border px-3 py-2.5 text-sm',
              selectedOption.quality === 'strong' ? 'border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-100' : 'border-amber-400/30 bg-amber-400/[0.06] text-amber-100',
            )}
          >
            <p className="font-medium">{selectedOption.label}</p>
            <p className="mt-1 text-xs leading-5 opacity-90">{selectedOption.feedback}</p>
          </div>
          <button type="button" onClick={() => onAnswer(challenge.id, selectedOption.id, selectedOption.quality)} className="primary-action">
            Continue
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { BookOpen, CandlestickChart, Newspaper, ShoppingCart, Sparkles, Wallet } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

type TutorialStep = {
  icon: typeof Wallet
  title: string
  body: string
}

const STEPS: TutorialStep[] = [
  {
    icon: Wallet,
    title: 'Welcome to Market Masters',
    body: 'You start with the virtual cash you chose in setup. Nothing here uses real money — this is a safe space to learn how investing actually works.',
  },
  {
    icon: BookOpen,
    title: 'Learn the basics first',
    body: 'The Learning Centre has short lessons with quizzes on stocks, buying/selling, and diversification. Each one earns you XP and bonus cash.',
  },
  {
    icon: ShoppingCart,
    title: 'Buy and sell in the Stock Market',
    body: 'Browse dozens of fictional companies across 20 industries. Tap one to see its price history, news, and a simple buy/sell form.',
  },
  {
    icon: CandlestickChart,
    title: 'This market runs on real hours',
    body: 'There is no "advance day" button and no speed to pick. The market opens 9:00 AM and closes 5:00 PM, Monday to Friday, in your own local time — just like a real exchange. Prices update automatically about every 5 minutes while it\'s open, driven by market-wide trends and realistic events, not pure randomness.',
  },
  {
    icon: Newspaper,
    title: 'A busy, real-feeling news feed',
    body: 'Headlines break throughout the trading day — earnings, leadership changes, analyst calls, and more. Some are useful, some are exaggerated hype. Practice spotting the difference with the flag button on the News Feed.',
  },
  {
    icon: Sparkles,
    title: "You're ready",
    body: 'Complete missions and lessons to level up, earn achievement badges, and keep a learning streak going. Have fun, and remember — this is for practice, not real investing advice.',
  },
]

type GameTutorialProps = {
  open: boolean
  onClose: () => void
}

export function GameTutorial({ open, onClose }: GameTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  const handleClose = () => {
    setStepIndex(0)
    onClose()
  }

  return (
    <Modal open={open} title="How to Play" description={`Step ${stepIndex + 1} of ${STEPS.length}`} onClose={handleClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            <step.icon className="size-6" />
          </span>
          <div>
            <p className="text-base font-semibold text-white">{step.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{step.body}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {STEPS.map((_, index) => (
            <span key={index} className={cn('h-1.5 flex-1 rounded-full', index <= stepIndex ? 'bg-white' : 'bg-white/15')} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={handleClose} className="secondary-action">Skip</button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button type="button" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} className="secondary-action">Back</button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? handleClose() : setStepIndex((index) => Math.min(STEPS.length - 1, index + 1)))}
              className="primary-action"
            >
              {isLast ? "Let's go" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

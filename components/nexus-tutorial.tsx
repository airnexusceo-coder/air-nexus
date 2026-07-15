'use client'

import { Coins, Flame, GraduationCap, ListChecks, ShoppingBag, Sparkles, Users } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

type NexusTutorialProps = {
  open: boolean
  onClose: () => void
  onGoToMarketplace: () => void
}

const EARN_METHODS = [
  { icon: Flame, label: 'Daily login', detail: '+25 points automatically, once per day.' },
  { icon: ListChecks, label: 'Complete a task', detail: '+10 points for every task or room task you mark done.' },
  { icon: Sparkles, label: 'Study with AI Chat or AI Tutor', detail: '+10 to +15 points per AI study session, quiz, flashcard set, or graph you generate.' },
  { icon: Flame, label: '25-minute focus sprint', detail: '+25 points for a completed focus session.' },
  { icon: Users, label: '7-day study streak', detail: '+150 points once you keep a streak going — claim it from your profile.' },
]

const SPEND_OPTIONS = [
  { icon: ShoppingBag, label: 'Avatar colors & badges', detail: 'Cosmetic upgrades for your profile, from 300 points.' },
  { icon: Sparkles, label: 'Plus / Premium plans', detail: 'Unlock a paid plan for 30 days using points instead of a card.' },
  { icon: GraduationCap, label: 'Full VCE courses', detail: 'Unlock every unit of a subject until the holidays.' },
]

export function NexusTutorial({ open, onClose, onGoToMarketplace }: NexusTutorialProps) {
  return (
    <Modal
      open={open}
      title="Welcome to Nexus Points"
      description="Your in-app currency for studying — earn it by learning, spend it in the Marketplace."
      onClose={onClose}
      className="max-w-xl"
    >
      <div className="space-y-5">
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Coins className="size-4 text-amber-300" />
            How to earn Nexus Points
          </h3>
          <div className="mt-3 space-y-2">
            {EARN_METHODS.map((method) => (
              <div key={method.label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <method.icon className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-medium text-white">{method.label}</p>
                  <p className="text-xs text-slate-400">{method.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShoppingBag className="size-4 text-cyan-300" />
            What you can spend them on
          </h3>
          <div className="mt-3 space-y-2">
            {SPEND_OPTIONS.map((option) => (
              <div key={option.label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <option.icon className="mt-0.5 size-4 shrink-0 text-cyan-200" />
                <div>
                  <p className="text-sm font-medium text-white">{option.label}</p>
                  <p className="text-xs text-slate-400">{option.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="secondary-action">Maybe later</button>
          <button type="button" onClick={onGoToMarketplace} className="primary-action">Open Marketplace</button>
        </div>
      </div>
    </Modal>
  )
}

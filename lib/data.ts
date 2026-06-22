import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  MessageSquareText,
  FileText,
  Users,
  BookOpen,
  CheckSquare,
  Calendar,
  Calculator,
  BarChart3,
  Trophy,
  Bell,
  Plug,
  Store,
  Settings,
} from 'lucide-react'

export type NavItem = {
  label: string
  icon: LucideIcon
  badge?: string
  active?: boolean
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'AI Chat', icon: MessageSquareText },
  { label: 'Documents', icon: FileText, active: true },
  { label: 'Collaboration Rooms', icon: Users, badge: '4' },
  { label: 'Panic Mode', icon: BookOpen },
  { label: 'Tasks', icon: CheckSquare, badge: '12' },
  { label: 'Calendar', icon: Calendar },
  { label: 'Calculators', icon: Calculator },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Leaderboard', icon: Trophy },
  { label: 'Notifications', icon: Bell, badge: '3' },
  { label: 'Integrations', icon: Plug },
  { label: 'Marketplace', icon: Store },
  { label: 'Settings', icon: Settings },
]

export type Room = {
  name: string
  members: { initials: string; color: string }[]
  online: number
  unread?: number
  tag?: 'Urgent' | 'AI Suggested'
  summary: string
}

export const rooms: Room[] = [
  {
    name: 'Product Launch Q4',
    members: [
      { initials: 'EM', color: 'from-orange-400 to-orange-500' },
      { initials: 'JK', color: 'from-orange-400 to-amber-500' },
      { initials: 'AT', color: 'from-emerald-400 to-teal-500' },
    ],
    online: 4,
    unread: 6,
    tag: 'Urgent',
    summary: 'AI: 3 decisions pending. Keynote demo needs sign-off today.',
  },
  {
    name: 'Design System',
    members: [
      { initials: 'RP', color: 'from-amber-400 to-purple-500' },
      { initials: 'SK', color: 'from-pink-400 to-rose-500' },
    ],
    online: 2,
    tag: 'AI Suggested',
    summary: 'AI: Summarize 14 new comments into action items?',
  },
  {
    name: 'Growth & GTM',
    members: [
      { initials: 'MN', color: 'from-amber-400 to-orange-500' },
      { initials: 'EM', color: 'from-orange-400 to-orange-500' },
    ],
    online: 1,
    unread: 2,
    summary: 'AI: Weekly metrics synced. ARR pacing +12% vs plan.',
  },
]

export type ChatMessage = {
  id?: string
  author: string
  initials: string
  color: string
  time: string
  text: string
  self?: boolean
  highlighted?: boolean
}

export const chatMessages: ChatMessage[] = [
  {
    author: 'Elena M.',
    initials: 'EM',
    color: 'from-orange-400 to-orange-500',
    time: '10:42',
    text: 'Pushed the latest narrative draft to the brief — would love eyes on section 2.',
    highlighted: true,
  },
  {
    author: 'Julian K.',
    initials: 'JK',
    color: 'from-orange-400 to-amber-500',
    time: '10:44',
    text: 'On it. Also: should we sync the keynote demo with marketing assets this week?',
  },
  {
    author: 'Aarav T.',
    initials: 'AT',
    color: 'from-emerald-400 to-teal-500',
    time: '10:45',
    text: "Yes — I'll drop a storyboard frame here in ~30 min.",
  },
  {
    author: 'You',
    initials: 'Y',
    color: 'from-emerald-400 to-green-500',
    time: '10:47',
    text: "Perfect. Let's hold a 15-min sync at 4pm to align.",
    self: true,
  },
]

export type Milestone = {
  workstream: string
  owner: string
  ownerColor: string
  milestone: string
  status: 'On track' | 'At risk' | 'Done'
}

export const milestones: Milestone[] = [
  {
    workstream: 'Enterprise Design Partners',
    owner: 'Elena M.',
    ownerColor: 'from-orange-400 to-orange-500',
    milestone: '5 signed LOIs',
    status: 'On track',
  },
  {
    workstream: 'Developer Activation',
    owner: 'Julian K.',
    ownerColor: 'from-orange-400 to-amber-500',
    milestone: 'Self-serve onboarding',
    status: 'At risk',
  },
  {
    workstream: 'Launch Keynote',
    owner: 'Aarav T.',
    ownerColor: 'from-emerald-400 to-teal-500',
    milestone: 'Nov 12 livestream',
    status: 'On track',
  },
]

export type LeaderUser = {
  rank: number
  name: string
  initials: string
  color: string
  points: number
  streak: number
  you?: boolean
}

export const leaderboard: LeaderUser[] = [
  {
    rank: 1,
    name: 'Maya N.',
    initials: 'MN',
    color: 'from-amber-400 to-orange-500',
    points: 4820,
    streak: 41,
  },
  {
    rank: 2,
    name: 'Elena M.',
    initials: 'EM',
    color: 'from-orange-400 to-orange-500',
    points: 4310,
    streak: 33,
  },
  {
    rank: 3,
    name: 'Parth Nair',
    initials: 'PN',
    color: 'from-orange-400 to-amber-500',
    points: 3940,
    streak: 27,
    you: true,
  },
  {
    rank: 4,
    name: 'Julian K.',
    initials: 'JK',
    color: 'from-orange-400 to-amber-500',
    points: 3610,
    streak: 19,
  },
  {
    rank: 5,
    name: 'Aarav T.',
    initials: 'AT',
    color: 'from-emerald-400 to-teal-500',
    points: 3120,
    streak: 22,
  },
]

export const rewardTiers = [
  { points: 100, label: '1 Free Month' },
  { points: 500, label: '1 Month Unlimited' },
  { points: 1000, label: 'Max Tier Unlimited' },
]

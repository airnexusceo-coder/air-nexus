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
  Mic,
  Plug,
  Store,
  Settings,
  GraduationCap,
  Layers3,
  Brain,
  UserSearch,
  TrendingUp,
  Briefcase,
} from 'lucide-react'

export type NavItem = {
  label: string
  icon: LucideIcon
  badge?: string
  active?: boolean
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

/**
 * Grouped primary sidebar navigation. Dedicated function tools live in the
 * sidebar Other Functions dropdown, so they do not appear as duplicate nav rows.
 */
export const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard },
      { label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'AI Study Tools',
    items: [
      { label: 'AI Tutor', icon: GraduationCap },
      { label: 'AI Chat', icon: MessageSquareText },
      { label: 'Courses', icon: BookOpen },
      { label: 'Market Masters', icon: TrendingUp },
      { label: 'Business Empire', icon: Briefcase },
      { label: 'AI Memory', icon: Brain },
      { label: 'Flashcards', icon: Layers3 },
      { label: 'Panic Mode', icon: BookOpen },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'Documents', icon: FileText, active: true },
      { label: 'Record Lesson', icon: Mic },
      { label: 'Tasks', icon: CheckSquare },
      { label: 'Calendar', icon: Calendar },
      { label: 'Calculators', icon: Calculator },
    ],
  },
  {
    title: 'Community',
    items: [
      { label: 'Collaboration Rooms', icon: Users },
      { label: 'People', icon: UserSearch },
      { label: 'Leaderboard', icon: Trophy },
      { label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { label: 'Marketplace', icon: Store },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Integrations', icon: Plug },
      { label: 'Settings', icon: Settings },
    ],
  },
]

/** Flattened view of navGroups — kept for consumers that just need every item in order (e.g. the collapsed icon rail). */
export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)

/** Shared chat-bubble shape — used for the AI tab's local thread and mapped
 * from real room messages (see roomMessageToChatMessage in context-panel.tsx). */
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

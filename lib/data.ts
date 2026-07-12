import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  MessageSquareText,
  FileText,
  Users,
  BookOpen,
  ClipboardList,
  Compass,
  CheckSquare,
  Calendar,
  Calculator,
  BarChart3,
  Trophy,
  Bell,
  Plug,
  Store,
  Settings,
  GraduationCap,
  Layers3,
  Sparkles,
  Brain,
  Shield,
  UserSearch,
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
 * Grouped for the sidebar's information architecture. Every item from the
 * original flat list is still here under a new group — nothing removed,
 * only organized. Section routing keys off `label` strings elsewhere
 * (see SectionWorkspace in workspace.tsx), so group membership/order here
 * is purely presentational.
 */
export const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard },
      { label: 'Daily Dashboard', icon: Sparkles },
      { label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'AI Study Tools',
    items: [
      { label: 'AI Tutor', icon: GraduationCap },
      { label: 'AI Chat', icon: MessageSquareText },
      { label: 'Study Coach', icon: Compass },
      { label: 'Courses', icon: BookOpen },
      { label: 'AI Memory', icon: Brain },
      { label: 'Flashcards', icon: Layers3 },
      { label: 'Panic Mode', icon: BookOpen },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'Assignment Workspace', icon: ClipboardList },
      { label: 'Documents', icon: FileText, active: true },
      { label: 'Tasks', icon: CheckSquare, badge: '12' },
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
    title: 'Nexus Clash & Rewards',
    items: [
      { label: 'Apex', icon: Shield },
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

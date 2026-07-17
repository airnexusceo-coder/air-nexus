'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Coins,
  Code2,
  Database,
  Feather,
  FileSearch,
  FileText,
  Flame,
  Image as ImageIcon,
  Languages,
  Lock,
  Mail,
  Map,
  Presentation,
  Plus,
  Rocket,
  ScanSearch,
  Search,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react'
import { ThinkingLogo } from '@/components/thinking-logo'
import { PLAN_DETAILS, SECTION_PLAN_REQUIREMENTS, type NexusPlan } from '@/lib/plans'
import { navGroups, navItems } from '@/lib/data'
import { AI_TOOL_CATEGORIES, AI_TOOLS, type AiToolCategory } from '@/lib/ai-tools/catalog'
import { getMotivationStats, loadMotivationState } from '@/lib/motivation'
import { DEFAULT_AVATAR_GRADIENT, type CosmeticItem } from '@/lib/cosmetics'
import type { RoomSummary } from '@/lib/rooms/types'
import { cn } from '@/lib/utils'

type SidebarProps = {
  active: string
  activeRoomId: string | null
  plan: NexusPlan
  nexusPoints: number
  profileName: string
  motivationUserId: string
  activeToolSlug: string | null
  avatarGradient?: string
  badge?: CosmeticItem | null
  mobileOpen: boolean
  desktopCollapsed: boolean
  onCloseMobile: () => void
  onToggleDesktopCollapse: () => void
  onNavigate: (section: string) => void
  onSelectTool: (slug: string) => void
  onSelectRoom: (roomId: string) => void
  onCreateRoom: () => void
  onUpgrade: () => void
  onProfile: () => void
  onBackToWebsite: () => void
}

const TOOL_ICONS: Record<string, LucideIcon> = {
  'presentation-maker': Presentation,
  'resume-builder': BriefcaseBusiness,
  'code-generation': Code2,
  'data-analysis': BarChart3,
  'email-assistant': Mail,
  'file-analysis': FileSearch,
  'pdf-tools': FileText,
  'sql-assistant': Database,
  'grammar-checker': Check,
  'web-search': Search,
  translation: Languages,
  'youtube-summarizer': Rocket,
  'image-generation': ImageIcon,
  'mind-maps': Map,
  'ai-detector': ScanSearch,
  'ai-humaniser': Feather,
}

const TOOL_CATEGORY_STYLE: Record<AiToolCategory, { dot: string; icon: string; active: string }> = {
  Create: {
    dot: 'bg-violet-300',
    icon: 'border-violet-300/20 bg-violet-400/12 text-violet-100',
    active: 'border-violet-300/30 bg-violet-400/12',
  },
  Research: {
    dot: 'bg-cyan-300',
    icon: 'border-cyan-300/20 bg-cyan-400/12 text-cyan-100',
    active: 'border-cyan-300/30 bg-cyan-400/12',
  },
  Communicate: {
    dot: 'bg-amber-300',
    icon: 'border-amber-300/20 bg-amber-400/12 text-amber-100',
    active: 'border-amber-300/30 bg-amber-400/12',
  },
  Build: {
    dot: 'bg-emerald-300',
    icon: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-100',
    active: 'border-emerald-300/30 bg-emerald-400/12',
  },
}
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
        'inline-flex items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white ring-2 ring-slate-950/60',
        color,
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function AppSidebar({
  active,
  activeRoomId,
  plan,
  nexusPoints,
  profileName,
  motivationUserId,
  activeToolSlug,
  avatarGradient = DEFAULT_AVATAR_GRADIENT,
  badge = null,
  mobileOpen,
  desktopCollapsed,
  onCloseMobile,
  onToggleDesktopCollapse,
  onNavigate,
  onSelectTool,
  onSelectRoom,
  onCreateRoom,
  onUpgrade,
  onProfile,
  onBackToWebsite,
}: SidebarProps) {
  const initials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AN'
  const collapsedNav = navItems.slice(0, 12)

  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [otherFunctionsOpen, setOtherFunctionsOpen] = useState(true)
  const [toolSearch, setToolSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const otherToolsByCategory = useMemo(() => {
    const normalized = toolSearch.trim().toLowerCase()
    return AI_TOOL_CATEGORIES.map((category) => ({
      category,
      tools: AI_TOOLS.filter((tool) => {
        if (tool.category !== category) return false
        if (!normalized) return true
        return `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(normalized)
      }),
    })).filter((group) => group.tools.length > 0)
  }, [toolSearch])

  const toggleGroup = (title: string) => {
    setCollapsedGroups((current) => ({ ...current, [title]: !current[title] }))
  }
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentStreak(getMotivationStats(loadMotivationState(motivationUserId)).currentStreak)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [motivationUserId])

  const load = useCallback(async () => {
    const [roomsResponse, notificationsResponse] = await Promise.all([
      fetch('/api/rooms', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/notifications', { credentials: 'include', cache: 'no-store' }),
    ])
    if (roomsResponse.ok) setRooms(((await roomsResponse.json()) as { rooms: RoomSummary[] }).rooms)
    if (notificationsResponse.ok) {
      const data = (await notificationsResponse.json()) as { notifications: { read: boolean }[] }
      setUnreadNotifications(data.notifications.filter((item) => !item.read).length)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const badgeFor = (label: string, staticBadge?: string) => {
    if (label === 'Collaboration Rooms') return rooms.length > 0 ? String(rooms.length) : undefined
    if (label === 'Notifications') return unreadNotifications > 0 ? String(unreadNotifications) : undefined
    return staticBadge
  }

  const planRank: Record<NexusPlan, number> = { Free: 0, Plus: 1, Premium: 2 }
  const lockedPlanFor = (label: string) => {
    const requiredPlan = SECTION_PLAN_REQUIREMENTS[label]
    return requiredPlan && planRank[plan] < planRank[requiredPlan] ? requiredPlan : null
  }

  return (
    <>
      {desktopCollapsed && (
        <aside
          aria-label="Collapsed workspace navigation"
          className="hidden w-16 shrink-0 flex-col items-center border-r border-white/8 bg-[oklch(0.09_0.004_255_/_96%)] px-2 py-4 shadow-2xl backdrop-blur-2xl lg:flex"
        >
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            aria-label="Expand navigation"
            title="Expand navigation"
            className="interactive-icon size-11"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('Dashboard')}
            aria-label="Go to AirGPT dashboard"
            title="AirGPT dashboard"
            className="mt-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ThinkingLogo isThinking={false} className="size-10" priority />
          </button>
          <div className="my-4 h-px w-9 bg-white/10" />
          <button
            type="button"
            onClick={() => {
              setOtherFunctionsOpen(true)
              onToggleDesktopCollapse()
            }}
            aria-label="Open Other Functions"
            title="Other Functions"
            className={cn(
              'mb-2 flex size-10 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
              active === 'AI Tools' ? 'bg-white/12 text-white shadow-[0_0_22px_-12px_rgba(255,255,255,0.75)]' : 'text-white/55 hover:bg-white/[0.055] hover:text-white',
            )}
          >
            <WandSparkles className="size-[18px]" />
          </button>
          <nav className="scrollbar-thin flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto" aria-label="Collapsed workspace sections">
            {collapsedNav.map((item) => {
              const Icon = item.icon
              const isActive = active === item.label
              const lockedPlan = lockedPlanFor(item.label)
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onNavigate(item.label)}
                  aria-label={lockedPlan ? `${item.label} (requires ${lockedPlan})` : item.label}
                  aria-current={isActive ? 'page' : undefined}
                  title={lockedPlan ? `${item.label} — requires ${lockedPlan}` : item.label}
                  className={cn(
                    'relative flex size-10 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                    isActive ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/[0.055] hover:text-white',
                  )}
                >
                  <Icon className="size-[18px]" />
                  {lockedPlan ? (
                    <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-slate-950 text-white/60"><Lock className="size-2.5" /></span>
                  ) : (
                    badgeFor(item.label, item.badge) && <span className="absolute right-1 top-1 size-2 rounded-full bg-white" />
                  )}
                </button>
              )
            })}
          </nav>
          <div className="mt-3 flex flex-col items-center gap-2 border-t border-white/8 pt-3">
            <button type="button" onClick={onBackToWebsite} aria-label="Back to Air Nexus website" title="Back to Air Nexus" className="interactive-icon size-10">
              <ArrowLeft className="size-4" />
            </button>
            <button type="button" onClick={onUpgrade} aria-label="Upgrade or manage plan" title={plan === 'Free' ? 'Upgrade plan' : 'Manage plan'} className="interactive-icon size-10 text-zinc-200">
              <Coins className="size-4" />
            </button>
            <button type="button" onClick={onProfile} aria-label="Open profile and settings" title={profileName} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              <Avatar initials={initials} color={avatarGradient} className="size-10" />
            </button>
          </div>
        </aside>
      )}

      <aside
        aria-label="Workspace navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[304px] shrink-0 flex-col border-r border-white/8 bg-[oklch(0.09_0.006_255_/_98%)] shadow-2xl shadow-black/45 backdrop-blur-2xl transition-transform duration-300',
          desktopCollapsed ? 'lg:hidden' : 'lg:static lg:z-20 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
      <div className="flex items-center gap-3 px-5 py-5">
        <button
          type="button"
          onClick={() => onNavigate('Dashboard')}
          aria-label="Go to AirGPT dashboard"
          className="flex items-center gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <ThinkingLogo isThinking={false} className="size-11" priority />
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-white">AirGPT</span>
            <span className="block text-xs text-white/55">Workspace OS</span>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            aria-label="Collapse navigation"
            title="Collapse navigation"
            className="interactive-icon hidden lg:flex"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="interactive-icon lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={onBackToWebsite}
          className="flex w-full items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-xs text-white/60 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <ArrowLeft className="size-3.5" />
          Back to Air Nexus website
        </button>
      </div>
      <div className="px-4 pb-3">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,.2),transparent_46%),rgba(255,255,255,.045)] shadow-lg shadow-black/25">
          <button
            type="button"
            onClick={() => setOtherFunctionsOpen((open) => !open)}
            aria-expanded={otherFunctionsOpen}
            className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/12 text-violet-100 shadow-[0_0_24px_-14px_rgba(167,139,250,0.9)]">
              <WandSparkles className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">Other Functions</span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-white/45">{AI_TOOLS.length} tools ready</span>
            </span>
            <ChevronDown className={cn('size-4 shrink-0 text-white/45 transition-transform', otherFunctionsOpen && 'rotate-180 text-white')} />
          </button>

          {otherFunctionsOpen && (
            <div className="border-t border-white/8 px-3 pb-3 pt-3">
              <label className="relative block" htmlFor="other-functions-search">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
                <input
                  id="other-functions-search"
                  value={toolSearch}
                  onChange={(event) => setToolSearch(event.target.value)}
                  placeholder="Search functions"
                  className="w-full rounded-xl border border-white/8 bg-black/24 py-2.5 pl-8 pr-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/25 focus:bg-black/32 focus:ring-2 focus:ring-white/8"
                />
              </label>

              <div className="scrollbar-thin mt-3 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                {otherToolsByCategory.map(({ category, tools }) => (
                  <div key={category}>
                    <div className="mb-1.5 flex items-center gap-2 px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/38">
                      <span className={cn('size-1.5 rounded-full', TOOL_CATEGORY_STYLE[category].dot)} />
                      {category}
                    </div>
                    <div className="space-y-1">
                      {tools.map((tool) => {
                        const ToolIcon = TOOL_ICONS[tool.slug] ?? WandSparkles
                        const selected = active === 'AI Tools' && activeToolSlug === tool.slug
                        return (
                          <button
                            key={tool.slug}
                            type="button"
                            onClick={() => onSelectTool(tool.slug)}
                            aria-current={selected ? 'page' : undefined}
                            title={tool.description}
                            className={cn(
                              'group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                              selected
                                ? TOOL_CATEGORY_STYLE[tool.category].active + ' text-white shadow-[0_10px_24px_-18px_rgba(255,255,255,0.7)]'
                                : 'border-transparent text-white/58 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.06] hover:text-white',
                            )}
                          >
                            <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border', TOOL_CATEGORY_STYLE[tool.category].icon)}>
                              <ToolIcon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-semibold leading-5">{tool.name}</span>
                              <span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-white/42">{tool.description}</span>
                            </span>
                            <ChevronRight className={cn('size-3 shrink-0 transition', selected ? 'text-white' : 'text-white/20 group-hover:translate-x-0.5 group-hover:text-white/65')} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {otherToolsByCategory.length === 0 && (
                  <p className="rounded-xl border border-white/8 bg-black/20 px-3 py-6 text-center text-xs text-white/42">No functions match that search.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={onUpgrade}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-zinc-100">
            <Coins className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-white">{plan} plan</span>
            <span className="mt-0.5 block truncate text-[10px] text-white/42">{PLAN_DETAILS[plan].price} | {nexusPoints.toLocaleString()} Nexus Points</span>
          </span>
          <ChevronRight className="size-3.5 text-white/35" />
        </button>
      </div>
      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map((group, groupIndex) => {
          const groupCollapsed = collapsedGroups[group.title] ?? false
          return (
            <div key={group.title} className={groupIndex > 0 ? 'mt-3' : undefined}>
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                aria-expanded={!groupCollapsed}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45 transition hover:bg-white/[0.035] hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <span>{group.title}</span>
                <ChevronDown className={cn('size-3.5 transition-transform', !groupCollapsed && 'rotate-180 text-white/75')} />
              </button>
              {!groupCollapsed && (
                <ul className="mt-1 flex flex-col gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = active === item.label
                    const lockedPlan = lockedPlanFor(item.label)
                    return (
                      <li key={item.label}>
                        <button
                          type="button"
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={lockedPlan ? `${item.label} (requires ${lockedPlan})` : undefined}
                          title={lockedPlan ? `Requires ${lockedPlan}` : undefined}
                          onClick={() => onNavigate(item.label)}
                          className={cn(
                            'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                            isActive
                              ? 'bg-white/11 text-white shadow-inner shadow-white/5 before:absolute before:left-0 before:top-1/2 before:h-6 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-white'
                              : 'text-white/58 hover:-translate-y-0.5 hover:bg-white/[0.055] hover:text-white',
                          )}
                        >
                          <Icon className="size-[18px] shrink-0" />
                          <span className="flex-1 truncate text-left">{item.label}</span>
                          {lockedPlan ? (
                            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                              <Lock className="size-2.5" /> {lockedPlan}
                            </span>
                          ) : (
                            badgeFor(item.label, item.badge) && (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                                {badgeFor(item.label, item.badge)}
                              </span>
                            )
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
        <div className="mt-6 flex items-center justify-between px-2 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45">
            Active rooms
          </p>
          <button
            type="button"
            onClick={onCreateRoom}
            aria-label="Create collaboration room"
            className="interactive-icon size-7"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {rooms.length === 0 ? (
          <p className="px-2 text-[11px] leading-relaxed text-white/40">No rooms yet — create one to start collaborating.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rooms.map((room) => {
              const selected = activeRoomId === room.id && active === 'Collaboration Rooms'
              return (
                <li key={room.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectRoom(room.id)}
                    className={cn(
                      'w-full rounded-2xl border p-3 text-left transition',
                      selected
                        ? 'border-white/30 bg-white/10'
                        : 'border-transparent bg-white/[0.035] hover:bg-white/[0.07]',
                    )}
                  >
                    <span className="truncate text-[13px] font-medium text-white">{room.name}</span>
                    <p className="mt-1 text-[10px] text-white/45">{room.memberCount} member{room.memberCount === 1 ? '' : 's'}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      <div className="space-y-3 border-t border-white/6 px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={onProfile}
          aria-label="Open profile and settings"
          className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.045] p-3 text-left transition hover:bg-white/[0.08]"
        >
          <Avatar initials={initials} color={avatarGradient} className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-white">{profileName}</p>
              {badge && <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide', badge.badgeClassName)}>{badge.badgeLabel}</span>}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-white">
                <Coins className="size-3" />
                {nexusPoints.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-zinc-400">
                <Flame className="size-3" />
                {currentStreak}d
              </span>
            </div>
          </div>
          <ChevronsUpDown className="size-4 text-white/35" />
        </button>
      </div>
    </aside>
    </>
  )
}

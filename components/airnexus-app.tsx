'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Coins, ShieldCheck, Sparkles, UserRound, Volume2 } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { ContextPanel } from '@/components/context-panel'
import { Workspace } from '@/components/workspace'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { formatPlanExpiry, PLAN_DETAILS, SECTION_PLAN_REQUIREMENTS, type NexusPlan } from '@/lib/plans'
import type { AuthSession } from '@/lib/auth/session'
import {
  canRedeem,
  createTransaction,
  DAILY_LOGIN_REWARD,
  dateKey,
  NEXUS_REWARDS_STORAGE_KEY,
  parseRewardsState,
  type NexusTransaction,
  type NexusRewardsState,
} from '@/lib/nexus-points'
import { getMotivationStats, loadMotivationState, recordMotivationActivity, type MotivationCelebration } from '@/lib/motivation'
import { avatarGradientFor, getCosmetic, type CosmeticCategory } from '@/lib/cosmetics'

export type AppDialog = 'upgrade-required' | 'insufficient-points' | 'profile' | null
export type NoticeTone = 'success' | 'info' | 'warning'

type LocalUserProfile = {
  name: string
  email: string
  avatar: string | null
}

type SchoolConnectionCheck = {
  browser: {
    origin: string
    secureContext: boolean
    microphoneApi: boolean
    speechRecognitionApi: boolean
  }
  diagnostics?: {
    checks?: {
      groq?: { ok: boolean; status?: number; message: string }
    }
    guidance?: string
  }
  error?: string
}

type StoredUserProfile = LocalUserProfile & {
  currentPlan: NexusPlan
  nexusPoints: number
  planExpiry: string | null
  autoSpeak: boolean
}

const PROFILE_STORAGE_KEY = 'airnexus-google-profile'
const STREAK_REWARD_STORAGE_KEY = 'airnexus-streak-reward-7'

type AirGPTAppProps = {
  authUser: AuthSession
  onSignOut: () => void
}

export function AirGPTApp({ authUser, onSignOut }: AirGPTAppProps) {
  const profileStorageKey = `${PROFILE_STORAGE_KEY}:${authUser.id}`
  const rewardsStorageKey = `${NEXUS_REWARDS_STORAGE_KEY}:${authUser.id}`
  const streakStorageKey = `${STREAK_REWARD_STORAGE_KEY}:${authUser.id}`
  const [activeSection, setActiveSection] = useState('AI Chat')
  const [mainChatOpen, setMainChatOpen] = useState(true)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<AppDialog>(null)
  const [plan, setPlan] = useState<NexusPlan>('Free')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [contextCollapsed, setContextCollapsed] = useState(false)
  const [notices, setNotices] = useState<Array<{ id: number; message: string; tone: NoticeTone }>>([])
  const [profileName, setProfileName] = useState(authUser.name)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [nexusPoints, setNexusPoints] = useState(0)
  const [redeemedRewards, setRedeemedRewards] = useState<string[]>([])
  const [equippedAvatar, setEquippedAvatar] = useState<string | null>(null)
  const [equippedBadge, setEquippedBadge] = useState<string | null>(null)
  const [planExpiry, setPlanExpiry] = useState<string | null>(null)
  const [pointsShortfall, setPointsShortfall] = useState(0)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [upgradeRequirement, setUpgradeRequirement] = useState<{ feature: string; plan: Exclude<NexusPlan, 'Free'> }>({ feature: 'this feature', plan: 'Plus' })
  const [streakRewardClaimed, setStreakRewardClaimed] = useState(false)
  const [transactions, setTransactions] = useState<NexusTransaction[]>([])
  const [rewardedActions, setRewardedActions] = useState<string[]>([])
  const [lastDailyLogin, setLastDailyLogin] = useState<string | null>(null)
  const [rewardsHydrated, setRewardsHydrated] = useState(false)
  const [profileHydrated, setProfileHydrated] = useState(false)
  const [connectionCheck, setConnectionCheck] = useState<SchoolConnectionCheck | null>(null)
  const [connectionChecking, setConnectionChecking] = useState(false)
  const [motivationCelebration, setMotivationCelebration] = useState<MotivationCelebration | null>(null)
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)


  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        setStreakRewardClaimed(window.localStorage.getItem(streakStorageKey) === 'claimed')
        const saved = window.localStorage.getItem(profileStorageKey)
        if (!saved) return
        const profile = JSON.parse(saved) as Partial<StoredUserProfile>
        if (typeof profile.name === 'string' && typeof profile.email === 'string') {
          setProfileName(profile.name)
        }

        if (typeof profile.autoSpeak === 'boolean') setAutoSpeak(profile.autoSpeak)
      } catch {
        window.localStorage.removeItem(profileStorageKey)
      } finally {
        setProfileHydrated(true)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [profileStorageKey, streakStorageKey])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const stored = parseRewardsState(window.localStorage.getItem(rewardsStorageKey))
      const today = dateKey()
      const savedPlan = stored?.plan ?? 'Free'
      const savedExpiry = stored?.planExpiry ?? null
      const expired = savedPlan !== 'Free' && (!savedExpiry || new Date(savedExpiry).getTime() <= Date.now())
      const nextPlan = expired ? 'Free' : savedPlan
      const startingPoints = stored?.nexusPoints ?? 0
      const shouldAwardDaily = stored?.lastDailyLogin !== today

      setPlan(nextPlan)
      setPlanExpiry(expired ? null : savedExpiry)
      setRedeemedRewards(stored?.redeemedRewards ?? [])
      setRewardedActions(stored?.rewardedActions ?? [])
      setEquippedAvatar(stored?.equippedAvatar ?? null)
      setEquippedBadge(stored?.equippedBadge ?? null)
      setLastDailyLogin(today)
      setNexusPoints(startingPoints + (shouldAwardDaily ? DAILY_LOGIN_REWARD : 0))
      setTransactions([
        ...(shouldAwardDaily ? [createTransaction('earned', DAILY_LOGIN_REWARD, 'Daily login reward')] : []),
        ...(stored?.transactions ?? []),
      ])
      setRewardsHydrated(true)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [rewardsStorageKey])

  useEffect(() => {
    if (!rewardsHydrated) return
    const state: NexusRewardsState = {
      nexusPoints,
      plan,
      planExpiry,
      redeemedRewards,
      transactions,
      rewardedActions,
      lastDailyLogin,
      equippedAvatar,
      equippedBadge,
    }
    window.localStorage.setItem(rewardsStorageKey, JSON.stringify(state))
  }, [equippedAvatar, equippedBadge, lastDailyLogin, nexusPoints, plan, planExpiry, redeemedRewards, rewardedActions, rewardsHydrated, rewardsStorageKey, transactions])

  useEffect(() => {
    if (!profileHydrated) return
    const profile: StoredUserProfile = {
      name: profileName,
      email: authUser.email,
      avatar: null,
      currentPlan: plan,
      nexusPoints,
      planExpiry,
      autoSpeak,
    }
    window.localStorage.setItem(profileStorageKey, JSON.stringify(profile))
  }, [authUser.email, autoSpeak, nexusPoints, plan, planExpiry, profileHydrated, profileName, profileStorageKey])
  const notify = useCallback((message: string, tone: NoticeTone = 'info') => {
    const id = Date.now()
    setNotices((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id))
    }, 3200)
  }, [])

  const fetchBillingStatus = useCallback(async () => {
    const response = await fetch('/api/billing/status', { credentials: 'include', cache: 'no-store' })
    if (!response.ok) return
    const data = (await response.json()) as { plan: NexusPlan; planExpiresAt: string | null; hasActiveSubscription: boolean }
    setHasStripeSubscription(data.hasActiveSubscription)
    // A real Stripe subscription always wins over the local plan (which may
    // reflect a Nexus-Points redemption, or a stale/tampered local value).
    // No active subscription just means "nothing to override with" — it
    // does not downgrade a points-purchased plan back to Free.
    if (data.hasActiveSubscription) {
      setPlan(data.plan)
      setPlanExpiry(data.planExpiresAt)
    }
  }, [])

  useEffect(() => {
    let refetchId: number | null = null
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      const billingResult = params.get('billing')
      if (billingResult === 'success') {
        notify('Subscription activated — thank you!', 'success')
        // The Stripe webhook that grants the plan usually lands seconds after
        // the redirect — the immediate fetch below often still reads the
        // pre-purchase state, so check again once the webhook has had time.
        refetchId = window.setTimeout(() => void fetchBillingStatus(), 5000)
      } else if (billingResult === 'cancel') {
        notify('Checkout was cancelled — no charge was made.', 'info')
      }
      if (billingResult) {
        params.delete('billing')
        const query = params.toString()
        window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
      }
      void fetchBillingStatus()
    }, 0)
    return () => {
      window.clearTimeout(timeoutId)
      if (refetchId != null) window.clearTimeout(refetchId)
    }
  }, [fetchBillingStatus, notify])

  const openBillingPortal = async () => {
    setBillingBusy(true)
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST', credentials: 'include' })
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!response.ok || !data.url) {
        notify(data.error ?? 'Could not open the billing portal.', 'warning')
        return
      }
      window.location.href = data.url
    } catch {
      notify('Could not reach the billing service.', 'warning')
    } finally {
      setBillingBusy(false)
    }
  }

  const lastSyncedNameRef = useRef(authUser.name)
  const syncDisplayName = useCallback(() => {
    const trimmed = profileName.trim()
    if (!trimmed || trimmed === lastSyncedNameRef.current) return
    lastSyncedNameRef.current = trimmed
    fetch('/api/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: trimmed }),
    }).catch(() => undefined)
  }, [profileName])
  const requestUpgrade = (feature: string, requiredPlan: Exclude<NexusPlan, 'Free'>) => {
    setUpgradeRequirement({ feature, plan: requiredPlan })
    setDialog('upgrade-required')
    setSidebarOpen(false)
  }

  const navigate = (section: string) => {
    if (section === 'Settings') {
      setDialog('profile')
      setSidebarOpen(false)
      return
    }
    const requiredPlan = SECTION_PLAN_REQUIREMENTS[section] ?? null
    const rank = { Free: 0, Plus: 1, Premium: 2 } as const
    if (requiredPlan && rank[plan] < rank[requiredPlan]) {
      requestUpgrade(section, requiredPlan)
      return
    }
    setActiveSection(section)
    setMainChatOpen(section === 'AI Chat')
    setSidebarOpen(false)
  }

  const openMainChat = () => {
    setActiveSection((section) => (section === 'AI Chat' ? section : 'Documents'))
    setMainChatOpen(true)
  }

  const closeMainChat = () => {
    setMainChatOpen(false)
    if (activeSection === 'AI Chat') setActiveSection('Documents')
  }

  const openSidebarPanel = () => {
    setSidebarCollapsed(false)
    setSidebarOpen(true)
  }

  const openContextPanel = () => {
    setContextCollapsed(false)
    setContextOpen(true)
  }

  /** For a Nexus-Points-purchased plan (or already Free) this is purely local, same as it always was. For a real Stripe subscriber, flipping local state alone previously left the subscription live — Stripe kept billing them and the next billing-status refresh silently reverted the change back to their paid plan. Now it actually cancels the subscription first. */
  const selectFreePlan = async () => {
    if (hasStripeSubscription) {
      if (billingBusy) return
      setBillingBusy(true)
      try {
        const response = await fetch('/api/billing/cancel', { method: 'POST', credentials: 'include' })
        const data = (await response.json().catch(() => ({}))) as { plan?: NexusPlan; hasActiveSubscription?: boolean; error?: string }
        if (!response.ok || !data.plan) {
          notify(data.error ?? 'Could not cancel your subscription.', 'warning')
          return
        }
        setPlan(data.plan)
        setPlanExpiry(null)
        setHasStripeSubscription(Boolean(data.hasActiveSubscription))
        setDialog(null)
        notify('Subscription cancelled — Free plan is now active', 'success')
      } catch {
        notify('Could not reach the billing service.', 'warning')
      } finally {
        setBillingBusy(false)
      }
      return
    }
    setPlan('Free')
    setPlanExpiry(null)
    setDialog(null)
    notify('Free plan is now active', 'success')
  }

  /** Real charge — creates a Stripe Checkout Session and redirects. profiles.plan only ever changes from here via the Stripe webhook (lib/billing/customer.ts), never by this function directly. */
  const purchasePlanWithCard = async (nextPlan: Exclude<NexusPlan, 'Free'>) => {
    if (billingBusy) return
    setBillingBusy(true)
    try {
      // Already have a live Stripe subscription — switch it in place (updates
      // price + metadata.plan server-side) instead of starting a second
      // Checkout Session, which /api/billing/checkout would reject with 409.
      if (hasStripeSubscription) {
        const response = await fetch('/api/billing/change-plan', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: nextPlan }),
        })
        const data = (await response.json().catch(() => ({}))) as { plan?: NexusPlan; planExpiresAt?: string | null; hasActiveSubscription?: boolean; error?: string }
        if (!response.ok || !data.plan) {
          notify(data.error ?? 'Could not change your plan.', 'warning')
          return
        }
        setPlan(data.plan)
        setPlanExpiry(data.planExpiresAt ?? null)
        setHasStripeSubscription(Boolean(data.hasActiveSubscription))
        setDialog(null)
        notify(`Switched to ${data.plan}`, 'success')
        return
      }

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: nextPlan }),
      })
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!response.ok || !data.url) {
        notify(data.error ?? 'Could not start checkout.', 'warning')
        return
      }
      window.location.href = data.url
    } catch {
      notify('Could not reach the billing service.', 'warning')
    } finally {
      setBillingBusy(false)
    }
  }

  /** Spends the app's own in-app currency, not real money — unrelated to Stripe. Activates locally the same way it always has; a real Stripe subscription (if the user has one) always takes priority over this on the next billing-status refresh. */
  const purchasePlanWithPoints = (nextPlan: Exclude<NexusPlan, 'Free'>) => {
    const cost = PLAN_DETAILS[nextPlan].points
    if (!canRedeem(nexusPoints, cost)) {
      setPointsShortfall(cost - nexusPoints)
      setDialog('insufficient-points')
      return
    }
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + 30)
    const expiryIso = expiry.toISOString()
    setNexusPoints((points) => points - cost)
    setTransactions((current) => [createTransaction('spent', cost, `${nextPlan} plan · 30 days`), ...current])
    setPlan(nextPlan)
    setPlanExpiry(expiryIso)
    setDialog(null)
    notify(`${nextPlan} activated with Nexus Points until ${formatPlanExpiry(expiryIso)}`, 'success')
  }

  const signOut = () => {
    onSignOut()
  }

  const runSchoolConnectionCheck = async () => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: unknown
      webkitSpeechRecognition?: unknown
    }

    const browser = {
      origin: window.location.origin,
      secureContext: window.isSecureContext,
      microphoneApi: Boolean(navigator.mediaDevices?.getUserMedia),
      speechRecognitionApi: Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition),
    }

    setConnectionChecking(true)
    setConnectionCheck({ browser })

    try {
      const response = await fetch('/api/diagnostics')
      const diagnostics = (await response.json()) as SchoolConnectionCheck['diagnostics']
      setConnectionCheck({ browser, diagnostics })
      const groqOk = diagnostics?.checks?.groq?.ok
      notify(groqOk ? 'School connection check passed' : 'School connection check found a blocker', groqOk ? 'success' : 'warning')
    } catch {
      setConnectionCheck({ browser, error: 'The diagnostics route could not be reached. Local API requests are being blocked.' })
      notify('The school connection check could not reach the local API', 'warning')
    } finally {
      setConnectionChecking(false)
    }
  }
  const claimStreakReward = () => {
    if (streakRewardClaimed) return
    if (getMotivationStats(loadMotivationState(authUser.id)).currentStreak < 7) {
      notify('Complete a 7-day study streak before claiming this reward', 'warning')
      return
    }
    setStreakRewardClaimed(true)
    setNexusPoints((points) => points + 150)
    setTransactions((current) => [createTransaction('earned', 150, '7-day learning streak'), ...current])
    window.localStorage.setItem(streakStorageKey, 'claimed')
    notify('7-day streak reward claimed: +150 Nexus Points', 'success')
  }
  /** The single earning path for the app's one currency — every study action (tasks, AI sessions, focus sprints) grants real, spendable Nexus Points, and the same amount also feeds lib/motivation.ts's level/streak/achievement tracking. There is no separate "XP" pool that goes nowhere. */
  const earnNexusPoints = (amount: number, description: string, actionId: string) => {
    if (rewardedActions.includes(actionId) || !Number.isFinite(amount) || amount <= 0) return
    setRewardedActions((current) => [...current, actionId])
    setNexusPoints((points) => points + amount)
    setTransactions((current) => [createTransaction('earned', amount, description), ...current])
    notify(`+${amount} Nexus Points · ${description}`, 'success')

    const result = recordMotivationActivity(authUser.id, { id: actionId, points: amount, description })
    if (result.recorded) {
      const stats = getMotivationStats(result.state)
      fetch('/api/profile/stats-sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lifetimePoints: result.state.lifetimePoints,
          currentStreakDays: stats.currentStreak,
          longestStreakDays: stats.longestStreak,
        }),
      }).catch(() => undefined)
    }
    if (result.celebration) {
      setMotivationCelebration(result.celebration)
      window.setTimeout(() => {
        setMotivationCelebration((current) => current === result.celebration ? null : current)
      }, 4200)
    }
  }

  const redeemReward = (reward: { id: string; name: string; cost: number }) => {
    if (redeemedRewards.includes(reward.id)) return
    if (nexusPoints < reward.cost) {
      notify('You need more Nexus Points for this reward', 'warning')
      return
    }
    setNexusPoints((points) => points - reward.cost)
    setTransactions((current) => [createTransaction('spent', reward.cost, reward.name), ...current])
    setRedeemedRewards((current) => [...current, reward.id])
    const cosmetic = getCosmetic(reward.id)
    if (cosmetic?.category === 'avatar') setEquippedAvatar(reward.id)
    else if (cosmetic?.category === 'badge') setEquippedBadge(reward.id)
    notify(reward.name + ' unlocked', 'success')
  }

  const equipCosmetic = (category: CosmeticCategory, id: string | null) => {
    if (id && !redeemedRewards.includes(id)) return
    if (category === 'avatar') setEquippedAvatar(id)
    else setEquippedBadge(id)
  }

  const equippedBadgeCosmetic = getCosmetic(equippedBadge)

  return (
    <div className={cn('relative flex h-[var(--app-height,100dvh)] w-full overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:h-dvh lg:pb-0', focusMode && 'focus-mode')}>
      <AppSidebar
        active={activeSection}
        activeRoomId={activeRoomId}
        plan={plan}
        nexusPoints={nexusPoints}
        profileName={profileName}
        motivationUserId={authUser.id}
        avatarGradient={avatarGradientFor(equippedAvatar)}
        badge={getCosmetic(equippedBadge)}
        mobileOpen={sidebarOpen}
        desktopCollapsed={sidebarCollapsed}
        onCloseMobile={() => setSidebarOpen(false)}
        onToggleDesktopCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)}
        onNavigate={navigate}
        onSelectRoom={(roomId) => {
          setActiveRoomId(roomId)
          setActiveSection('Collaboration Rooms')
          setMainChatOpen(false)
          setSidebarOpen(false)
          openContextPanel()
        }}
        onCreateRoom={() => {
          setActiveSection('Collaboration Rooms')
          setMainChatOpen(false)
          notify('New room composer opened', 'success')
        }}
        onUpgrade={() => navigate('Marketplace')}
        onProfile={() => setDialog('profile')}
        onBackToWebsite={() => window.location.assign('/')}
      />

      <Workspace
        activeSection={activeSection}
        mainChatOpen={mainChatOpen}
        onOpenMainChat={openMainChat}
        onCloseMainChat={closeMainChat}
        activeDocId={activeDocId}
        onOpenDoc={setActiveDocId}
        onOpenSidebar={openSidebarPanel}
        onOpenContext={openContextPanel}
        onOpenRoom={(roomId) => {
          setActiveRoomId(roomId)
          openContextPanel()
        }}
        onNavigate={navigate}
        notify={notify}
        profileName={profileName}
        motivationUserId={authUser.id}
        plan={plan}
        nexusPoints={nexusPoints}
        planExpiry={planExpiry}
        autoSpeak={autoSpeak}
        redeemedRewards={redeemedRewards}
        equippedAvatar={equippedAvatar}
        equippedBadge={equippedBadge}
        transactions={transactions}
        onSelectFree={selectFreePlan}
        onPayWithCard={purchasePlanWithCard}
        onPayWithPoints={purchasePlanWithPoints}
        onRedeemReward={redeemReward}
        onEquipCosmetic={equipCosmetic}
        onRequestUpgrade={requestUpgrade}
        streakRewardClaimed={streakRewardClaimed}
        onClaimStreakReward={claimStreakReward}
        onEarnNexusPoints={earnNexusPoints}
      />

      <ContextPanel
        roomId={activeRoomId}
        docId={activeDocId}
        mobileOpen={contextOpen}
        desktopCollapsed={contextCollapsed}
        onCloseMobile={() => setContextOpen(false)}
        onToggleDesktopCollapse={() => setContextCollapsed((collapsed) => !collapsed)}
        notify={notify}
        isPlus={plan !== 'Free'}
        autoSpeak={autoSpeak}
        onRequestUpgrade={requestUpgrade}
        onEarnNexusPoints={earnNexusPoints}
      />

      <MobileBottomNav
        activeSection={activeSection}
        chatOpen={mainChatOpen}
        menuOpen={sidebarOpen}
        contextOpen={contextOpen}
        onNavigate={navigate}
        onOpenChat={openMainChat}
        onOpenMenu={() => setSidebarOpen(true)}
        onCloseMenu={() => setSidebarOpen(false)}
        onOpenContext={() => setContextOpen(true)}
        onCloseContext={() => setContextOpen(false)}
      />

      {(sidebarOpen || contextOpen) && (
        <button
          type="button"
          aria-label="Close open panel"
          onClick={() => {
            setSidebarOpen(false)
            setContextOpen(false)
          }}
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <Modal open={dialog === 'upgrade-required'} title="Upgrade Required" description={upgradeRequirement.feature + ' is available on ' + upgradeRequirement.plan + '.'} onClose={() => setDialog(null)}>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setDialog(null)} className="secondary-action">Maybe Later</button>
          <button
            type="button"
            onClick={() => {
              setDialog(null)
              setActiveSection('Marketplace')
              setMainChatOpen(false)
            }}
            className="primary-action"
          >
            Upgrade
          </button>
        </div>
      </Modal>


      <Modal open={dialog === 'insufficient-points'} title="Insufficient Nexus Points" description={'You need ' + pointsShortfall.toLocaleString() + ' more Nexus Points to purchase this plan.'} onClose={() => setDialog(null)}>
        <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
          Your current balance is {nexusPoints.toLocaleString()} Nexus Points. Keep completing study actions or choose Pay with Card.
        </div>
        <button type="button" onClick={() => setDialog(null)} className="secondary-action mt-4 w-full">Back to Marketplace</button>
      </Modal>
      <Modal open={dialog === 'profile'} title="Profile & workspace settings" description="Your account, plan, rewards, and preferences are saved on this device." onClose={() => { setDialog(null); syncDisplayName() }}>
        <label className="form-label" htmlFor="profile-name">Display name</label>
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <UserRound className="size-5 text-zinc-300" />
          <input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white', avatarGradientFor(equippedAvatar))}>{profileName.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{profileName}</p>
              {equippedBadgeCosmetic && <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide', equippedBadgeCosmetic.badgeClassName)}>{equippedBadgeCosmetic.badgeLabel}</span>}
            </div>
            <p className="truncate text-xs text-slate-500">{authUser.email}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">{authUser.role === 'owner' ? 'Owner account' : 'Member account'}</p>
          </div>
          <button type="button" onClick={signOut} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/8 hover:text-white">Sign out</button>
        </div>
        <div className="mt-4 rounded-2xl border border-white/15 bg-white/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Current plan</p>
              <p className="mt-1 font-semibold text-white">{plan} · {PLAN_DETAILS[plan].price}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Current Nexus Points</p>
              <p className="mt-1 flex items-center justify-end gap-1.5 text-sm font-semibold text-white"><Coins className="size-4" />{nexusPoints.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
            <span>Nexus Points progress</span>
            <span>{nexusPoints.toLocaleString()} / 5,000</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-label="Nexus Points progress" aria-valuemin={0} aria-valuemax={5000} aria-valuenow={Math.min(nexusPoints, 5000)}>
            <div className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-white" style={{ width: Math.min(100, nexusPoints / 50) + '%' }} />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.035] px-3 py-2 text-xs">
            <span className="text-slate-500">Plan expiry</span>
            <span className="font-medium text-slate-200">{formatPlanExpiry(planExpiry)}</span>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setDialog(null)
                setActiveSection('Marketplace')
                setMainChatOpen(false)
              }}
              className="secondary-action flex-1"
            >
              {plan === 'Premium' ? 'View Marketplace' : 'Upgrade plan'}
            </button>
            {hasStripeSubscription && (
              <button type="button" disabled={billingBusy} onClick={() => void openBillingPortal()} className="secondary-action flex-1 disabled:cursor-wait disabled:opacity-60">
                {billingBusy ? 'Opening…' : 'Manage billing'}
              </button>
            )}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <SettingToggle icon={Bell} label="Workspace notifications" checked={notificationsEnabled} onChange={setNotificationsEnabled} />
          <SettingToggle icon={ShieldCheck} label="Focus mode" checked={focusMode} onChange={setFocusMode} />
          <SettingToggle icon={Volume2} label="Speak AI responses automatically" checked={plan !== 'Free' && autoSpeak} onChange={(checked) => plan === 'Free' ? requestUpgrade('Text-to-Speech', 'Plus') : setAutoSpeak(checked)} />
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">School connection check</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Tests HTTPS, microphone support, local API access, and Groq connectivity without exposing your API key.</p>
            </div>
            <button type="button" disabled={connectionChecking} onClick={() => void runSchoolConnectionCheck()} className="secondary-action shrink-0 disabled:cursor-wait disabled:opacity-60">
              {connectionChecking ? 'Checking...' : 'Run check'}
            </button>
          </div>
          {connectionCheck && (
            <div className="mt-4 space-y-2">
              <ConnectionRow ok={connectionCheck.browser.secureContext} label="Secure page" detail={connectionCheck.browser.secureContext ? connectionCheck.browser.origin : 'Open the HTTPS local address, not HTTP.'} />
              <ConnectionRow ok={connectionCheck.browser.microphoneApi} label="Microphone API" detail={connectionCheck.browser.microphoneApi ? 'Browser microphone API is available.' : 'This browser or school policy is hiding microphone access.'} />
              <ConnectionRow ok={connectionCheck.browser.speechRecognitionApi} label="Voice-to-text API" detail={connectionCheck.browser.speechRecognitionApi ? 'Speech recognition is available.' : 'Use Chrome/Edge or check if school policy blocks speech recognition.'} />
              {connectionCheck.diagnostics?.checks?.groq ? (
                <ConnectionRow ok={connectionCheck.diagnostics.checks.groq.ok} label="Groq AI provider" detail={connectionCheck.diagnostics.checks.groq.message} />
              ) : (
                <ConnectionRow ok={false} label="Local API" detail={connectionCheck.error ?? 'Waiting for diagnostics...'} />
              )}
              {connectionCheck.diagnostics?.guidance && <p className="rounded-xl border border-orange-300/15 bg-orange-400/[0.06] p-3 text-xs leading-5 text-orange-100">{connectionCheck.diagnostics.guidance}</p>}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setDialog(null)
            notify('Profile settings saved', 'success')
          }}
          className="primary-action mt-5 w-full"
        >
          Save settings
        </button>
      </Modal>


      {motivationCelebration && (
        <div role="status" className="pointer-events-none fixed left-1/2 top-5 z-[125] w-[min(92vw,380px)] -translate-x-1/2">
          <div className="glass-strong animate-toast-in flex items-center gap-3 rounded-2xl border-white/25 px-4 py-3 shadow-2xl shadow-black/25">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white"><Sparkles className="size-5" /></span>
            <div><p className="text-sm font-semibold text-white">{motivationCelebration.title}</p><p className="mt-0.5 text-xs text-slate-400">{motivationCelebration.detail}</p></div>
          </div>
        </div>
      )}

      <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed bottom-5 left-1/2 z-[120] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={cn(
              'glass-strong animate-toast-in rounded-2xl px-4 py-3 text-sm shadow-xl',
              notice.tone === 'success' && 'border-emerald-400/25 text-emerald-100',
              notice.tone === 'warning' && 'border-amber-400/25 text-amber-100',
            )}
          >
            {notice.message}
          </div>
        ))}
      </div>
    </div>
  )
}

function ConnectionRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-black/20 p-3">
      <span className={cn('mt-0.5 size-2.5 shrink-0 rounded-full', ok ? 'bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.55)]' : 'bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,.45)]')} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-200">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{detail}</span>
      </span>
    </div>
  )
}

function SettingToggle({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: typeof Bell
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-3">
      <Icon className="size-4 text-zinc-300" />
      <span className="flex-1 text-sm">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
      <span aria-hidden="true" className={cn('flex h-6 w-11 items-center rounded-full p-0.5 transition', checked ? 'bg-white' : 'bg-white/15')}>
        <span className={cn('size-5 rounded-full shadow transition-transform', checked ? 'translate-x-5 bg-black' : 'bg-white')} />
      </span>
    </label>
  )
}

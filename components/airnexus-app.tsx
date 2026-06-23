'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, Coins, Copy, Crown, Link2, Mail, Settings, ShieldCheck, Sparkles, UserRound, Volume2 } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { ContextPanel } from '@/components/context-panel'
import { Workspace } from '@/components/workspace'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { formatPlanExpiry, PLAN_DETAILS, type NexusPlan } from '@/lib/plans'
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

export type AppDialog = 'upgrade' | 'upgrade-required' | 'insufficient-points' | 'profile' | 'share' | 'history' | null
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
const historyItems = [
  { id: 1, label: 'Auto-save', detail: 'Updated launch milestones', time: '2 min ago' },
  { id: 2, label: 'Parth Nair', detail: 'Edited the executive summary', time: '18 min ago' },
  { id: 3, label: 'Elena M.', detail: 'Added enterprise LOI targets', time: 'Yesterday' },
]

type AirGPTAppProps = {
  authUser: AuthSession
  onSignOut: () => void
}

export function AirGPTApp({ authUser, onSignOut }: AirGPTAppProps) {
  const profileStorageKey = `${PROFILE_STORAGE_KEY}:${authUser.id}`
  const rewardsStorageKey = `${NEXUS_REWARDS_STORAGE_KEY}:${authUser.id}`
  const streakStorageKey = `${STREAK_REWARD_STORAGE_KEY}:${authUser.id}`
  const [activeSection, setActiveSection] = useState('Documents')
  const [mainChatOpen, setMainChatOpen] = useState(false)
  const [activeRoom, setActiveRoom] = useState('Product Launch Q4')
  const [dialog, setDialog] = useState<AppDialog>(null)
  const [plan, setPlan] = useState<NexusPlan>('Free')
  const [selectedPlan, setSelectedPlan] = useState<NexusPlan>('Plus')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [contextCollapsed, setContextCollapsed] = useState(false)
  const [notices, setNotices] = useState<Array<{ id: number; message: string; tone: NoticeTone }>>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [profileName, setProfileName] = useState(authUser.name)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [nexusPoints, setNexusPoints] = useState(0)
  const [redeemedRewards, setRedeemedRewards] = useState<string[]>([])
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
      setSelectedPlan(nextPlan)
      setPlanExpiry(expired ? null : savedExpiry)
      setRedeemedRewards(stored?.redeemedRewards ?? [])
      setRewardedActions(stored?.rewardedActions ?? [])
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
    }
    window.localStorage.setItem(rewardsStorageKey, JSON.stringify(state))
  }, [lastDailyLogin, nexusPoints, plan, planExpiry, redeemedRewards, rewardedActions, rewardsHydrated, rewardsStorageKey, transactions])

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

  const requestUpgrade = (feature: string, requiredPlan: Exclude<NexusPlan, 'Free'>) => {
    setUpgradeRequirement({ feature, plan: requiredPlan })
    setSelectedPlan(requiredPlan)
    setDialog('upgrade-required')
    setSidebarOpen(false)
  }

  const navigate = (section: string) => {
    if (section === 'Settings') {
      setDialog('profile')
      setSidebarOpen(false)
      return
    }
    const requiredPlan = section === 'Analytics' ? 'Plus' : section === 'Integrations' ? 'Premium' : null
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

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText('https://nexuspoint.local/share/q4-product-launch')
      notify('Workspace link copied', 'success')
    } catch {
      notify('Clipboard access is unavailable in this browser', 'warning')
    }
  }

  const sendInvite = () => {
    const email = inviteEmail.trim()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      notify('Enter a valid email address', 'warning')
      return
    }
    notify('Invitation prepared for ' + email, 'success')
    setInviteEmail('')
  }

  const selectFreePlan = () => {
    setPlan('Free')
    setSelectedPlan('Free')
    setPlanExpiry(null)
    setDialog(null)
    notify('Free plan is now active', 'success')
  }

  const activatePaidPlan = (nextPlan: Exclude<NexusPlan, 'Free'>, payment: 'card' | 'points') => {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + 30)
    const expiryIso = expiry.toISOString()
    setPlan(nextPlan)
    setSelectedPlan(nextPlan)
    setPlanExpiry(expiryIso)
    setDialog(null)
    notify(
      nextPlan + ' activated with ' + (payment === 'points' ? 'Nexus Points' : 'card') + ' until ' + formatPlanExpiry(expiryIso),
      'success',
    )
  }

  const purchasePlanWithCard = (nextPlan: Exclude<NexusPlan, 'Free'>) => {
    activatePaidPlan(nextPlan, 'card')
  }

  const purchasePlanWithPoints = (nextPlan: Exclude<NexusPlan, 'Free'>) => {
    const cost = PLAN_DETAILS[nextPlan].points
    if (!canRedeem(nexusPoints, cost)) {
      setPointsShortfall(cost - nexusPoints)
      setDialog('insufficient-points')
      return
    }
    setNexusPoints((points) => points - cost)
    setTransactions((current) => [createTransaction('spent', cost, `${nextPlan} plan · 30 days`), ...current])
    activatePaidPlan(nextPlan, 'points')
  }

  const completeUpgrade = () => {
    if (selectedPlan === 'Free') selectFreePlan()
    else purchasePlanWithCard(selectedPlan)
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
      const response = await fetch('/api/diagnostics', { cache: 'no-store' })
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
    setStreakRewardClaimed(true)
    setNexusPoints((points) => points + 150)
    setTransactions((current) => [createTransaction('earned', 150, '7-day learning streak'), ...current])
    window.localStorage.setItem(streakStorageKey, 'claimed')
    notify('7-day streak reward claimed: +150 Nexus Points', 'success')
  }
  const earnNexusPoints = (amount: number, description: string, actionId: string) => {
    if (rewardedActions.includes(actionId) || !Number.isFinite(amount) || amount <= 0) return
    setRewardedActions((current) => [...current, actionId])
    setNexusPoints((points) => points + amount)
    setTransactions((current) => [createTransaction('earned', amount, description), ...current])
    notify(`+${amount} Nexus Points · ${description}`, 'success')
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
    notify(reward.name + ' unlocked', 'success')
  }

  return (
    <div className={cn('relative flex h-dvh w-full overflow-hidden', focusMode && 'focus-mode')}>
      <AppSidebar
        active={activeSection}
        activeRoom={activeRoom}
        plan={plan}
        nexusPoints={nexusPoints}
        profileName={profileName}
        mobileOpen={sidebarOpen}
        desktopCollapsed={sidebarCollapsed}
        onCloseMobile={() => setSidebarOpen(false)}
        onToggleDesktopCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)}
        onNavigate={navigate}
        onSelectRoom={(room) => {
          setActiveRoom(room)
          setActiveSection('Collaboration Rooms')
          setMainChatOpen(false)
          setSidebarOpen(false)
          notify('Opened ' + room)
        }}
        onCreateRoom={() => {
          setActiveSection('Collaboration Rooms')
          setMainChatOpen(false)
          notify('New room composer opened', 'success')
        }}
        onUpgrade={() => setDialog('upgrade')}
        onProfile={() => setDialog('profile')}
        onBackToWebsite={() => window.location.assign('/')}
      />

      <Workspace
        activeSection={activeSection}
        mainChatOpen={mainChatOpen}
        onOpenMainChat={openMainChat}
        onCloseMainChat={closeMainChat}
        onOpenSidebar={openSidebarPanel}
        onOpenContext={openContextPanel}
        onNavigate={navigate}
        onOpenDialog={setDialog}
        notify={notify}
        plan={plan}
        nexusPoints={nexusPoints}
        planExpiry={planExpiry}
        autoSpeak={autoSpeak}
        redeemedRewards={redeemedRewards}
        transactions={transactions}
        onSelectFree={selectFreePlan}
        onPayWithCard={purchasePlanWithCard}
        onPayWithPoints={purchasePlanWithPoints}
        onRedeemReward={redeemReward}
        onRequestUpgrade={requestUpgrade}
        streakRewardClaimed={streakRewardClaimed}
        onClaimStreakReward={claimStreakReward}
        onEarnNexusPoints={earnNexusPoints}
      />

      <ContextPanel
        activeRoom={activeRoom}
        mobileOpen={contextOpen}
        desktopCollapsed={contextCollapsed}
        onCloseMobile={() => setContextOpen(false)}
        onToggleDesktopCollapse={() => setContextCollapsed((collapsed) => !collapsed)}
        notify={notify}
        isPlus={plan !== 'Free'}
        autoSpeak={autoSpeak}
        onRequestUpgrade={requestUpgrade}
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

      <Modal open={dialog === 'upgrade'} title="Choose your AirGPT plan" description="Select the plan for this workspace." onClose={() => setDialog(null)} className="max-w-2xl">
        <div className="grid gap-3 sm:grid-cols-3">
          {(['Free', 'Plus', 'Premium'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={selectedPlan === option}
              onClick={() => setSelectedPlan(option)}
              className={cn(
                'rounded-2xl border p-4 text-left transition',
                selectedPlan === option
                  ? 'border-orange-300/50 bg-orange-500/15 shadow-lg shadow-orange-500/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10',
              )}
            >
              <div className="flex items-center justify-between">
                {option === 'Premium' ? <Crown className="size-5 text-amber-300" /> : option === 'Plus' ? <Sparkles className="size-5 text-orange-300" /> : <UserRound className="size-5 text-slate-300" />}
                {selectedPlan === option && <Check className="size-4 text-emerald-300" />}
              </div>
              <p className="mt-4 font-semibold">{option}</p>
              <p className="mt-1 text-xs text-muted-foreground">{PLAN_DETAILS[option].price}</p>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">{PLAN_DETAILS[option].summary}</p>
            </button>
          ))}
        </div>
        <button type="button" onClick={completeUpgrade} className="primary-action mt-5 w-full">
          {selectedPlan === plan ? 'Keep ' + plan : selectedPlan === 'Premium' ? 'Get Premium' : selectedPlan === 'Plus' ? 'Upgrade to Plus' : 'Switch to Free'}
        </button>
      </Modal>

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
      <Modal open={dialog === 'profile'} title="Profile & workspace settings" description="Your account, plan, rewards, and preferences are saved on this device." onClose={() => setDialog(null)}>
        <label className="form-label" htmlFor="profile-name">Display name</label>
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <UserRound className="size-5 text-orange-300" />
          <input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-400 text-sm font-bold text-white">{profileName.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profileName}</p>
            <p className="truncate text-xs text-slate-500">{authUser.email}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-orange-300">{authUser.role === 'owner' ? 'Owner account' : 'Member account'}</p>
          </div>
          <button type="button" onClick={signOut} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/8 hover:text-white">Sign out</button>
        </div>
        <div className="mt-4 rounded-2xl border border-orange-300/15 bg-orange-400/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Current plan</p>
              <p className="mt-1 font-semibold text-orange-100">{plan} · {PLAN_DETAILS[plan].price}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Current Nexus Points</p>
              <p className="mt-1 flex items-center justify-end gap-1.5 text-sm font-semibold text-amber-200"><Coins className="size-4" />{nexusPoints.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
            <span>Nexus Points progress</span>
            <span>{nexusPoints.toLocaleString()} / 5,000</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-label="Nexus Points progress" aria-valuemin={0} aria-valuemax={5000} aria-valuenow={Math.min(nexusPoints, 5000)}>
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-300" style={{ width: Math.min(100, nexusPoints / 50) + '%' }} />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.035] px-3 py-2 text-xs">
            <span className="text-slate-500">Plan expiry</span>
            <span className="font-medium text-slate-200">{formatPlanExpiry(planExpiry)}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDialog(null)
              setActiveSection('Marketplace')
              setMainChatOpen(false)
            }}
            className="secondary-action mt-4 w-full"
          >
            {plan === 'Premium' ? 'View Marketplace' : 'Upgrade plan'}
          </button>
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

      <Modal open={dialog === 'share'} title="Share strategy brief" description="Invite collaborators or copy a workspace link." onClose={() => setDialog(null)}>
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="Collaborator email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendInvite()
              }}
              placeholder="name@example.com"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
            />
          </div>
          <button type="button" onClick={sendInvite} className="primary-action px-4">Invite</button>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
          <Link2 className="ml-2 size-4 shrink-0 text-orange-300" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">https://nexuspoint.local/share/q4-product-launch</span>
          <button type="button" onClick={copyShareLink} aria-label="Copy workspace link" className="interactive-icon">
            <Copy className="size-4" />
          </button>
        </div>
      </Modal>

      <Modal open={dialog === 'history'} title="Version history" description="Review recent saves and restore a snapshot." onClose={() => setDialog(null)}>
        <div className="space-y-2">
          {historyItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-200">
                <Settings className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDialog(null)
                  notify('Restored snapshot from ' + item.time, 'success')
                }}
                className="rounded-lg px-2 py-1 text-xs text-orange-300 hover:bg-orange-300/10"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      </Modal>

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
      <Icon className="size-4 text-orange-300" />
      <span className="flex-1 text-sm">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
      <span aria-hidden="true" className={cn('flex h-6 w-11 items-center rounded-full p-0.5 transition', checked ? 'bg-orange-500' : 'bg-white/15')}>
        <span className={cn('size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </span>
    </label>
  )
}

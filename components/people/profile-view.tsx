'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Award, Flame, Swords, Trophy, UserMinus, UserPlus } from 'lucide-react'
import { deriveApexRank } from '@/lib/apex/config'
import { deriveFriendshipState } from '@/lib/airnexus/relationship-state'
import { loadMotivationState, getMotivationStats } from '@/lib/motivation'
import { cn } from '@/lib/utils'

type NoticeTone = 'success' | 'info' | 'warning'

type PublicProfile = {
  userId: string
  displayName: string
  apexXp: number
  lifetimeXp: number
  currentStreakDays: number
  longestStreakDays: number
  statsSyncedAt: string | null
  isFriend: boolean
  isFollowing: boolean
  isFollowedBy: boolean
  friendshipStatus: 'pending' | 'accepted' | null
  followerCount: number
  followingCount: number
}
type ApexAchievement = { slug: string; name: string; description: string; earned: boolean; earnedAt: string | null }

type ProfileViewProps = {
  userId: string
  notify: (message: string, tone?: NoticeTone) => void
  onNavigate: (section: string) => void
  onBack: () => void
}

export function ProfileView({ userId, notify, onNavigate, onBack }: ProfileViewProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [achievements, setAchievements] = useState<ApexAchievement[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [profileResponse, sessionResponse] = await Promise.all([
      fetch(`/api/social/profile/${userId}`, { credentials: 'include', cache: 'no-store' }),
      fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' }),
    ])
    if (profileResponse.ok) {
      const data = (await profileResponse.json()) as { profile: PublicProfile; achievements: ApexAchievement[] }
      setProfile(data.profile)
      setAchievements(data.achievements)
    }
    if (sessionResponse.ok) {
      const data = (await sessionResponse.json()) as { session: { id: string } | null }
      setMyUserId(data.session?.id ?? null)
    }
  }, [userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const toggleFollow = async () => {
    if (!profile) return
    setBusy(true)
    try {
      const response = await fetch(`/api/social/follow/${userId}`, { method: profile.isFollowing ? 'DELETE' : 'POST', credentials: 'include' })
      if (!response.ok) {
        notify('Could not update follow status.', 'warning')
        return
      }
      setProfile((current) => current && { ...current, isFollowing: !current.isFollowing, followerCount: current.followerCount + (current.isFollowing ? -1 : 1) })
    } finally {
      setBusy(false)
    }
  }

  const addFriend = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/social/friends', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        notify(data?.error ?? 'Could not send friend request.', 'warning')
        return
      }
      notify('Friend request sent', 'success')
      void load()
    } finally {
      setBusy(false)
    }
  }

  if (!profile) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <BackLink onBack={onBack} />
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    )
  }

  const rank = deriveApexRank(profile.apexXp)
  const isSelf = myUserId === profile.userId
  const myState = !isSelf && myUserId ? loadMotivationState(myUserId) : null
  const myStats = myState ? getMotivationStats(myState) : null
  const relationship = deriveFriendshipState(profile.isFriend, profile.friendshipStatus)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink onBack={onBack} />

      <div className="glass rounded-3xl p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700 text-2xl font-bold text-white">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-white">{profile.displayName}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{rank.label} · {profile.followerCount} follower{profile.followerCount === 1 ? '' : 's'} · {profile.followingCount} following</p>
          </div>
          {!isSelf && (
            <div className="flex shrink-0 gap-2">
              <button type="button" disabled={busy} onClick={() => void toggleFollow()} className="secondary-action px-3 py-1.5 text-xs">
                {profile.isFollowing ? <UserMinus className="size-3.5" /> : <UserPlus className="size-3.5" />}
                {profile.isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              {relationship === 'friends' ? (
                <button type="button" onClick={() => onNavigate('Apex')} className="primary-action px-3 py-1.5 text-xs">
                  <Swords className="size-3.5" /> Challenge to Breach
                </button>
              ) : relationship === 'pending' ? (
                <span className="secondary-action px-3 py-1.5 text-xs opacity-60">Request pending</span>
              ) : (
                <button type="button" disabled={busy} onClick={() => void addFriend()} className="primary-action px-3 py-1.5 text-xs">
                  <UserPlus className="size-3.5" /> Add Friend
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Trophy className="size-4" />} label="Clash XP" value={profile.apexXp.toLocaleString()} note={rank.label} />
        <StatCard icon={<Award className="size-4" />} label="Lifetime XP" value={profile.lifetimeXp.toLocaleString()} note={profile.statsSyncedAt ? 'Self-reported' : 'Not synced yet'} />
        <StatCard icon={<Flame className="size-4" />} label="Study streak" value={`${profile.currentStreakDays}d`} note={`Best: ${profile.longestStreakDays}d · self-reported`} />
      </div>

      {myStats && myState && (
        <div className="glass rounded-2xl p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Compare — you vs {profile.displayName}</h2>
          <p className="mt-1 text-[11px] text-white/40">Self-reported study stats only — your Apex Clash XP/rank is on your Dashboard.</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <CompareStat label="Lifetime XP" mine={myState.lifetimeXp} theirs={profile.lifetimeXp} />
            <CompareStat label="Current streak" mine={myStats.currentStreak} theirs={profile.currentStreakDays} suffix="d" />
            <CompareStat label="Best streak" mine={myStats.longestStreak} theirs={profile.longestStreakDays} suffix="d" />
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Award className="size-4" /> Achievements</h2>
          <span className="text-xs text-muted-foreground">{achievements.filter((item) => item.earned).length} / {achievements.length}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {achievements.map((item) => (
            <div key={item.slug} title={item.description} className={cn('flex flex-col items-center gap-1 rounded-xl border p-2 text-center', item.earned ? 'border-white/25 bg-white/10' : 'border-white/8 bg-white/[0.02] opacity-40')}>
              <Award className="size-4 text-white/80" />
              <span className="text-[9px] font-medium leading-tight text-white/80">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">{icon} {label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-white/40">{note}</p>
    </div>
  )
}

function CompareStat({ label, mine, theirs, suffix = '' }: { label: string; mine: number; theirs: number; suffix?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5 text-center">
      <p className="text-[10px] text-white/45">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{mine.toLocaleString()}{suffix}</p>
      <p className="text-[10px] text-white/35">vs {theirs.toLocaleString()}{suffix}</p>
    </div>
  )
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-white">
      <ArrowLeft className="size-4" /> Back to People
    </button>
  )
}

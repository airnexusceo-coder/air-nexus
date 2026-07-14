'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Search, UserCheck, UserPlus, Users, X } from 'lucide-react'
import { deriveApexRank } from '@/lib/apex/config'
import { deriveFriendshipState } from '@/lib/airnexus/relationship-state'
import { cn } from '@/lib/utils'
import { ProfileView } from './profile-view'

type NoticeTone = 'success' | 'info' | 'warning'

type PeopleHubProps = {
  notify: (message: string, tone?: NoticeTone) => void
  onNavigate: (section: string) => void
}

type SearchResult = { userId: string; displayName: string; apexXp: number; isFriend: boolean; isFollowing: boolean; friendshipStatus: 'pending' | 'accepted' | null }
type FriendRow = { user_id: string; display_name: string; apex_xp: number; allow_nexus_challenges: boolean }
type RequestRow = { id: string; direction: 'incoming' | 'outgoing'; other_user_id: string; display_name: string; status: string; created_at: string }

type Tab = 'search' | 'friends' | 'requests'

export function PeopleHub({ notify, onNavigate }: PeopleHubProps) {
  const [tab, setTab] = useState<Tab>('search')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const [emailQuery, setEmailQuery] = useState('')
  const [lookedUpEmail, setLookedUpEmail] = useState('')
  const [result, setResult] = useState<SearchResult | null | undefined>(undefined)
  const [searching, setSearching] = useState(false)

  const [friends, setFriends] = useState<FriendRow[] | null>(null)
  const [requests, setRequests] = useState<RequestRow[] | null>(null)

  const loadFriends = useCallback(async () => {
    const response = await fetch('/api/social/friends', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setFriends(((await response.json()) as { friends: FriendRow[] }).friends)
  }, [])

  const loadRequests = useCallback(async () => {
    const response = await fetch('/api/social/friends/requests', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setRequests(((await response.json()) as { requests: RequestRow[] }).requests)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadFriends()
      void loadRequests()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadFriends, loadRequests])

  const lookupByEmail = useCallback(async () => {
    const trimmed = emailQuery.trim()
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      notify('Enter a valid email address.', 'info')
      return
    }
    setSearching(true)
    try {
      const response = await fetch(`/api/social/search?email=${encodeURIComponent(trimmed)}`, { credentials: 'include', cache: 'no-store' })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        notify(data?.error ?? 'Search failed.', 'warning')
        return
      }
      setLookedUpEmail(trimmed)
      setResult(((await response.json()) as { result: SearchResult | null }).result)
    } finally {
      setSearching(false)
    }
  }, [emailQuery, notify])

  const sendRequest = async (email: string) => {
    const response = await fetch('/api/social/friends', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null
      notify(data?.error ?? 'Could not send friend request.', 'warning')
      return
    }
    notify('Friend request sent', 'success')
    setResult((current) => current ? { ...current, friendshipStatus: 'pending' } : current)
    void loadRequests()
  }

  const respondRequest = async (id: string, action: 'accept' | 'block') => {
    const response = await fetch(`/api/social/friends/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (response.ok) {
      notify(action === 'accept' ? 'Friend request accepted' : 'Request declined', 'success')
      void loadRequests()
      void loadFriends()
    } else {
      notify('Could not update request.', 'warning')
    }
  }

  if (selectedUserId) {
    return (
      <ProfileView
        userId={selectedUserId}
        notify={notify}
        onNavigate={onNavigate}
        onBack={() => { setSelectedUserId(null); void loadFriends(); void loadRequests() }}
      />
    )
  }

  const incoming = (requests ?? []).filter((request) => request.direction === 'incoming')
  const outgoing = (requests ?? []).filter((request) => request.direction === 'outgoing')

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">People</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find other AirNexus students, follow them, and connect as friends.</p>
      </header>

      <div className="flex gap-2">
        <TabButton active={tab === 'search'} onClick={() => setTab('search')} icon={<Search className="size-3.5" />} label="Search" />
        <TabButton active={tab === 'friends'} onClick={() => setTab('friends')} icon={<Users className="size-3.5" />} label={`Friends${friends ? ` (${friends.length})` : ''}`} />
        <TabButton active={tab === 'requests'} onClick={() => setTab('requests')} icon={<UserPlus className="size-3.5" />} label={`Requests${incoming.length > 0 ? ` (${incoming.length})` : ''}`} />
      </div>

      {tab === 'search' && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <input
              type="email"
              value={emailQuery}
              onChange={(event) => setEmailQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void lookupByEmail() }}
              placeholder="Find a student by their email…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/50"
            />
            <button type="button" disabled={searching || !emailQuery.trim()} onClick={() => void lookupByEmail()} className="primary-action px-4 text-xs">
              <Search className="size-3.5" /> Find
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Students can only be found by their exact email — not by name — to keep real names private.</p>

          {result === undefined ? (
            <p className="text-sm text-muted-foreground">Enter a student&apos;s full email address to find them.</p>
          ) : result === null ? (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">No student found for &quot;{lookedUpEmail}&quot;.</p>
          ) : (
            <SearchResultRow result={result} onOpen={() => setSelectedUserId(result.userId)} onAddFriend={() => void sendRequest(lookedUpEmail)} />
          )}
        </div>
      )}

      {tab === 'friends' && (
        friends == null ? (
          <p className="text-sm text-muted-foreground">Loading friends…</p>
        ) : friends.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">No friends yet — search for someone to connect with.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((friend) => {
              const rank = deriveApexRank(friend.apex_xp)
              return (
                <button key={friend.user_id} type="button" onClick={() => setSelectedUserId(friend.user_id)} className="glass flex items-center gap-3 rounded-2xl p-4 text-left hover:bg-white/8">
                  <Avatar name={friend.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{friend.display_name}</p>
                    <p className="text-[11px] text-muted-foreground">{rank.label} · {friend.apex_xp.toLocaleString()} Clash XP</p>
                  </div>
                </button>
              )
            })}
          </ul>
        )
      )}

      {tab === 'requests' && (
        <div className="flex flex-col gap-5">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Incoming</h2>
            {incoming.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {incoming.map((request) => (
                  <li key={request.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                    <Avatar name={request.display_name} />
                    <span className="min-w-0 flex-1 truncate text-sm text-white">{request.display_name}</span>
                    <button type="button" onClick={() => void respondRequest(request.id, 'accept')} className="interactive-icon size-8 text-emerald-300" aria-label={`Accept ${request.display_name}`}><Check className="size-4" /></button>
                    <button type="button" onClick={() => void respondRequest(request.id, 'block')} className="interactive-icon size-8 text-rose-300" aria-label={`Decline ${request.display_name}`}><X className="size-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Sent</h2>
            {outgoing.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No outgoing requests.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {outgoing.map((request) => (
                  <li key={request.id} className="glass flex items-center gap-3 rounded-2xl p-3 opacity-70">
                    <Avatar name={request.display_name} />
                    <span className="min-w-0 flex-1 truncate text-sm text-white">{request.display_name}</span>
                    <span className="text-[11px] text-muted-foreground">Pending</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function SearchResultRow({ result, onOpen, onAddFriend }: { result: SearchResult; onOpen: () => void; onAddFriend: () => void }) {
  const rank = deriveApexRank(result.apexXp)
  const relationship = deriveFriendshipState(result.isFriend, result.friendshipStatus)
  return (
    <li className="glass flex items-center gap-3 rounded-2xl p-4">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar name={result.displayName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{result.displayName}</p>
          <p className="text-[11px] text-muted-foreground">{rank.label} · {result.apexXp.toLocaleString()} Clash XP</p>
        </div>
      </button>
      {relationship === 'friends' ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300"><UserCheck className="size-3" /> Friends</span>
      ) : relationship === 'pending' ? (
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/60">Pending</span>
      ) : (
        <button type="button" onClick={onAddFriend} className="secondary-action shrink-0 px-3 py-1.5 text-[11px]"><UserPlus className="size-3" /> Add Friend</button>
      )}
    </li>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700 text-xs font-bold text-white">
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold', active ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:text-white')}>
      {icon} {label}
    </button>
  )
}

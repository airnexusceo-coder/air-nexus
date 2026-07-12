'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bell, ChevronRight, Coins, Compass, History, Info, Lock, Radar, Settings2, Shield, ShieldAlert, ShieldCheck, Swords, Trophy, Wrench, Zap } from 'lucide-react'
import { deriveApexRank } from '@/lib/apex/config'
import type { ApexTarget, DefenderActivityEntry, InstalledDefence, VaultOverview } from '@/lib/apex/vault/types'
import { cn } from '@/lib/utils'
import { NexusMark } from '@/components/brand/nexus-mark'
import { VaultCoreVisual } from './vault-core-visual'
import { ManageVault } from './manage-vault'
import { SystemsLab } from './systems-lab'
import { FindATarget } from './find-a-target'
import { BreachHistory } from './breach-history'

type NoticeTone = 'success' | 'info' | 'warning'

export type ApexHomeProps = {
  notify: (message: string, tone?: NoticeTone) => void
  nexusPoints: number
  onRedeemReward: (reward: { id: string; name: string; cost: number }) => void
}

type View = 'home' | 'manage' | 'lab' | 'targets' | 'history'
type LoadState = 'loading' | 'ready' | 'auth' | 'unconfigured' | 'error'
type ApexProgression = { xp: number; label: string; nextLabel: string | null; nextThreshold: number | null; progress: number }
type VaultWithMode = VaultOverview
type ActionTileConfig = { view: View; label: string; detail: string; icon: LucideIcon }

const TABS: { view: View; label: string; icon: LucideIcon; detail: string }[] = [
  { view: 'home', label: 'Vault', icon: Shield, detail: 'Overview' },
  { view: 'lab', label: 'Lab', icon: Zap, detail: 'Research' },
  { view: 'manage', label: 'Loadout', icon: Wrench, detail: 'Defences' },
  { view: 'targets', label: 'Targets', icon: Compass, detail: 'Scan' },
  { view: 'history', label: 'Reports', icon: History, detail: 'Logs' },
]

const ACTION_TILES: ActionTileConfig[] = [
  { view: 'manage', label: 'Manage Vault', detail: 'Configure defenses and core systems', icon: Settings2 },
  { view: 'lab', label: 'Systems Lab', detail: 'Research and upgrade technologies', icon: Zap },
  { view: 'targets', label: 'Find a Target', detail: 'Scan and locate rival vaults', icon: Radar },
  { view: 'history', label: 'Breach Reports', detail: 'Review battle logs and analytics', icon: History },
  { view: 'manage', label: 'Loadouts', detail: 'Save and equip breach loadouts', icon: Swords },
]

const ARSENAL = [
  { label: 'Signal Probe', count: 12, icon: Radar },
  { label: 'Breach Key', count: 8, icon: Lock },
  { label: 'Phase Signal', count: 9, icon: Zap },
  { label: 'True Signal', count: 6, icon: ShieldCheck },
  { label: 'Overclock', count: 5, icon: Trophy },
  { label: 'Deep Scan', count: 11, icon: Compass },
  { label: 'Emergency Extract', count: 3, icon: ChevronRight },
  { label: 'Signal Fork', count: 7, icon: Swords },
]

export function ApexHome({ notify, nexusPoints, onRedeemReward }: ApexHomeProps) {
  const [view, setView] = useState<View>('home')
  const [overview, setOverview] = useState<VaultWithMode | null>(null)
  const [progression, setProgression] = useState<ApexProgression | null>(null)
  const [alerts, setAlerts] = useState<DefenderActivityEntry[]>([])
  const [targets, setTargets] = useState<ApexTarget[]>([])
  const [state, setState] = useState<LoadState>('loading')

  const load = useCallback(async () => {
    try {
      const [vaultResponse, profileResponse, historyResponse, activityResponse, targetsResponse] = await Promise.all([
        fetch('/api/apex/vault', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/apex/profile', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/apex/breach/history', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/apex/activity', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/apex/targets', { credentials: 'include', cache: 'no-store' }),
      ])
      if (vaultResponse.status === 401) return setState('auth')
      if (vaultResponse.status === 503) return setState('unconfigured')
      if (!vaultResponse.ok) return setState('error')
      setOverview((await vaultResponse.json()) as VaultWithMode)
      if (profileResponse.ok) setProgression((await profileResponse.json()) as ApexProgression)
      if (historyResponse.ok) await historyResponse.json()
      if (activityResponse.ok) setAlerts(((await activityResponse.json()) as { activity: DefenderActivityEntry[] }).activity.slice(0, 4))
      if (targetsResponse.ok) setTargets(((await targetsResponse.json()) as { targets: ApexTarget[] }).targets.slice(0, 5))
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const goHome = () => { setView('home'); void load() }
  const changeView = (next: View) => {
    setView(next)
    if (next === 'home') void load()
  }

  if (view === 'manage') return <ApexShell tabs={<TabBar view={view} onChange={changeView} />}><ManageVault notify={notify} onBack={goHome} /></ApexShell>
  if (view === 'lab') return <ApexShell tabs={<TabBar view={view} onChange={changeView} />}><SystemsLab notify={notify} nexusPoints={nexusPoints} onRedeemReward={onRedeemReward} onBack={goHome} /></ApexShell>
  if (view === 'targets') return <ApexShell tabs={<TabBar view={view} onChange={changeView} />}><FindATarget notify={notify} onBack={goHome} /></ApexShell>
  if (view === 'history') return <ApexShell tabs={<TabBar view={view} onChange={changeView} />}><BreachHistory onBack={() => setView('home')} /></ApexShell>

  const rank = progression ? deriveApexRank(progression.xp) : null

  return (
    <ApexShell tabs={<TabBar view={view} onChange={changeView} />}>
      <section className="relative overflow-hidden rounded-lg border border-white/10 bg-black text-white shadow-2xl shadow-black/50">
        <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(to_right,rgb(255_255_255_/_0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255_/_0.045)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgb(255_255_255_/_0.08),transparent_28%,rgb(255_255_255_/_0.035)_58%,transparent)]" />
        <div className="relative flex flex-col gap-4 p-4 sm:p-5 xl:p-6">
          {state === 'ready' && overview && <TopStatBar overview={overview} progression={progression} nexusPoints={nexusPoints} rankLabel={rank?.label ?? null} />}
          {state === 'loading' && <LoadingConsole />}
          {state === 'auth' && <Notice>Sign in to load your Nexus Vault.</Notice>}
          {state === 'unconfigured' && <Notice>Apex is connected to Supabase, but its database schema is missing. Apply the Apex migrations to enable the live backend.</Notice>}
          {state === 'error' && <Notice>Apex could not load a vault snapshot yet. Refresh Apex once the local server is ready.</Notice>}
          {state === 'ready' && overview && (
            <>
              <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
                <HeroPanel overview={overview} rankLabel={rank?.label ?? 'Unranked'} />
                <VaultTopology overview={overview} />
                <RightColumn targets={targets} alerts={alerts} onTargets={() => setView('targets')} onHistory={() => setView('history')} />
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                <DefenseChain defences={overview.installedDefences} />
                <BreachArsenal onLab={() => setView('lab')} />
              </div>
              <ActionRail actions={ACTION_TILES} onChange={changeView} />
            </>
          )}
        </div>
      </section>
    </ApexShell>
  )
}
function TopStatBar({ overview, progression, nexusPoints, rankLabel }: { overview: VaultOverview; progression: ApexProgression | null; nexusPoints: number; rankLabel: string | null }) {
  const corePercent = percentOf(overview.coreEnergy, overview.energyStorageCapacity)
  const nextXp = progression?.nextThreshold ?? null
  return (
    <div className="rounded-lg border border-white/12 bg-black/55 px-3 py-2 backdrop-blur-md">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <TopStat icon={Coins} label="Nexus Points" value={formatNumber(nexusPoints || 12450)} detail="+220 /h" />
        <TopStat icon={Zap} label="Core Energy" value={`${formatPercent(corePercent)}%`} detail={`${overview.netEnergyFlowPerHour >= 0 ? '+' : ''}${overview.netEnergyFlowPerHour} /h`} />
        <TopStat icon={Trophy} label="Apex XP" value={`${formatNumber(progression?.xp ?? 0)} XP`} detail="+560 /h" />
        <TopRankStat rankLabel={rankLabel ?? 'Unranked'} xp={progression?.xp ?? 0} nextXp={nextXp} />
      </div>
    </div>
  )
}

function TopStat({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-white/10 px-2 md:border-r md:last:border-r-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06]"><Icon className="size-4 text-white/85" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{label}</span>
        <span className="block truncate text-sm font-semibold tabular-nums text-white">{value}</span>
      </span>
      <span className="text-[11px] tabular-nums text-white/55">{detail}</span>
    </div>
  )
}

function TopRankStat({ rankLabel, xp, nextXp }: { rankLabel: string; xp: number; nextXp: number | null }) {
  const progress = nextXp ? Math.min(100, (xp / nextXp) * 100) : 100
  return (
    <div className="flex min-h-12 items-center gap-3 px-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06]"><NexusMark className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Apex Rank</span>
        <span className="block truncate text-sm font-semibold text-white">{rankLabel}</span>
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-white/70" style={{ width: `${progress}%` }} /></span>
      </span>
      <span className="text-[11px] tabular-nums text-white/55">{nextXp ? `${formatNumber(xp)} / ${formatNumber(nextXp)} XP` : `${formatNumber(xp)} XP`}</span>
    </div>
  )
}

function HeroPanel({ overview, rankLabel }: { overview: VaultOverview; rankLabel: string }) {
  const corePercent = percentOf(overview.coreEnergy, overview.energyStorageCapacity)
  return (
    <div className="flex flex-col gap-4">
      <div className="min-h-[152px] px-1 pt-3">
        <h1 className="text-5xl font-semibold leading-none tracking-normal text-white sm:text-6xl">APEX</h1>
        <p className="mt-2 text-xl font-medium uppercase tracking-[0.26em] text-white/70">Nexus Vault</p>
        <p className="mt-4 max-w-56 text-sm leading-6 text-white/58">Build your Vault. Balance your Core. Breach the Nexus.</p>
      </div>
      <Panel className="p-4">
        <CoreMeter label="Core Energy" value={`${formatPercent(corePercent)}%`} percent={corePercent} icon={Zap} />
        <StatLine icon={Zap} label="Energy Output" value={`${formatNumber(overview.energyOutputPerHour)} /h`} />
        <StatLine icon={Wrench} label="System Upkeep" value={`-${formatNumber(overview.energyUpkeepPerHour)} /h`} />
        <div className="my-2 h-px bg-white/10" />
        <StatLine icon={Swords} label="Net Flow" value={`${overview.netEnergyFlowPerHour >= 0 ? '+' : ''}${formatNumber(overview.netEnergyFlowPerHour)} /h`} />
        <CoreMeter label="Vault Integrity" value={`${formatPercent(overview.vaultIntegrity)}%`} percent={overview.vaultIntegrity} icon={ShieldCheck} />
        <CoreMeter label="Defense Capacity" value={`${formatNumber(overview.defenceCapacityUsed)} / ${formatNumber(overview.defenceCapacityMax)}`} percent={percentOf(overview.defenceCapacityUsed, overview.defenceCapacityMax)} icon={Shield} />
        <button type="button" className="mt-2 flex min-h-9 w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white/72 transition hover:bg-white/[0.08]"><span>View Core Diagnostics</span><Info className="size-4" /></button>
      </Panel>
      <Panel className="p-4">
        <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Current Rank</span><span className="text-xs font-semibold text-white">{rankLabel}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/62">
          <span>Breaches: Enabled</span><span className="text-right">Auto-Repair: {overview.autoRepairEnabled ? 'Online' : 'Offline'}</span>
          <span>Reserve: {formatNumber(overview.autoRepairReserve)} CE</span><span className="text-right">Status: {overview.status}</span>
        </div>
      </Panel>
    </div>
  )
}

function VaultTopology({ overview }: { overview: VaultOverview }) {
  const ordered = [...overview.installedDefences].sort((a, b) => a.defenceOrder - b.defenceOrder)
  const nodes = ordered.slice(0, 8)
  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
      <div className="absolute inset-x-0 top-4 z-10 flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/78"><span className="h-px w-16 bg-white/28" /><span>Your Nexus Vault</span><span className="h-px w-16 bg-white/28" /></div>
      <div className="absolute inset-0 [background-image:radial-gradient(circle_at_center,rgb(255_255_255_/_0.16)_1px,transparent_1px)] [background-size:34px_34px] opacity-25" />
      <svg className="absolute inset-0 size-full" viewBox="0 0 720 560" aria-hidden="true">
        <circle cx="360" cy="292" r="152" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
        <circle cx="360" cy="292" r="106" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="5 10" />
        {NODE_POSITIONS.map((node) => <line key={`${node.x}-${node.y}`} x1="360" y1="292" x2={node.x} y2={node.y} stroke="white" strokeOpacity="0.18" strokeWidth="1" />)}
      </svg>
      <VaultCoreVisual integrityPercent={overview.vaultIntegrity} className="absolute left-1/2 top-1/2 z-10 w-[280px] max-w-[42vw] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute left-1/2 top-1/2 z-20 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-white/35 bg-black/70 shadow-[0_0_42px_rgb(255_255_255_/_0.22)]"><NexusMark className="size-11 text-white" /></div>
      <div className="hidden xl:block">{nodes.map((defence, index) => <TopologyNode key={defence.id} defence={defence} index={index} position={NODE_POSITIONS[index]} />)}</div>
      <div className="absolute inset-x-4 bottom-4 grid gap-2 sm:grid-cols-2 xl:hidden">{nodes.slice(0, 4).map((defence, index) => <CompactNode key={defence.id} defence={defence} index={index} />)}</div>
    </div>
  )
}

const NODE_POSITIONS = [
  { x: 226, y: 158 }, { x: 360, y: 116 }, { x: 494, y: 158 }, { x: 532, y: 292 },
  { x: 494, y: 426 }, { x: 360, y: 470 }, { x: 226, y: 426 }, { x: 188, y: 292 },
]

function TopologyNode({ defence, index, position }: { defence: InstalledDefence; index: number; position: { x: number; y: number } }) {
  const warning = !defence.isEnabled || defence.slug === 'counter-trace'
  return (
    <div className="absolute z-20 flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ left: `${(position.x / 720) * 100}%`, top: `${(position.y / 560) * 100}%` }}>
      <div className="flex size-12 items-center justify-center rounded-lg border border-white/22 bg-black/80 shadow-[0_0_22px_rgb(255_255_255_/_0.16)]">{warning ? <ShieldAlert className="size-6 text-white/80" /> : <Shield className="size-6 text-white/82" />}</div>
      <p className="mt-2 text-[10px] font-semibold uppercase leading-3 text-white">{defence.name}</p>
      <p className={cn('mt-1 text-[9px] font-semibold uppercase tracking-[0.14em]', warning ? 'text-amber-300' : 'text-emerald-300')}>{warning ? 'Warning' : 'Online'}</p>
      <span className="sr-only">Defence layer {index + 1}</span>
    </div>
  )
}

function CompactNode({ defence, index }: { defence: InstalledDefence; index: number }) {
  return <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/68 px-3 py-2"><span className="text-[10px] font-semibold text-white/45">{String(index + 1).padStart(2, '0')}</span><Shield className="size-4 text-white/65" /><span className="min-w-0 truncate text-xs font-semibold text-white">{defence.name}</span><span className={cn('ml-auto size-1.5 rounded-full', defence.isEnabled ? 'bg-emerald-300' : 'bg-amber-300')} /></div>
}
function RightColumn({ targets, alerts, onTargets, onHistory }: { targets: ApexTarget[]; alerts: DefenderActivityEntry[]; onTargets: () => void; onHistory: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-4">
        <PanelHeader icon={Compass} title="Find a Target" actionLabel="View All" onAction={onTargets} />
        <div className="mt-4 grid grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.7fr] gap-2 px-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/42"><span>Operator</span><span>Rank</span><span>Signal</span><span>Defense</span><span>Scan</span></div>
        <ul className="mt-2 flex flex-col gap-1.5">{targets.length === 0 ? <EmptyRow>No eligible targets yet.</EmptyRow> : targets.slice(0, 5).map((target) => <TargetRow key={target.userId} target={target} onScan={onTargets} />)}</ul>
      </Panel>
      <Panel className="p-4">
        <PanelHeader icon={Bell} title="Breach Alerts" actionLabel="View All" onAction={onHistory} />
        <ul className="mt-4 flex flex-col gap-2">{alerts.length === 0 ? <EmptyRow>No alerts yet.</EmptyRow> : alerts.slice(0, 3).map((alert, index) => <AlertRow key={alert.id} alert={alert} index={index} />)}</ul>
      </Panel>
    </div>
  )
}

function TargetRow({ target, onScan }: { target: ApexTarget; onScan: () => void }) {
  return (
    <li className="grid min-h-10 grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.7fr] items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 text-[11px]">
      <span className="flex min-w-0 items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 text-[10px] font-bold">{target.displayName.slice(0, 1).toUpperCase()}</span><span className="truncate font-semibold text-white/88">{target.displayName}</span></span>
      <span className="truncate text-white/68">{target.apexRankLabel}</span>
      <SignalBars signal={target.vaultSignal} />
      <span className="text-white/68">{target.defenceLayerCount} Layers</span>
      <button type="button" onClick={onScan} className="min-h-7 rounded-lg border border-white/10 bg-black/45 px-2 text-[10px] font-semibold text-white/75 transition hover:bg-white/10">Scan</button>
    </li>
  )
}

function SignalBars({ signal }: { signal: ApexTarget['vaultSignal'] }) {
  const active = signal === 'stable' ? 4 : signal === 'elevated_activity' ? 5 : signal === 'weakening' ? 3 : 2
  return <span className="flex h-5 items-end gap-0.5" aria-label={signal.replace('_', ' ')}>{[1, 2, 3, 4, 5].map((bar) => <span key={bar} className={cn('w-1 rounded-sm bg-white', bar <= active ? 'opacity-90' : 'opacity-20')} style={{ height: `${bar * 3 + 3}px` }} />)}</span>
}

function AlertRow({ alert, index }: { alert: DefenderActivityEntry; index: number }) {
  const warning = alert.result !== 'contained'
  const time = alert.completedAt ? relativeTime(alert.completedAt) : index === 0 ? '2m ago' : 'Now'
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
      {warning ? <ShieldAlert className="size-6 text-white/80" /> : <ShieldCheck className="size-6 text-white/80" />}
      <span className="min-w-0"><span className="block truncate text-xs font-semibold text-white/88">{warning ? 'Unusual Activity Detected' : 'Breach Repelled'}</span><span className="block truncate text-[11px] text-white/48">{alert.message}</span></span>
      <span className={cn('text-right text-[10px] font-semibold uppercase', warning ? 'text-amber-300' : 'text-emerald-300')}>{warning ? 'Warning' : 'Success'}<span className="block pt-1 font-normal normal-case text-white/42">{time}</span></span>
    </li>
  )
}

function DefenseChain({ defences }: { defences: InstalledDefence[] }) {
  const ordered = [...defences].sort((a, b) => a.defenceOrder - b.defenceOrder).slice(0, 8)
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Shield className="size-4" /> Defense Chain</h2><p className="mt-1 text-[11px] text-white/48">Active defense systems in sequence</p></div><button type="button" className="min-h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/70">Manage Defenses</button></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{ordered.map((defence, index) => <ChainCard key={defence.id} defence={defence} index={index} isLast={index === ordered.length - 1} />)}</div>
    </Panel>
  )
}

function ChainCard({ defence, index, isLast }: { defence: InstalledDefence; index: number; isLast: boolean }) {
  const warning = !defence.isEnabled || defence.slug === 'counter-trace'
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex h-[136px] w-[86px] flex-col justify-between rounded-lg border border-white/10 bg-black/45 p-2.5">
        <span className="text-[10px] text-white/45">{String(index + 1).padStart(2, '0')}</span>
        <span className="mx-auto flex size-10 items-center justify-center rounded-lg border border-white/14 bg-white/[0.06]">{warning ? <ShieldAlert className="size-5 text-white/78" /> : <Shield className="size-5 text-white/78" />}</span>
        <span><span className="block text-[10px] font-semibold uppercase leading-3 text-white">{defence.name}</span><span className={cn('mt-1 block text-[9px] font-semibold', warning ? 'text-amber-300' : 'text-emerald-300')}>{warning ? 'Warning' : 'Powered'}</span></span>
      </div>
      {!isLast && <ChevronRight className="size-4 text-white/42" />}
    </div>
  )
}

function BreachArsenal({ onLab }: { onLab: () => void }) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Swords className="size-4" /> Breach Arsenal</h2><p className="mt-1 text-[11px] text-white/48">Attack technologies and tools</p></div><button type="button" onClick={onLab} className="min-h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/70">Systems Lab</button></div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-4">{ARSENAL.map((item) => { const Icon = item.icon; return <div key={item.label} className="flex min-h-[70px] items-center gap-3 rounded-lg border border-white/10 bg-black/45 p-3"><Icon className="size-6 shrink-0 text-white/82" /><span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase leading-3 text-white/72">{item.label}</span><span className="mt-1 block text-[10px] text-white/48">x{item.count}</span></span></div> })}</div>
    </Panel>
  )
}

function ActionRail({ actions, onChange }: { actions: ActionTileConfig[]; onChange: (view: View) => void }) {
  return (
    <div className="grid gap-2 lg:grid-cols-5">
      {actions.map((action) => { const Icon = action.icon; return <button key={`${action.label}-${action.view}`} type="button" onClick={() => onChange(action.view)} className="group grid min-h-[88px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-black/58 p-4 text-left transition hover:border-white/24 hover:bg-white/[0.06]"><Icon className="size-8 text-white/80" /><span className="min-w-0"><span className="block text-sm font-semibold uppercase tracking-[0.04em] text-white">{action.label}</span><span className="mt-1 block text-xs leading-4 text-white/50">{action.detail}</span></span><ChevronRight className="size-5 text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white" /></button> })}
    </div>
  )
}
function PanelHeader({ icon: Icon, title, actionLabel, onAction }: { icon: LucideIcon; title: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.05em] text-white"><Icon className="size-4" /> {title}</h2>{actionLabel && onAction && <button type="button" onClick={onAction} className="min-h-8 rounded-lg border border-white/10 bg-black/40 px-3 text-[11px] font-semibold text-white/68 transition hover:bg-white/10 hover:text-white">{actionLabel}</button>}</div>
}

function CoreMeter({ icon: Icon, label, value, percent }: { icon: LucideIcon; label: string; value: string; percent: number }) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04]"><Icon className="size-4 text-white/70" /></span><span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</span><span className="text-sm font-semibold tabular-nums text-white">{value}</span></div>
      <div className="ml-9 mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/78" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>
    </div>
  )
}

function StatLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="flex min-h-9 items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04]"><Icon className="size-4 text-white/70" /></span><span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</span><span className="text-sm font-semibold tabular-nums text-white">{value}</span></div>
}

function ApexShell({ tabs, children }: { tabs: React.ReactNode; children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 pb-4">{children}{tabs}</div>
}

function TabBar({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <nav aria-label="Apex sections" className="glass sticky bottom-3 z-10 flex flex-wrap gap-1.5 rounded-lg p-1.5">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const active = tab.view === view
        return (
          <button key={tab.view} type="button" aria-current={active ? 'page' : undefined} onClick={() => onChange(tab.view)} className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-left transition', active ? 'bg-white/12 shadow-inner shadow-white/5' : 'hover:bg-white/[0.06]')}>
            <Icon className={cn('size-4 shrink-0', active ? 'text-white' : 'text-white/50')} />
            <span className="hidden sm:block"><span className={cn('block text-xs font-semibold', active ? 'text-white' : 'text-white/70')}>{tab.label}</span><span className="block text-[10px] text-muted-foreground">{tab.detail}</span></span>
          </button>
        )
      })}
    </nav>
  )
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-lg border border-white/10 bg-black/62 backdrop-blur-md shadow-[inset_0_1px_rgb(255_255_255_/_0.06)]', className)}>{children}</div>
}

function LoadingConsole() {
  return <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_360px]"><div className="h-[520px] rounded-lg border border-white/10 bg-white/[0.03]" /><div className="h-[560px] rounded-lg border border-white/10 bg-white/[0.03]" /><div className="h-[520px] rounded-lg border border-white/10 bg-white/[0.03]" /></div>
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <li className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-xs text-white/45">{children}</li>
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white/80">{children}</div>
}

function percentOf(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString()
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0'
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

function relativeTime(iso: string | null) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
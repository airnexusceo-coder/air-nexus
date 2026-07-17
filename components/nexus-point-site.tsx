'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Code2,
  Database,
  FileSearch,
  FileText,
  Globe2,
  GraduationCap,
  ImageIcon,
  Languages,
  Layers,
  ListChecks,
  Mail,
  Map,
  Menu,
  PlayCircle,
  Presentation,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { PLAN_DETAILS, type NexusPlan } from '@/lib/plans'
import { clearAuthSession, getAuthSession, signInWithPassword, signUpWithPassword, type AuthSession } from '@/lib/auth/session'
import { cn } from '@/lib/utils'
import { AI_TOOL_CATEGORIES, AI_TOOLS, type AiToolCategory } from '@/lib/ai-tools/catalog'
import { NexusLogo } from '@/components/brand/nexus-mark'
import { BrandHeroVisual } from '@/components/brand/hero-visual'

const AirGPTApp = dynamic(
  () => import('@/components/airnexus-app').then((module) => module.AirGPTApp),
  { loading: () => <AppLoadingScreen label="Opening your workspace…" /> },
)

export type MarketingPage = 'home' | 'products' | 'pricing' | 'resources' | 'company' | 'login' | 'signup' | 'airgpt' | 'tool'

const toolIcons: Record<string, LucideIcon> = {
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
}

const tools = AI_TOOLS.map((tool) => ({ ...tool, icon: toolIcons[tool.slug] ?? Sparkles }))

const nav = [
  { label: 'Products', href: '/products' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Resources', href: '/resources' },
  { label: 'Company', href: '/company' },
]

export function NexusPointSite({ page, toolSlug }: { page: MarketingPage; toolSlug?: string }) {
  if (page === 'airgpt') return <AirGPTGate />

  return (
    <div className="nexus-site min-h-screen overflow-x-hidden bg-black text-white">
      <MarketingNav active={page} />
      <main>
        {page === 'home' && <HomePage />}
        {page === 'products' && <ProductsPage />}
        {page === 'pricing' && <PricingPage />}
        {page === 'resources' && <ResourcesPage />}
        {page === 'company' && <CompanyPage />}
        {(page === 'login' || page === 'signup') && <AuthPage mode={page} />}
        {page === 'tool' && <ToolPage slug={toolSlug ?? ''} />}
      </main>
      <MarketingFooter />
    </div>
  )
}

function AppLoadingScreen({ label }: { label: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-black text-sm text-zinc-400"><span className="size-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" /><span className="ml-3">{label}</span></div>
}

function safeNextPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/airgpt'
}

function loginPathForCurrentLocation() {
  const next = window.location.pathname + window.location.search + window.location.hash
  return '/login?next=' + encodeURIComponent(next)
}
function AirGPTGate() {
  const router = useRouter()
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void getAuthSession()
      .then((current) => {
        if (cancelled) return
        if (!current) {
          router.replace(loginPathForCurrentLocation())
          return
        }
        setSession(current)
      })
      .catch(() => {
        if (!cancelled) router.replace(loginPathForCurrentLocation())
      })
    return () => {
      cancelled = true
    }
  }, [router])

  if (!session) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-sm text-zinc-400"><span className="size-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" /><span className="ml-3">Checking your Air Nexus session…</span></div>
  }

  return <div className="airgpt-product"><AirGPTApp authUser={session} onSignOut={() => { void clearAuthSession().finally(() => router.replace(loginPathForCurrentLocation())) }} /></div>
}
function MarketingNav({ active }: { active: MarketingPage }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="nexus-nav sticky top-0 z-50 border-b border-white/8 bg-black/75 backdrop-blur-2xl">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center px-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="Air Nexus home"><NexusLogo className="size-8" /><span className="text-sm font-semibold tracking-[0.28em] sm:text-base">AIR NEXUS</span></Link>
        <nav className="ml-auto hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
          <Link href="/#how-it-works" className="py-2 text-sm text-zinc-400 transition hover:text-white">Features</Link>
          {nav.map((item) => <Link key={item.href} href={item.href} className={cn('relative py-2 text-sm text-zinc-400 transition hover:text-white', active === item.label.toLowerCase() && 'text-white after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-white')}>{item.label}{item.label === 'Resources' && <ChevronDown className="ml-1 inline size-3" />}</Link>)}
        </nav>
        <div className="ml-auto hidden items-center gap-3 lg:flex"><Link href="/login" className="nexus-outline px-6 py-2.5">Login</Link><Link href="/signup" className="nexus-cta px-6 py-2.5">Get started</Link></div>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle navigation" className="ml-auto flex size-10 items-center justify-center rounded-xl border border-white/10 lg:hidden">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      </div>
      {open && <nav className="border-t border-white/8 bg-black/95 px-5 py-5 lg:hidden"><Link href="/#how-it-works" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-sm text-zinc-300 hover:bg-white/8 hover:text-white">Features</Link>{nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-sm text-zinc-300 hover:bg-white/8 hover:text-white">{item.label}</Link>)}<div className="mt-3 grid grid-cols-2 gap-3"><Link href="/login" className="nexus-outline text-center">Login</Link><Link href="/signup" className="nexus-cta text-center">Get started</Link></div></nav>}
    </header>
  )
}

const HOME_FEATURES = [
  { title: 'AI Tutor', description: 'Get step-by-step explanations tailored to your learning.', icon: BrainCircuit, href: '/airgpt?section=AI%20Tutor' },
  { title: 'Smart Revision', description: 'Turn your learning into flashcards, summaries and practice.', icon: Layers, href: '/airgpt?section=Flashcards' },
  { title: 'Exam Practice', description: 'Test your understanding with adaptive practice.', icon: ListChecks, href: '/airgpt?section=AI%20Tutor' },
  { title: 'Track Your Progress', description: 'See what you understand and what to revise next.', icon: TrendingUp, href: '/airgpt?section=Analytics' },
]

function HomePage() {
  return (
    <>
      <section className="relative mx-auto grid min-h-[680px] max-w-[1440px] items-center gap-10 overflow-hidden px-5 py-16 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-12 lg:py-20">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.14em] text-zinc-300"><span className="size-1.5 rounded-full bg-white" />AI study companion for secondary students</span>
          <h1 className="mt-6 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl lg:text-[5.4rem]">Study smarter.<br />Go further.</h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-zinc-400 sm:text-lg">AirNexus is your AI study companion that helps you understand, practise and master what matters — so you can ace every exam and reach your goals.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/signup" className="nexus-cta px-7 py-4 text-center text-base">Get started for free <ArrowRight className="size-4" /></Link><a href="#how-it-works" className="nexus-outline px-7 py-4 text-center text-base"><PlayCircle className="size-4" />See how it works</a></div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-zinc-400"><Trust icon={BookOpenCheck} label="Curriculum-aligned" /><Trust icon={GraduationCap} label="Built for secondary students" /><Trust icon={Zap} label="Instant explanations" /></div>
        </div>
        <BrandHeroVisual />
      </section>
      <ScrollIndicator />
      <HowItWorks />
      <ToolsGrid compact />
      <FeaturedAirGPT />
      <CtaBand />
    </>
  )
}

function ScrollIndicator() {
  return (
    <a href="#how-it-works" className="mx-auto flex w-fit flex-col items-center gap-2 pb-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 transition hover:text-white">
      Scroll to explore
      <ChevronDown className="size-4 motion-safe:animate-bounce" />
    </a>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {HOME_FEATURES.map(({ title, description, icon: Icon, href }) => (
          <Link key={title} href={href} className="nexus-card group flex flex-col gap-4 p-6 transition hover:border-white/20">
            <span className="flex size-11 items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-zinc-100"><Icon className="size-5" /></span>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm leading-6 text-zinc-400">{description}</p>
            <ArrowRight className="mt-auto size-4 text-zinc-500 transition group-hover:translate-x-1 group-hover:text-white" />
          </Link>
        ))}
      </div>
    </section>
  )
}

function ProductsPage() {
  return <PageShell eyebrow="Air Nexus products" title="One platform. Every intelligent tool." description="Explore focused AI products built around AirGPT, with one account and a consistent privacy-first experience."><ToolsGrid /></PageShell>
}

function PricingPage() {
  const plans: NexusPlan[] = ['Free', 'Plus', 'Premium']
  return <PageShell eyebrow="Simple pricing" title="Start free. Scale when you are ready." description="Pay by card or use Nexus Points earned through learning and productive work."><div className="grid gap-5 lg:grid-cols-3">{plans.map((plan) => <article key={plan} className={cn('nexus-card flex min-h-[390px] flex-col p-6', plan === 'Plus' && 'border-white/30 shadow-[0_0_50px_-24px_rgba(255,255,255,0.5)]')}><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200">{plan}</span>{plan === 'Plus' && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-black">Popular</span>}</div><p className="mt-5 text-4xl font-semibold">{PLAN_DETAILS[plan].price}</p><p className="mt-2 text-sm text-zinc-300">{PLAN_DETAILS[plan].points.toLocaleString()} Nexus Points{plan !== 'Free' ? '/month' : ''}</p><p className="mt-5 text-sm leading-6 text-zinc-400">{PLAN_DETAILS[plan].summary}</p><ul className="mt-6 space-y-3 text-sm text-zinc-300">{(plan === 'Free' ? ['AirGPT chat', 'Tasks and calendar', 'Grade calculator'] : plan === 'Plus' ? ['Unlimited AirGPT', 'Voice and summaries', 'Analytics and ATAR calculator'] : ['Everything in Plus', 'Premium tutor and graphing', 'Advanced integrations']).map((feature) => <li key={feature} className="flex items-center gap-2"><Check className="size-4 text-zinc-300" />{feature}</li>)}</ul><Link href="/airgpt" className={cn('mt-auto text-center', plan === 'Plus' ? 'nexus-cta' : 'nexus-outline')}>{plan === 'Free' ? 'Open AirGPT' : 'Choose ' + plan}</Link></article>)}</div></PageShell>
}

function ResourcesPage() {
  const resources = [{ title: 'AirGPT Guides', detail: 'Practical workflows for research, study, writing, and code.', icon: FileText }, { title: 'Air Nexus Academy', detail: 'Short lessons that help teams build better AI habits.', icon: BrainCircuit }, { title: 'Security Centre', detail: 'Clear information about privacy, controls, and responsible AI.', icon: ShieldCheck }, { title: 'Developer Resources', detail: 'Patterns and API guidance for connected AI products.', icon: Code2 }]
  return <PageShell eyebrow="Resources" title="Learn faster with practical AI guidance." description="Documentation, ideas, and responsible-use resources for every stage of your AI journey."><div className="grid gap-5 sm:grid-cols-2">{resources.map(({ title, detail, icon: Icon }) => <article key={title} className="nexus-card p-6"><span className="nexus-icon"><Icon className="size-5" /></span><h2 className="mt-6 text-xl font-semibold">{title}</h2><p className="mt-2 leading-7 text-zinc-400">{detail}</p><Link href="/airgpt" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-200 hover:text-white">Explore resource <ArrowRight className="size-4" /></Link></article>)}</div></PageShell>
}

function CompanyPage() {
  return <PageShell eyebrow="Company" title="Building intelligence people can actually use." description="Air Nexus creates calm, capable AI products that help people do ambitious work without losing control of the process."><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><article className="nexus-card p-7 sm:p-10"><h2 className="text-2xl font-semibold">Our mission</h2><p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-400">Make advanced AI feel useful, transparent, and accessible—whether someone is studying for an exam, planning a launch, or building the next great product.</p><div className="mt-8 flex flex-wrap gap-3"><span className="nexus-pill">Human-centred</span><span className="nexus-pill">Secure by default</span><span className="nexus-pill">Built in Australia</span></div></article><div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">{[[String(AI_TOOLS.length), 'focused tools'], ['3', 'Flexible plans'], ['24/7', 'AirGPT access']].map(([value, label]) => <div key={label} className="nexus-card p-6"><p className="text-4xl font-semibold nexus-gradient-text">{value}</p><p className="mt-2 text-sm text-zinc-500">{label}</p></div>)}</div></div></PageShell>
}

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remember, setRemember] = useState(true)
  const [nextPath, setNextPath] = useState('/airgpt')
  const [adminAccessOpen, setAdminAccessOpen] = useState(false)
  const [, setAdminTapCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const destination = safeNextPath(new URLSearchParams(window.location.search).get('next'))
    const timeoutId = window.setTimeout(() => setNextPath(destination), 0)
    void getAuthSession()
      .then((current) => {
        if (!cancelled && current) router.replace(destination)
      })
      .catch(() => null)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [router])

  useEffect(() => {
    if (mode !== 'login') return
    let sequence = ''
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.length !== 1) return
      sequence = (sequence + event.key.toLowerCase()).slice(-10)
      if (sequence.endsWith('nexusadmin')) setAdminAccessOpen(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode])

  const revealAdminAccess = () => {
    if (mode !== 'login') return
    setAdminTapCount((count) => {
      const next = count + 1
      if (next >= 7) setAdminAccessOpen(true)
      return next
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    try {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.')
      if (!password) throw new Error('Password is required.')
      if (mode === 'signup') {
        const username = String(data.get('username') ?? '').trim()
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error('Choose a username: 3-20 characters, letters, numbers, and underscores only.')
        await signUpWithPassword({ username, email, password, remember })
      } else {
        await signInWithPassword({ email, password, remember })
      }
      router.push(nextPath)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-160px)] max-w-[1440px] items-center justify-center px-5 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,.08),transparent_38%)]" />
      <div className="nexus-card relative w-full max-w-md overflow-hidden p-7 sm:p-9">
        <div aria-hidden="true" className="absolute -right-24 -top-28 size-56 rounded-full bg-violet-500/10 blur-3xl" />
        <button type="button" onClick={revealAdminAccess} aria-label="Air Nexus mark" className="relative rounded-2xl text-left outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-white/40">
          <NexusLogo className="size-11" />
        </button>
        <p className="relative mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">{mode === 'login' ? 'Secure sign in' : 'Join Air Nexus'}</p>
        <h1 className="relative mt-2 text-3xl font-semibold">{mode === 'login' ? 'Continue to AirGPT' : 'Create your account'}</h1>
        <p className="relative mt-2 text-sm leading-6 text-zinc-500">Supabase Auth protects your workspace and memory. AirNexus only uses server-verified account IDs.</p>

        <form onSubmit={submit} className="relative mt-6">
          {mode === 'signup' && (
            <label className="block text-xs text-zinc-400">
              Username
              <input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" className="nexus-field mt-2" placeholder="e.g. study_wolf23" autoComplete="username" />
              <span className="mt-1.5 block text-[10px] text-zinc-600">3-20 characters, letters, numbers, and underscores only ? not your real name.</span>
            </label>
          )}
          <label className={mode === 'signup' ? 'mt-5 block text-xs text-zinc-400' : 'block text-xs text-zinc-400'}>
            Email
            <input name="email" type="email" required className="nexus-field mt-2" placeholder="name@example.com" autoComplete="email" />
          </label>
          <label className="mt-5 block text-xs text-zinc-400">
            Password
            <input name="password" type="password" minLength={8} required className="nexus-field mt-2" placeholder="At least 8 characters" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>
          <button type="submit" disabled={loading} className="nexus-cta mt-6 w-full">{loading ? 'Signing in...' : mode === 'signup' ? 'Create account' : 'Sign in'}<ArrowRight className="size-4" /></button>
        </form>

        <label className="relative mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-xs text-zinc-400">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4 accent-white" />
          <span><span className="block font-medium text-zinc-200">Remember me</span><span className="mt-0.5 block text-[10px] text-zinc-600">Keep this Supabase session on this device.</span></span>
        </label>
        {error && <p role="alert" className="relative mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
        {mode === 'login' && adminAccessOpen && (
          <Link href="/admin/login" className="relative mt-4 flex items-center justify-between rounded-2xl border border-violet-300/20 bg-violet-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-violet-100 transition hover:border-violet-200/40 hover:bg-violet-300/15">
            Owner console
            <ArrowRight className="size-4" />
          </Link>
        )}
        <p className="relative mt-6 text-center text-xs text-zinc-500">{mode === 'login' ? "New to Air Nexus? " : 'Already have an account? '}<Link href={(mode === 'login' ? '/signup' : '/login') + (nextPath !== '/airgpt' ? '?next=' + encodeURIComponent(nextPath) : '')} className="text-white hover:text-zinc-300">{mode === 'login' ? 'Sign up' : 'Login'}</Link></p>
        {mode === 'login' && (
          <button
            type="button"
            aria-label={adminAccessOpen ? 'Open owner console login' : 'Hidden owner access'}
            onClick={() => { if (adminAccessOpen) router.push('/admin/login'); else revealAdminAccess() }}
            className={cn(
              'absolute bottom-3 right-3 size-4 rounded-full border transition duration-300',
              adminAccessOpen ? 'border-violet-200/70 bg-violet-200 shadow-[0_0_18px_rgba(221,214,254,.55)]' : 'border-white/5 bg-white/[0.025] opacity-10 hover:opacity-35',
            )}
          />
        )}
      </div>
    </section>
  )
}

function ToolPage({ slug }: { slug: string }) {
  const tool = tools.find((item) => item.slug === slug)
  if (!tool) return <PageShell eyebrow="Product" title="Tool not found" description="That Air Nexus tool does not exist."><Link href="/products" className="nexus-outline">Browse working tools</Link></PageShell>
  const Icon = tool.icon
  const steps = [
    ['01', 'Add your context', tool.acceptsFiles ? 'Describe the task and attach the files AirGPT should use.' : 'Describe the task, audience, goal, and constraints.'],
    ['02', 'Choose your format', tool.optionLabel ? 'Select ' + tool.optionLabel.toLowerCase() + ' before you run the tool.' : 'AirGPT shapes the workflow around your request.'],
    ['03', 'Use the result', 'Copy, download, refine, or play the finished result inside your workspace.'],
  ]
  return (
    <PageShell eyebrow={tool.category + ' tool · Available now'} title={tool.name} description={tool.description + '. A focused workflow inside the connected AirGPT workspace—not a placeholder or a separate product.'}>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <article className="nexus-card relative overflow-hidden p-7 sm:p-10">
          <div className="absolute -right-20 -top-24 size-64 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative">
            <span className="flex size-16 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-100"><Icon className="size-7" /></span>
            <h2 className="mt-7 text-2xl font-semibold">Start with a real brief</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">{tool.outputHint}</p>
            <div className="mt-6 rounded-2xl border border-white/9 bg-black/25 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Example</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{tool.example}</p>
            </div>
            <Link href={'/airgpt?tool=' + tool.slug} className="nexus-cta mt-7 px-7 py-4">Open {tool.name} <ArrowRight className="size-4" /></Link>
          </div>
        </article>
        <div className="nexus-card p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">How it works</p>
          <div className="mt-5 space-y-3">
            {steps.map(([number, title, detail]) => (
              <div key={number} className="flex gap-4 rounded-2xl border border-white/7 bg-white/[0.025] p-4">
                <span className="font-mono text-xs text-cyan-200">{number}</span>
                <div><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2"><span className="nexus-pill">Connected workspace</span><span className="nexus-pill">Editable output</span>{tool.acceptsFiles && <span className="nexus-pill">File-aware</span>}</div>
        </div>
      </div>
    </PageShell>
  )
}

function ToolsGrid({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'All' | AiToolCategory>('All')
  const categories: Array<'All' | AiToolCategory> = ['All', ...AI_TOOL_CATEGORIES]
  const filtered = tools.filter((tool) => {
    const search = query.trim().toLowerCase()
    return (category === 'All' || tool.category === category) && (!search || (tool.name + ' ' + tool.description + ' ' + tool.category).toLowerCase().includes(search))
  })
  const shownTools = compact ? filtered.slice(0, 10) : filtered

  return (
    <section className={cn('mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12', compact ? 'py-14' : '')}>
      {compact && <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">Tool studio</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Focused AI for the work in front of you.</h2></div><Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-white">See all {AI_TOOLS.length} tools <ArrowRight className="size-4" /></Link></div>}
      <div className="nexus-card overflow-hidden p-3 sm:p-5">
        {!compact && (
          <div className="mb-5 flex flex-col gap-3 border-b border-white/7 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-md flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search AI tools" placeholder="Search tools and workflows…" className="nexus-field pl-10" /></div>
            <div className="scrollbar-thin flex gap-1 overflow-x-auto">
              {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={cn('whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition', category === item ? 'bg-white text-black' : 'text-zinc-500 hover:bg-white/7 hover:text-white')}>{item}</button>)}
            </div>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {shownTools.map((tool) => {
            const Icon = tool.icon
            const accent = tool.category === 'Create' ? 'from-violet-500/15 text-violet-100' : tool.category === 'Research' ? 'from-cyan-500/15 text-cyan-100' : tool.category === 'Communicate' ? 'from-amber-500/15 text-amber-100' : 'from-emerald-500/15 text-emerald-100'
            return (
              <Link key={tool.slug} href={'/tools/' + tool.slug} className={cn('group relative flex min-h-44 flex-col overflow-hidden rounded-2xl border border-white/7 bg-gradient-to-br to-transparent p-4 transition hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-black/30', accent)}>
                <div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl border border-current/15 bg-black/15"><Icon className="size-4.5" /></span><span className="rounded-full border border-white/8 bg-black/15 px-2 py-1 text-[9px] uppercase tracking-wider text-zinc-500">{tool.category}</span></div>
                <h3 className="mt-5 text-sm font-semibold text-white">{tool.name}</h3>
                <p className="mt-1 text-[11px] leading-5 text-zinc-500">{tool.description}</p>
                <span className="mt-auto flex items-center gap-1 pt-4 text-[10px] font-semibold text-zinc-400 transition group-hover:text-white">Open tool <ArrowRight className="size-3 transition group-hover:translate-x-0.5" /></span>
              </Link>
            )
          })}
        </div>
        {shownTools.length === 0 && <div className="py-16 text-center"><Search className="mx-auto size-5 text-zinc-700" /><p className="mt-3 text-sm text-zinc-500">No tools match that search.</p></div>}
        <div className="mt-5 flex flex-wrap gap-5 border-t border-white/7 px-3 pt-5 text-xs text-zinc-500"><Trust icon={Globe2} label={AI_TOOLS.length + ' focused tools'} /><Trust icon={Sparkles} label="Focused workflows" /><Trust icon={ShieldCheck} label="Account protected" /><Trust icon={Code2} label="Connected workspace" /></div>
      </div>
    </section>
  )
}
function FeaturedAirGPT() {
  return <section className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 lg:px-12"><div className="nexus-card flex flex-col gap-6 border-white/15 p-6 sm:flex-row sm:items-center"><NexusLogo className="size-16 shrink-0" /><div className="flex-1"><div className="flex items-center gap-3"><h2 className="text-3xl font-semibold">AirGPT</h2><span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-black">AI Assistant</span></div><p className="mt-2 text-zinc-400">Your intelligent assistant for learning, content, code, research, planning, and more.</p></div><Link href="/airgpt" className="nexus-cta px-8 py-4">Explore AirGPT <ArrowRight className="size-4" /></Link></div></section>
}

function CtaBand() {
  return <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12"><div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.04] px-6 py-16 text-center"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(255,255,255,.14),transparent_55%)]" /><h2 className="relative text-3xl font-semibold sm:text-5xl">Ready to think without limits?</h2><p className="relative mx-auto mt-4 max-w-xl text-zinc-400">Open AirGPT and turn your next idea into something real.</p><Link href="/airgpt" className="nexus-cta relative mt-8 px-8 py-4">Launch AirGPT <ArrowRight className="size-4" /></Link></div></section>
}

function PageShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="mx-auto min-h-[calc(100vh-160px)] max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24"><div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{eyebrow}</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">{title}</h1><p className="mt-5 text-base leading-8 text-zinc-400 sm:text-lg">{description}</p></div><div className="mt-12">{children}</div></section>
}

function Trust({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) { return <span className="inline-flex items-center gap-2"><Icon className="size-4 text-zinc-300" />{label}</span> }

function MarketingFooter() {
  return <footer className="border-t border-white/8"><div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 text-xs text-zinc-600 sm:px-8 md:flex-row md:items-center lg:px-12"><div className="flex items-center gap-3"><NexusLogo className="size-7" /><span className="font-semibold tracking-[0.2em] text-zinc-300">AIR NEXUS</span></div><p className="md:ml-auto">© {new Date().getFullYear()} Air Nexus. AirGPT is the flagship AI product.</p><div className="flex gap-4"><Link href="/resources" className="hover:text-white">Privacy</Link><Link href="/resources" className="hover:text-white">Terms</Link></div></div></footer>
}

'use client'

import { useEffect, useState } from 'react'
import { BookOpenCheck, ClipboardList, Gauge, Menu, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

type MobileBottomNavProps = {
  activeSection: string
  chatOpen: boolean
  menuOpen: boolean
  contextOpen: boolean
  onNavigate: (section: string) => void
  onOpenChat: () => void
  onOpenMenu: () => void
  onCloseMenu: () => void
  onOpenContext: () => void
  onCloseContext: () => void
}

export function MobileBottomNav({ activeSection, chatOpen, menuOpen, contextOpen, onNavigate, onOpenChat, onOpenMenu, onCloseMenu, onOpenContext, onCloseContext }: MobileBottomNavProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    const viewport = window.visualViewport
    const updateViewport = () => {
      const height = viewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${height}px`)
      setKeyboardOpen(window.innerHeight - height > 140)
    }
    updateViewport()
    viewport?.addEventListener('resize', updateViewport)
    viewport?.addEventListener('scroll', updateViewport)
    window.addEventListener('orientationchange', updateViewport)
    return () => {
      viewport?.removeEventListener('resize', updateViewport)
      viewport?.removeEventListener('scroll', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
    }
  }, [])

  useEffect(() => {
    let startX = 0
    let startY = 0
    const start = (event: TouchEvent) => { if (event.touches.length === 1) { startX = event.touches[0].clientX; startY = event.touches[0].clientY } }
    const end = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) return
      if (menuOpen && dx < 0) onCloseMenu()
      else if (contextOpen && dx > 0) onCloseContext()
      else if (startX <= 28 && dx > 0) onOpenMenu()
      else if (startX >= window.innerWidth - 28 && dx < 0) onOpenContext()
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchend', end, { passive: true })
    return () => { document.removeEventListener('touchstart', start); document.removeEventListener('touchend', end) }
  }, [contextOpen, menuOpen, onCloseContext, onCloseMenu, onOpenContext, onOpenMenu])

  const items = [
    { label: 'Home', icon: Gauge, active: activeSection === 'Dashboard' && !chatOpen, action: () => onNavigate('Dashboard') },
    { label: 'Tutor', icon: BookOpenCheck, active: activeSection === 'AI Tutor' && !chatOpen, action: () => onNavigate('AI Tutor') },
    { label: 'Chat', icon: MessageSquare, active: chatOpen, action: onOpenChat, primary: true },
    { label: 'Assignments', icon: ClipboardList, active: activeSection === 'Assignment Workspace' && !chatOpen, action: () => onNavigate('Assignment Workspace') },
    { label: 'More', icon: Menu, active: menuOpen, action: onOpenMenu },
  ]

  return (
    <nav aria-label="Mobile navigation" className={cn('mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl transition-transform duration-200 lg:hidden', keyboardOpen && 'translate-y-full')}>
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
        {items.map(({ label, icon: Icon, active, action, primary }) => <button key={label} type="button" onClick={action} aria-current={active ? 'page' : undefined} className={cn('mobile-touch relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium text-slate-500 transition active:scale-95', active && 'text-white', primary && '-mt-5')}><span className={cn('flex size-9 items-center justify-center rounded-2xl', primary && 'size-12 bg-gradient-to-br from-white to-zinc-300 text-black shadow-lg shadow-black/30', active && !primary && 'bg-white/10')}><Icon className={cn('size-5', primary && 'size-5.5')} /></span><span>{label}</span>{active && !primary && <span className="absolute bottom-0 size-1 rounded-full bg-white" />}</button>)}
      </div>
    </nav>
  )
}

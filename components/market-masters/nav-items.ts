import { Award, GraduationCap, LayoutDashboard, Newspaper, Settings as SettingsIcon, Star, Store, Target, Wallet, type LucideIcon } from 'lucide-react'

export type MarketMastersView = 'dashboard' | 'market' | 'portfolio' | 'watchlist' | 'news' | 'learn' | 'missions' | 'achievements' | 'settings'

export type NavItem = { id: MarketMastersView; label: string; icon: LucideIcon }

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'market', label: 'Market', icon: Store },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'watchlist', label: 'Watchlist', icon: Star },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
  { id: 'missions', label: 'Missions', icon: Target },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

/** The 4 most important destinations for the mobile bottom bar — everything else lives behind "More", never more than two taps away. */
export const PRIMARY_MOBILE_VIEWS: MarketMastersView[] = ['dashboard', 'market', 'portfolio', 'learn']

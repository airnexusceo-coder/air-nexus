import {
  Award,
  BarChart3,
  Building2,
  Factory,
  FlaskConical,
  Globe2,
  GraduationCap,
  Landmark,
  Layers,
  MapPinned,
  Megaphone,
  Settings as SettingsIcon,
  Star,
  Swords,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type BusinessEmpireView =
  | 'dashboard'
  | 'industry-market'
  | 'research'
  | 'products'
  | 'production'
  | 'pricing'
  | 'advertising'
  | 'competitors'
  | 'reputation'
  | 'land-facilities'
  | 'funding'
  | 'finances'
  | 'annual-reports'
  | 'learn'
  | 'settings'

export type NavItem = { id: BusinessEmpireView; label: string; icon: LucideIcon }

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Building2 },
  { id: 'industry-market', label: 'Industry Market', icon: Globe2 },
  { id: 'research', label: 'Research', icon: FlaskConical },
  { id: 'products', label: 'Products', icon: Layers },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'pricing', label: 'Pricing', icon: Wallet },
  { id: 'advertising', label: 'Advertising', icon: Megaphone },
  { id: 'competitors', label: 'Competitors', icon: Swords },
  { id: 'reputation', label: 'Reputation', icon: Star },
  { id: 'land-facilities', label: 'Land & Facilities', icon: MapPinned },
  { id: 'funding', label: 'Funding', icon: Landmark },
  { id: 'finances', label: 'Finances', icon: BarChart3 },
  { id: 'annual-reports', label: 'Annual Reports', icon: Award },
  { id: 'learn', label: 'Learning Centre', icon: GraduationCap },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

/** The 4 most important destinations for the mobile bottom bar — everything else lives behind "More". */
export const PRIMARY_MOBILE_VIEWS: BusinessEmpireView[] = ['dashboard', 'products', 'finances', 'learn']

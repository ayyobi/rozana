import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  FolderHeart,
  House,
  Settings,
  Sparkles,
  Sprout,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '@/i18n';

export interface NavItem {
  href: string;
  label: TranslationKey;
  icon: LucideIcon;
  /** Présent dans la barre du bas sur mobile. */
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'nav.dashboard', icon: House, mobile: true },
  { href: '/planning', label: 'nav.planning', icon: CalendarDays, mobile: true },
  { href: '/taches', label: 'nav.tasks', icon: CheckSquare, mobile: true },
  { href: '/projets', label: 'nav.projects', icon: FolderHeart },
  { href: '/habitudes', label: 'nav.habits', icon: Sprout },
  { href: '/finances', label: 'nav.finances', icon: Wallet, mobile: true },
  { href: '/statistiques', label: 'nav.stats', icon: BarChart3 },
  { href: '/assistant', label: 'nav.assistant', icon: Sparkles },
  { href: '/parametres', label: 'nav.settings', icon: Settings },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

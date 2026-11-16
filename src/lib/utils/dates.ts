import { TZDate } from '@date-fns/tz';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { intlTag, type Locale } from '@/i18n';

export const DEFAULT_TIMEZONE = import.meta.env.PUBLIC_DEFAULT_TIMEZONE || 'Europe/Paris';

/** « Maintenant » dans le fuseau de l'utilisateur. */
export function nowIn(timeZone: string = DEFAULT_TIMEZONE): TZDate {
  return TZDate.tz(timeZone);
}

export function formatLongDate(date: Date, locale: Locale, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date);
}

/** `timeZone` omis = date « murale » locale (grilles de calendrier construites côté client). */
export function formatMonthYear(date: Date, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(intlTag(locale), { month: 'long', year: 'numeric', ...(timeZone ? { timeZone } : {}) }).format(date);
}

export function formatDayNumber(date: Date, locale: Locale): string {
  return new Intl.NumberFormat(intlTag(locale)).format(date.getDate());
}

/** Initiales des jours, en commençant par lundi. */
export function weekdayInitials(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(intlTag(locale), { weekday: 'narrow', timeZone: 'UTC' });
  // 2024-01-01 était un lundi.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i, 12))));
}

export function greetingKey(date: Date): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export interface CalendarCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
}

/** Grille mensuelle (semaines commençant le lundi). */
export function monthGrid(month: Date, today: Date): CalendarCell[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const cells: CalendarCell[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    cells.push({ date: d, inMonth: isSameMonth(d, month), isToday: isSameDay(d, today) });
  }
  return cells;
}

/** Index stable (0‥n-1) basé sur le jour, pour la phrase du jour. */
export function dayIndex(date: Date, modulo: number): number {
  const key = date.getFullYear() * 1000 + Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 864e5);
  return modulo > 0 ? key % modulo : 0;
}

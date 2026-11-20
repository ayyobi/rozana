import { intlTag, type Locale } from '@/i18n';
import { parseDay, type DayStr } from './day';

/** Formate un jour AAAA-MM-JJ (sans décalage de fuseau). */
export function fmtDay(day: DayStr, locale: Locale, style: 'short' | 'medium' | 'long' | 'weekday' = 'medium'): string {
  if (!day) return '';
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : style === 'long'
        ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        : style === 'weekday'
          ? { weekday: 'short', day: 'numeric', month: 'short' }
          : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(intlTag(locale), { ...opts, timeZone: 'UTC' }).format(parseDay(day));
}

export function fmtMonth(day: DayStr, locale: Locale): string {
  const s = new Intl.DateTimeFormat(intlTag(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseDay(day));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtNumber(n: number, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlTag(locale), opts).format(n);
}

/** « HH:mm » affiché avec les chiffres de la langue. */
export function fmtTime(time: string, locale: Locale): string {
  if (!time) return '';
  if (locale !== 'fa') return time;
  return time.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d);
}

export function weekdayShort(i: number, locale: Locale): string {
  // 2024-01-01 était un lundi.
  return new Intl.DateTimeFormat(intlTag(locale), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i)));
}

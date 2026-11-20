/**
 * Manipulation de dates « murales » au format AAAA-MM-JJ, sans fuseau.
 * Toute la logique de planning travaille sur ces chaînes : elles représentent
 * un jour dans le fuseau de l'utilisatrice, ce qui évite les décalages d'heure.
 */

export type DayStr = string; // AAAA-MM-JJ

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayStr(d: Date): DayStr {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parseDay(s: DayStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function isDayStr(s: unknown): s is DayStr {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDay(s).getTime());
}

/** Aujourd'hui dans un fuseau IANA donné. */
export function todayIn(timeZone: string, now: Date = new Date()): DayStr {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // en-CA → AAAA-MM-JJ
}

/** Heure locale « HH:mm » dans un fuseau donné. */
export function nowTimeIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
}

export function addDays(s: DayStr, n: number): DayStr {
  const d = parseDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toDayStr(d);
}

export function addMonths(s: DayStr, n: number): DayStr {
  const d = parseDay(s);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  d.setUTCDate(Math.min(day, last));
  return toDayStr(d);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function diffDays(a: DayStr, b: DayStr): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86400000);
}

/** 0 = lundi … 6 = dimanche */
export function weekday(s: DayStr): number {
  return (parseDay(s).getUTCDay() + 6) % 7;
}

export function startOfWeek(s: DayStr): DayStr {
  return addDays(s, -weekday(s));
}

export function startOfMonth(s: DayStr): DayStr {
  return s.slice(0, 8) + '01';
}

export function endOfMonth(s: DayStr): DayStr {
  const d = parseDay(s);
  return `${s.slice(0, 8)}${pad(daysInMonth(d.getUTCFullYear(), d.getUTCMonth()))}`;
}

export function monthKey(s: DayStr): string {
  return s.slice(0, 7);
}

export function rangeDays(from: DayStr, to: DayStr): DayStr[] {
  const out: DayStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Grille du mois (semaines du lundi au dimanche). */
export function monthGridDays(anyDayInMonth: DayStr): DayStr[] {
  const from = startOfWeek(startOfMonth(anyDayInMonth));
  const to = addDays(startOfWeek(endOfMonth(anyDayInMonth)), 6);
  return rangeDays(from, to);
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minToTime(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/**
 * Convertit un jour + heure locaux d'un fuseau en instant UTC.
 * Méthode itérative robuste aux changements d'heure.
 */
export function zonedToUtc(day: DayStr, time: string, timeZone: string): Date {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = (time || '00:00').split(':').map(Number);
  const target = Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const local = localParts(new Date(guess), timeZone);
    guess += target - local;
  }
  return new Date(guess);
}

function localParts(date: Date, timeZone: string): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

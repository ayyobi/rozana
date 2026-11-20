import type { Recurrence } from '@/types/models';
import { addDays, addMonths, diffDays, parseDay, weekday, type DayStr } from '@/lib/utils/day';

const MAX_OCCURRENCES = 1000;

/**
 * Renvoie les jours d'occurrence d'un élément commençant `start` et répété selon `rec`,
 * limités à l'intervalle [from, to]. Les dates de `exdates` sont exclues.
 */
export function occurrencesBetween(
  start: DayStr,
  rec: Recurrence | null | undefined,
  from: DayStr,
  to: DayStr,
  exdates: string[] | null = null,
): DayStr[] {
  const excluded = new Set(exdates ?? []);
  if (!rec) return start >= from && start <= to && !excluded.has(start) ? [start] : [];

  const interval = Math.max(1, Math.floor(rec.interval || 1));
  const until = rec.until && rec.until < to ? rec.until : to;
  const out: DayStr[] = [];
  let count = 0;

  const push = (d: DayStr) => {
    count++;
    if (d >= from && d <= until && !excluded.has(d)) out.push(d);
  };
  const limitReached = () => (rec.count ? count >= rec.count : false) || count > MAX_OCCURRENCES * 10;

  switch (rec.freq) {
    case 'daily': {
      // Saut direct près de `from` pour éviter d'itérer depuis le début.
      let d = start;
      if (!rec.count && from > start) {
        const skip = Math.floor(diffDays(from, start) / interval) * interval;
        d = addDays(start, skip);
        count = skip / interval;
      }
      for (; d <= until && !limitReached(); d = addDays(d, interval)) push(d);
      break;
    }
    case 'weekly': {
      const days = rec.byweekday?.length ? [...rec.byweekday].sort() : [weekday(start)];
      let weekStart = addDays(start, -weekday(start));
      for (let w = 0; weekStart <= until && !limitReached(); w++) {
        if (w % interval === 0) {
          for (const wd of days) {
            const d = addDays(weekStart, wd);
            if (d < start) continue;
            if (d > until || limitReached()) break;
            push(d);
          }
        }
        weekStart = addDays(weekStart, 7);
      }
      break;
    }
    case 'monthly': {
      const day = parseDay(start).getUTCDate();
      for (let i = 0; !limitReached(); i += interval) {
        const d = addMonths(start, i);
        if (d > until) break;
        // Un 31 n'existe pas tous les mois : on ne « glisse » pas vers le 30.
        if (parseDay(d).getUTCDate() !== day) continue;
        push(d);
      }
      break;
    }
    case 'yearly': {
      for (let i = 0; !limitReached(); i += interval) {
        const d = addMonths(start, i * 12);
        if (d > until) break;
        if (d.slice(5) !== start.slice(5)) continue; // 29 février
        push(d);
      }
      break;
    }
  }
  return out;
}

export function describeRecurrence(rec: Recurrence | null, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (!rec) return '';
  return t(`recurrence.${rec.freq}`, { n: rec.interval || 1 });
}

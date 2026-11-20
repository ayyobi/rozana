import type { Habit, HabitLog } from '@/types/models';
import { addDays, weekday, type DayStr } from '@/lib/utils/day';

/** L'habitude est-elle prévue ce jour-là ? */
export function scheduledOn(h: Habit, day: DayStr): boolean {
  if (h.archived) return false;
  if (h.created && day < h.created.slice(0, 10)) return false;
  if (h.frequency === 'daily') return true;
  return (h.days ?? []).includes(weekday(day));
}

/** Un jour est « réussi » s'il a un enregistrement atteignant l'objectif (ou ≥ 1). */
export function isDone(h: Habit, log: HabitLog | undefined): boolean {
  if (!log) return false;
  return h.target_qty > 0 ? log.qty >= h.target_qty : true;
}

export interface HabitStats {
  scheduled: number;
  done: number;
  /** Taux de réussite en % (null si aucun jour prévu : on n'invente pas de statistique). */
  rate: number | null;
  /** Série en cours (jours prévus consécutifs réussis, aujourd'hui exclu s'il n'est pas fini). */
  streak: number;
  best: number;
}

export function habitStats(h: Habit, logs: HabitLog[], from: DayStr, to: DayStr, today: DayStr): HabitStats {
  const byDay = new Map(logs.filter((l) => l.habit === h.id).map((l) => [l.date, l]));
  let scheduled = 0;
  let done = 0;
  let run = 0;
  let best = 0;
  for (let d = from; d <= to && d <= today; d = addDays(d, 1)) {
    if (!scheduledOn(h, d)) continue;
    const ok = isDone(h, byDay.get(d));
    if (d === today && !ok) continue; // la journée n'est pas finie
    scheduled++;
    if (ok) {
      done++;
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return { scheduled, done, rate: scheduled ? Math.round((done / scheduled) * 100) : null, streak: run, best };
}

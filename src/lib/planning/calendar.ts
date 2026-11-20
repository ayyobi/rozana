import type { CalEvent, Category, RecurringTx, Recurrence, Task, Transaction } from '@/types/models';
import { addDays, diffDays, minToTime, timeToMin, type DayStr } from '@/lib/utils/day';
import { occurrencesBetween } from './recurrence';
import { isOpen } from './tasks';

export type CalKind = 'event' | 'task' | 'deadline' | 'finance';

export interface CalItem {
  key: string;
  kind: CalKind;
  id: string;
  title: string;
  date: DayStr; // jour de début de l'occurrence
  endDate: DayStr;
  start: string; // HH:mm ou ''
  end: string;
  allDay: boolean;
  color: string;
  category: string;
  done: boolean;
  recurring: boolean;
  /** Jour d'origine de l'occurrence (pour les exceptions de séries). */
  occurrence: DayStr;
  amountCents?: number;
  txType?: 'expense' | 'income';
}

export function recurringTxRule(r: RecurringTx): Recurrence {
  const freq = r.frequency === 'days' ? 'daily' : r.frequency;
  return { freq, interval: r.interval || 1, ...(r.end_date ? { until: r.end_date } : {}) };
}

/** Prochaines échéances d'une récurrence financière dans [from, to]. */
export function recurringDueDates(r: RecurringTx, from: DayStr, to: DayStr): DayStr[] {
  if (!r.active) return [];
  return occurrencesBetween(r.start_date, recurringTxRule(r), from, to);
}

export function buildCalendarItems(input: {
  from: DayStr;
  to: DayStr;
  events: CalEvent[];
  tasks: Task[];
  recurring: RecurringTx[];
  planned: Transaction[];
  categories: Map<string, Category>;
  showDone: boolean;
}): CalItem[] {
  const { from, to } = input;
  const items: CalItem[] = [];
  const colorOf = (cat: string, fallback: string) => input.categories.get(cat)?.color || fallback;

  for (const ev of input.events) {
    const span = Math.max(0, diffDays(ev.end_date || ev.start_date, ev.start_date));
    for (const d of occurrencesBetween(ev.start_date, ev.recurrence, addDays(from, -span), to, ev.exdates)) {
      items.push({
        key: `e-${ev.id}-${d}`,
        kind: 'event',
        id: ev.id,
        title: ev.title,
        date: d,
        endDate: addDays(d, span),
        start: ev.all_day ? '' : ev.start_time,
        end: ev.all_day ? '' : ev.end_time,
        allDay: ev.all_day || !ev.start_time,
        color: ev.color || colorOf(ev.category, '#E7D29E'),
        category: ev.category,
        done: false,
        recurring: !!ev.recurrence,
        occurrence: d,
      });
    }
  }

  for (const tk of input.tasks) {
    if (!input.showDone && !isOpen(tk)) continue;
    const done = tk.status === 'done';
    if (tk.start_date) {
      const endDate = tk.end_date && tk.end_date >= tk.start_date ? tk.end_date : tk.start_date;
      if (tk.start_date > to || endDate < from) continue;
      let end = '';
      if (tk.start_time) {
        if (tk.end_time && endDate === tk.start_date && tk.end_time > tk.start_time) end = tk.end_time;
        else end = minToTime(timeToMin(tk.start_time) + (tk.estimate_min || 30));
      }
      items.push({
        key: `t-${tk.id}`,
        kind: 'task',
        id: tk.id,
        title: tk.title,
        date: tk.start_date,
        endDate,
        start: tk.start_time,
        end,
        allDay: !tk.start_time,
        color: colorOf(tk.category, '#EAD3BF'),
        category: tk.category,
        done,
        recurring: !!tk.recurrence,
        occurrence: tk.start_date,
      });
    }
    // Échéance distincte du jour planifié.
    if (tk.deadline && tk.deadline !== tk.start_date && tk.deadline >= from && tk.deadline <= to) {
      items.push({
        key: `d-${tk.id}`,
        kind: 'deadline',
        id: tk.id,
        title: tk.title,
        date: tk.deadline,
        endDate: tk.deadline,
        start: '',
        end: '',
        allDay: true,
        color: colorOf(tk.category, '#E3B9A3'),
        category: tk.category,
        done,
        recurring: false,
        occurrence: tk.deadline,
      });
    }
  }

  // Rappels financiers : échéances prévues (non payées).
  const paidKeys = new Set(input.planned.filter((p) => p.recurring && p.due_key).map((p) => `${p.recurring}|${p.due_key}`));
  for (const r of input.recurring) {
    for (const d of recurringDueDates(r, from, to)) {
      if (paidKeys.has(`${r.id}|${d}`)) continue;
      items.push({
        key: `f-${r.id}-${d}`,
        kind: 'finance',
        id: r.id,
        title: r.label,
        date: d,
        endDate: d,
        start: '',
        end: '',
        allDay: true,
        color: '#B9D3D6',
        category: '',
        done: false,
        recurring: true,
        occurrence: d,
        amountCents: r.amount_cents,
        txType: r.type,
      });
    }
  }
  for (const p of input.planned) {
    if (p.status !== 'planned' || p.date < from || p.date > to || p.recurring) continue;
    items.push({
      key: `p-${p.id}`,
      kind: 'finance',
      id: p.id,
      title: p.description || '—',
      date: p.date,
      endDate: p.date,
      start: '',
      end: '',
      allDay: true,
      color: '#B9D3D6',
      category: '',
      done: false,
      recurring: false,
      occurrence: p.date,
      amountCents: p.amount_cents,
      txType: p.type,
    });
  }
  return items;
}

/** Éléments d'un jour donné (y compris les éléments sur plusieurs jours). */
export function itemsOnDay(items: CalItem[], day: DayStr): CalItem[] {
  return items
    .filter((i) => i.date <= day && i.endDate >= day)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title));
}

/** Clés des éléments horaires qui se chevauchent le même jour. */
export function findConflicts(items: CalItem[]): Set<string> {
  const out = new Set<string>();
  const timed = items.filter((i) => !i.allDay && i.start && i.date === i.endDate && !i.done && (i.kind === 'event' || i.kind === 'task'));
  const byDay = new Map<string, CalItem[]>();
  for (const i of timed) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      const aEnd = a.end || minToTime(timeToMin(a.start) + 30);
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]!;
        if (b.start >= aEnd) break;
        out.add(a.key);
        out.add(b.key);
      }
    }
  }
  return out;
}

/** Placement en colonnes des éléments horaires qui se chevauchent (vue jour/semaine). */
export function layoutColumns(items: CalItem[]): Map<string, { col: number; cols: number }> {
  const res = new Map<string, { col: number; cols: number }>();
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start));
  let group: CalItem[] = [];
  let groupEnd = '';
  const flush = () => {
    const cols: string[] = [];
    const assign = new Map<string, number>();
    for (const it of group) {
      let c = cols.findIndex((end) => end <= it.start);
      if (c === -1) {
        c = cols.length;
        cols.push('');
      }
      cols[c] = it.end || minToTime(timeToMin(it.start) + 30);
      assign.set(it.key, c);
    }
    for (const it of group) res.set(it.key, { col: assign.get(it.key) ?? 0, cols: cols.length });
    group = [];
    groupEnd = '';
  };
  for (const it of sorted) {
    const end = it.end || minToTime(timeToMin(it.start) + 30);
    if (group.length && it.start >= groupEnd) flush();
    group.push(it);
    if (end > groupEnd) groupEnd = end;
  }
  if (group.length) flush();
  return res;
}

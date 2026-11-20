import type { Priority, Task } from '@/types/models';
import { addDays, diffDays, type DayStr } from '@/lib/utils/day';
import { occurrencesBetween } from './recurrence';

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const isOpen = (t: Task) => t.status === 'todo' || t.status === 'in_progress';

/** Jour de référence d'une tâche : planifiée, sinon échéance. */
export function refDay(t: Task): DayStr {
  return t.start_date || t.deadline || '';
}

export function isOverdue(t: Task, today: DayStr): boolean {
  if (!isOpen(t)) return false;
  if (t.deadline) return t.deadline < today;
  if (t.end_date) return t.end_date < today;
  return false;
}

/** Tâches du jour : planifiées / échues aujourd'hui, en cours sur la période, ou démarrées. */
export function isToday(t: Task, today: DayStr): boolean {
  if (!isOpen(t)) return false;
  if (t.start_date === today || t.deadline === today) return true;
  if (t.start_date && t.start_date < today && (!t.end_date || t.end_date >= today) && t.end_date) return true;
  return t.status === 'in_progress' && !isOverdue(t, today);
}

export function isUpcoming(t: Task, today: DayStr): boolean {
  if (!isOpen(t) || isToday(t, today) || isOverdue(t, today)) return false;
  const d = refDay(t);
  return !!d && d > today;
}

/** Tri « intelligent » : en retard, puis échéance proche, puis priorité. */
export function smartCompare(today: DayStr) {
  return (a: Task, b: Task) => {
    const oa = isOverdue(a, today) ? 0 : 1;
    const ob = isOverdue(b, today) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const da = refDay(a) || '9999-12-31';
    const db = refDay(b) || '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    const pa = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pa) return pa;
    return (a.start_time || '99:99').localeCompare(b.start_time || '99:99');
  };
}

/** Les trois priorités du jour pour le dashboard. */
export function topPriorities(tasks: Task[], today: DayStr, n = 3): Task[] {
  const candidates = tasks.filter((t) => isOpen(t) && (isToday(t, today) || isOverdue(t, today) || (t.deadline && diffDays(t.deadline, today) <= 2)));
  return candidates
    .sort((a, b) => {
      const pa = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pa) return pa;
      return smartCompare(today)(a, b);
    })
    .slice(0, n);
}

/** Décale toutes les dates d'une tâche de `days` jours. */
export function shiftTaskDates(t: Pick<Task, 'start_date' | 'end_date' | 'deadline'>, days: number) {
  return {
    start_date: t.start_date ? addDays(t.start_date, days) : '',
    end_date: t.end_date ? addDays(t.end_date, days) : '',
    deadline: t.deadline ? addDays(t.deadline, days) : '',
  };
}

/** Données de la prochaine occurrence d'une tâche récurrente, ou null. */
export function nextOccurrence(t: Task): Partial<Task> | null {
  const base = refDay(t);
  if (!t.recurrence || !base) return null;
  const next = occurrencesBetween(base, t.recurrence, addDays(base, 1), addDays(base, 366 * 5))[0];
  if (!next) return null;
  const delta = diffDays(next, base);
  return {
    title: t.title,
    description: t.description,
    category: t.category,
    project: t.project,
    section: t.section,
    start_time: t.start_time,
    end_time: t.end_time,
    priority: t.priority,
    status: 'todo',
    estimate_min: t.estimate_min,
    reminder_min: t.reminder_min,
    recurrence: t.recurrence,
    links: t.links,
    notes: t.notes,
    ...shiftTaskDates(t, delta),
  };
}

/** Copie d'une tâche (pour « Dupliquer »). */
export function duplicateData(t: Task, suffix: string): Partial<Task> {
  const { id: _i, owner: _o, created: _c, updated: _u, completed_at: _d, ...rest } = t;
  return { ...rest, title: `${t.title} ${suffix}`.slice(0, 200), status: 'todo', completed_at: '' };
}

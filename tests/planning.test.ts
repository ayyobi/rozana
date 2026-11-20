import { describe, expect, it } from 'vitest';
import { occurrencesBetween } from '@/lib/planning/recurrence';
import { findConflicts, layoutColumns, type CalItem } from '@/lib/planning/calendar';
import { addMonths, todayIn, weekday, zonedToUtc } from '@/lib/utils/day';
import { isOverdue, nextOccurrence } from '@/lib/planning/tasks';
import type { Task } from '@/types/models';

describe('récurrences', () => {
  it('hebdomadaire sur plusieurs jours', () => {
    expect(occurrencesBetween('2026-11-02', { freq: 'weekly', interval: 1, byweekday: [0, 2] }, '2026-11-01', '2026-11-15')).toEqual(['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11']);
  });
  it('quotidienne avec fin et exceptions', () => {
    expect(occurrencesBetween('2026-11-01', { freq: 'daily', interval: 2, until: '2026-11-07' }, '2026-11-01', '2026-11-30', ['2026-11-03'])).toEqual(['2026-11-01', '2026-11-05', '2026-11-07']);
  });
  it('annuelle le 29 février', () => {
    expect(occurrencesBetween('2028-02-29', { freq: 'yearly', interval: 1 }, '2028-01-01', '2033-01-01')).toEqual(['2028-02-29', '2032-02-29']);
  });
});

describe('dates et fuseaux', () => {
  it('lundi = 0', () => expect(weekday('2026-11-16')).toBe(0));
  it('fin de mois', () => expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'));
  it('aujourd’hui dépend du fuseau', () => {
    const d = new Date('2026-11-16T23:30:00Z');
    expect(todayIn('Europe/Paris', d)).toBe('2026-11-17');
    expect(todayIn('America/New_York', d)).toBe('2026-11-16');
  });
  it('heure locale → UTC avec changement d’heure', () => {
    expect(zonedToUtc('2026-07-01', '09:00', 'Europe/Paris').toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(zonedToUtc('2026-12-01', '09:00', 'Europe/Paris').toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });
});

describe('conflits horaires', () => {
  const it0 = (key: string, start: string, end: string): CalItem => ({ key, kind: 'event', id: key, title: key, date: '2026-11-16', endDate: '2026-11-16', start, end, allDay: false, color: '', category: '', done: false, recurring: false, occurrence: '2026-11-16' });
  it('détecte un chevauchement', () => {
    const c = findConflicts([it0('a', '09:00', '10:00'), it0('b', '09:30', '10:30'), it0('c', '10:30', '11:00')]);
    expect([...c].sort()).toEqual(['a', 'b']);
  });
  it('place les éléments en colonnes', () => {
    const l = layoutColumns([it0('a', '09:00', '10:00'), it0('b', '09:30', '10:30'), it0('c', '11:00', '12:00')]);
    expect(l.get('a')).toEqual({ col: 0, cols: 2 });
    expect(l.get('b')).toEqual({ col: 1, cols: 2 });
    expect(l.get('c')).toEqual({ col: 0, cols: 1 });
  });
});

describe('tâches', () => {
  const t = (o: Partial<Task>): Task => ({ id: 'x', owner: 'u', created: '', updated: '', title: 'T', description: '', category: '', project: '', section: '', start_date: '', start_time: '', end_date: '', end_time: '', deadline: '', priority: 'normal', status: 'todo', estimate_min: 0, reminder_min: 0, recurrence: null, links: null, notes: '', completed_at: '', sort: 0, ...o });
  it('en retard', () => {
    expect(isOverdue(t({ deadline: '2026-11-15' }), '2026-11-16')).toBe(true);
    expect(isOverdue(t({ deadline: '2026-11-15', status: 'done' }), '2026-11-16')).toBe(false);
  });
  it('prochaine occurrence d’une tâche récurrente', () => {
    const n = nextOccurrence(t({ start_date: '2026-11-16', deadline: '2026-11-17', recurrence: { freq: 'weekly', interval: 1 } }));
    expect(n?.start_date).toBe('2026-11-23');
    expect(n?.deadline).toBe('2026-11-24');
    expect(n?.status).toBe('todo');
  });
});

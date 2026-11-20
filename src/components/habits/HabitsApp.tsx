import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { Sprout } from '@/components/ui/illustrations';
import { ConfirmDialog, PageHeader } from '@/components/ui/forms';
import { HabitForm } from '@/components/forms/HabitForm';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, pb, updateRecord } from '@/lib/pocketbase/client';
import { habitStats, isDone, scheduledOn } from '@/lib/habits';
import { addDays, addMonths, monthGridDays, startOfMonth, startOfWeek, endOfMonth } from '@/lib/utils/day';
import { fmtMonth, fmtNumber, weekdayShort } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Habit, HabitLog } from '@/types/models';

export default function HabitsApp({ locale, today }: { locale: Locale; today: string }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const habits = useList('habits', { sort: 'sort,created' });
  const logs = useList('habit_logs', { filter: pb().filter('date >= {:d}', { d: addDays(today, -400) }) });
  const [form, setForm] = useState<{ habit: Habit | null } | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [month, setMonth] = useState(startOfMonth(today));

  const active = habits.items.filter((h) => !h.archived);
  const archived = habits.items.filter((h) => h.archived);
  const logOf = (h: string, d: string) => logs.items.find((l) => l.habit === h && l.date === d);
  const todayList = active.filter((h) => scheduledOn(h, today));
  const current = habits.items.find((h) => h.id === selected) ?? active[0];

  async function setQty(h: Habit, qty: number, date = today) {
    const log = logOf(h.id, date);
    if (qty <= 0) {
      if (log) await run(() => deleteRecord('habit_logs', log.id));
      return;
    }
    await run(() => (log ? updateRecord('habit_logs', log.id, { qty }) : createRecord('habit_logs', { habit: h.id, date, qty })));
  }
  const toggle = (h: Habit, date = today) => setQty(h, isDone(h, logOf(h.id, date)) ? 0 : Math.max(1, h.target_qty), date);

  return (
    <>
      <PageHeader title={t('habits.title')} subtitle={t('habits.encouragement')} actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setForm({ habit: null })}>{t('habits.new')}</Button>} />

      {habits.loading ? (
        <Skeleton className="h-48" />
      ) : active.length === 0 && archived.length === 0 ? (
        <Card className="p-4"><EmptyState illustration={<Sprout />} title={t('habits.empty')} hint={t('habits.emptyHint')} action={<Button onClick={() => setForm({ habit: null })}>{t('habits.new')}</Button>} /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          <Card tone="sage" className="p-5 lg:col-span-5">
            <h2 className="mb-3 font-display text-lg font-semibold">{t('habits.today')}</h2>
            {todayList.length === 0 ? (
              <p className="text-ink-2">{t('habits.noneToday')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {todayList.map((h) => {
                  const log = logOf(h.id, today);
                  const done = isDone(h, log);
                  return (
                    <li key={h.id} className={cn('flex items-center gap-3 rounded-2xl border-2 bg-white/60 px-3 py-2.5', done ? 'border-sage-strong/40' : 'border-transparent')}>
                      <span className="grid size-10 place-items-center rounded-xl text-lg" style={{ background: h.color || '#e6ece1' }} aria-hidden>{h.icon || '🌿'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{h.name}</p>
                        {h.target_qty > 0 && <p className="text-xs text-ink-2">{fmtNumber(log?.qty ?? 0, locale)} / {fmtNumber(h.target_qty, locale)} {h.target_unit}</p>}
                      </div>
                      {h.target_qty > 1 ? (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => void setQty(h, (log?.qty ?? 0) - 1)} className="grid size-9 place-items-center rounded-full bg-white/80 hover:bg-white" aria-label={`${t('habits.qty')} −1 · ${h.name}`}><Minus className="size-4" aria-hidden /></button>
                          <button type="button" onClick={() => void setQty(h, (log?.qty ?? 0) + 1)} className="grid size-9 place-items-center rounded-full bg-coral hover:brightness-95" aria-label={`${t('habits.qty')} +1 · ${h.name}`}><Plus className="size-4" aria-hidden /></button>
                        </div>
                      ) : (
                        <button type="button" role="checkbox" aria-checked={done} aria-label={h.name} onClick={() => void toggle(h)} className={cn('size-8 rounded-full border-2 transition-colors', done ? 'border-sage-strong bg-sage-strong' : 'border-ink-2/40 bg-white/70 hover:border-sage-strong')} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5 lg:col-span-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">{t('habits.history')}</h2>
              <select value={current?.id ?? ''} onChange={(e) => setSelected(e.target.value)} className="h-9 rounded-xl bg-bg/50 px-2 text-sm" aria-label={t('habits.all')}>
                {habits.items.map((h) => <option key={h.id} value={h.id}>{h.icon} {h.name}</option>)}
              </select>
            </div>
            {current && <HabitCalendar habit={current} logs={logs.items} month={month} setMonth={setMonth} today={today} locale={locale} t={t} onToggle={(d) => void toggle(current, d)} />}
          </Card>

          <section className="lg:col-span-12" aria-label={t('habits.all')}>
            <h2 className="mb-3 font-display text-lg font-semibold">{t('habits.all')}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...active, ...archived].map((h) => <HabitCard key={h.id} habit={h} logs={logs.items} today={today} locale={locale} t={t} onEdit={() => setForm({ habit: h })} onDelete={() => setDeleting(h)} onArchive={() => void run(() => updateRecord('habits', h.id, { archived: !h.archived }), 'feedback.saved')} />)}
            </div>
          </section>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.habit ? t('habits.edit') : t('habits.new')} closeLabel={t('actions.close')}>
        {form && <HabitForm key={form.habit?.id ?? 'new'} locale={locale} habit={form.habit} onDone={() => setForm(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleting} title={t('confirmDelete.title')} message={deleting ? `${t('confirmDelete.message', { name: deleting.name })} ${t('confirmDelete.habitLogs')}` : ''} confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')} closeLabel={t('actions.close')} onClose={() => setDeleting(null)} onConfirm={async () => { if (deleting) await run(() => deleteRecord('habits', deleting.id), 'feedback.deleted'); setDeleting(null); }} />
    </>
  );
}

type T = ReturnType<typeof useTranslations>;

function HabitCard({ habit: h, logs, today, locale, t, onEdit, onDelete, onArchive }: { habit: Habit; logs: HabitLog[]; today: string; locale: Locale; t: T; onEdit: () => void; onDelete: () => void; onArchive: () => void }) {
  const s7 = habitStats(h, logs, addDays(today, -6), today, today);
  const s30 = habitStats(h, logs, addDays(today, -29), today, today);
  const all = habitStats(h, logs, addDays(today, -400), today, today);
  const week = habitStats(h, logs, startOfWeek(today), today, today);
  const month = habitStats(h, logs, startOfMonth(today), endOfMonth(today), today);
  const pct = (r: number | null) => (r === null ? '—' : `${fmtNumber(r, locale)} %`);
  return (
    <Card className={cn('p-4', h.archived && 'opacity-70')}>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl text-lg" style={{ background: h.color || '#e6ece1' }} aria-hidden>{h.icon || '🌿'}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{h.name}</p>
          <p className="text-xs text-ink-2">{h.frequency === 'daily' ? t('habits.daily') : (h.days ?? []).map((d) => weekdayShort(d, locale)).join(' · ')}{h.reminder_time && ` · ⏰ ${h.reminder_time}`}</p>
        </div>
        <button type="button" onClick={onEdit} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.edit')} · ${h.name}`}><Pencil className="size-4" aria-hidden /></button>
        <button type="button" onClick={onArchive} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${h.archived ? t('habits.unarchive') : t('habits.archive')} · ${h.name}`}>{h.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}</button>
        <button type="button" onClick={onDelete} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.delete')} · ${h.name}`}><Trash2 className="size-4" aria-hidden /></button>
      </div>
      {s30.scheduled === 0 ? (
        <p className="text-sm text-ink-2">{t('habits.notEnough')}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Stat label={t('habits.rate7')} value={pct(s7.rate)} />
          <Stat label={t('habits.rate30')} value={pct(s30.rate)} />
          <Stat label={t('habits.week')} value={t('habits.doneOf', { done: week.done, total: week.scheduled })} />
          <Stat label={t('habits.month')} value={t('habits.doneOf', { done: month.done, total: month.scheduled })} />
          {all.best > 1 && <Stat label={t('habits.best')} value={t('habits.daysN', { n: all.best })} />}
          {all.streak > 1 && <Stat label={t('habits.streak')} value={t('habits.daysN', { n: all.streak })} />}
        </dl>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/55 px-3 py-2">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function HabitCalendar({ habit, logs, month, setMonth, today, locale, t, onToggle }: { habit: Habit; logs: HabitLog[]; month: string; setMonth: (m: string) => void; today: string; locale: Locale; t: T; onToggle: (d: string) => void }) {
  const days = monthGridDays(month);
  const byDay = useMemo(() => new Map(logs.filter((l) => l.habit === habit.id).map((l) => [l.date, l])), [logs, habit.id]);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium">{fmtMonth(month, locale)}</p>
        <div className="flex gap-1">
          <button type="button" onClick={() => setMonth(addMonths(month, -1))} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={t('widgets.calendar.prev')}><ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden /></button>
          <button type="button" onClick={() => setMonth(addMonths(month, 1))} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={t('widgets.calendar.next')}><ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => <span key={d} className="pb-1 text-ink-2">{weekdayShort(d, locale)}</span>)}
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const sched = scheduledOn(habit, d);
          const done = isDone(habit, byDay.get(d));
          const future = d > today;
          return (
            <button
              key={d}
              type="button"
              disabled={future || !inMonth}
              onClick={() => onToggle(d)}
              aria-pressed={done}
              aria-label={`${d}${done ? ' ✓' : ''}`}
              className={cn(
                'grid aspect-square place-items-center rounded-xl text-sm tabular-nums transition-colors',
                !inMonth && 'invisible',
                done ? 'bg-sage-strong font-semibold text-white' : sched ? 'bg-sage/50 hover:bg-sage' : 'bg-ink/[0.03] text-ink-2',
                d === today && 'ring-2 ring-coral-strong',
                future && 'opacity-50',
              )}
            >
              {fmtNumber(Number(d.slice(8)), locale)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

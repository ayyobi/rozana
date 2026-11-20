import { useMemo, useState, type DragEvent } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Coins, Flag, Repeat, TriangleAlert, Trash2, Pencil, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/primitives';
import { Segmented, Toggle } from '@/components/ui/forms';
import { EventForm } from '@/components/forms/EventForm';
import { useTaskActions } from '@/components/tasks/useTaskActions';
import { type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { usePlanningRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, updateRecord } from '@/lib/pocketbase/client';
import { buildCalendarItems, findConflicts, itemsOnDay, layoutColumns, type CalItem } from '@/lib/planning/calendar';
import { addDays, addMonths, diffDays, minToTime, monthGridDays, rangeDays, startOfWeek, timeToMin, type DayStr } from '@/lib/utils/day';
import { fmtDay, fmtMonth, fmtNumber, fmtTime, weekdayShort } from '@/lib/utils/format';
import { formatCents } from '@/lib/finance/money';
import { cn } from '@/lib/utils/cn';
import type { CalEvent } from '@/types/models';

type View = 'day' | 'week' | 'month';
const HOUR_PX = 48;
const FIRST_HOUR = 6;

export default function PlanningApp({ locale, today, view: initialView, date: initialDate, currency }: { locale: Locale; today: DayStr; view: View; date: DayStr; currency: string }) {
  const taskActions = useTaskActions(locale, today);
  const { t } = taskActions;
  const run = useAction(t);
  const refs = usePlanningRefs();
  const [view, setView] = useState<View>(initialView);
  const [date, setDate] = useState<DayStr>(initialDate);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [eventModal, setEventModal] = useState<{ event: CalEvent | null; defaults?: Partial<CalEvent> } | null>(null);
  const [detail, setDetail] = useState<CalItem | null>(null);
  const [armed, setArmed] = useState(false);

  const events = useList('events', {});
  const tasks = useList('tasks', { filter: 'start_date != "" || deadline != ""' });
  const recurring = useList('recurring_transactions', { filter: 'active = true' });
  const planned = useList('transactions', { filter: 'recurring != "" || status = "planned"' });

  const range = useMemo(() => {
    if (view === 'day') return { from: date, to: date, days: [date] };
    if (view === 'week') {
      const from = startOfWeek(date);
      return { from, to: addDays(from, 6), days: rangeDays(from, addDays(from, 6)) };
    }
    const days = monthGridDays(date);
    return { from: days[0]!, to: days[days.length - 1]!, days };
  }, [view, date]);

  const allItems = useMemo(
    () =>
      buildCalendarItems({
        from: range.from,
        to: range.to,
        events: events.items,
        tasks: tasks.items,
        recurring: recurring.items,
        planned: planned.items,
        categories: refs.catById,
        showDone,
      }),
    [range, events.items, tasks.items, recurring.items, planned.items, refs.catById, showDone],
  );
  const items = useMemo(() => allItems.filter((i) => !hidden.has(i.category || '-')), [allItems, hidden]);
  const conflicts = useMemo(() => findConflicts(items), [items]);

  function navigate(dir: -1 | 1) {
    setDate((d) => (view === 'day' ? addDays(d, dir) : view === 'week' ? addDays(d, 7 * dir) : addMonths(d, dir)));
  }
  function changeView(v: View) {
    setView(v);
    history.replaceState(null, '', `/planning/${v === 'day' ? 'jour' : v === 'week' ? 'semaine' : 'mois'}?date=${date}`);
  }

  const title =
    view === 'day' ? fmtDay(date, locale, 'long') : view === 'week' ? `${fmtDay(range.from, locale, 'short')} – ${fmtDay(range.to, locale, 'medium')}` : fmtMonth(date, locale);

  // ── Déplacement (glisser-déposer) ─────────────────────
  async function moveItem(item: CalItem, toDay: DayStr, toTime?: string) {
    const delta = diffDays(toDay, item.date);
    const duration = item.start && item.end ? timeToMin(item.end) - timeToMin(item.start) : 60;
    const newStart = toTime ?? item.start;
    const newEnd = toTime && item.start ? minToTime(timeToMin(toTime) + duration) : item.end;
    if (item.kind === 'event') {
      const ev = events.items.find((e) => e.id === item.id);
      if (!ev) return;
      if (ev.recurrence) {
        // Série : on crée une exception pour cette occurrence uniquement.
        await run(async () => {
          await updateRecord('events', ev.id, { exdates: [...(ev.exdates ?? []), item.occurrence] });
          const { id: _i, owner: _o, created: _c, updated: _u, ...rest } = ev;
          await createRecord('events', {
            ...rest,
            recurrence: null,
            exdates: null,
            start_date: toDay,
            end_date: addDays(item.endDate, delta),
            start_time: ev.all_day ? '' : newStart,
            end_time: ev.all_day ? '' : newEnd,
          });
        }, 'feedback.moved');
      } else {
        await run(
          () =>
            updateRecord('events', ev.id, {
              start_date: addDays(ev.start_date, delta),
              end_date: addDays(ev.end_date, delta),
              ...(ev.all_day ? {} : { start_time: newStart, end_time: newEnd }),
            }),
          'feedback.moved',
        );
      }
    } else if (item.kind === 'task') {
      const tk = tasks.items.find((x) => x.id === item.id);
      if (!tk) return;
      await run(
        () =>
          updateRecord('tasks', tk.id, {
            start_date: addDays(tk.start_date, delta),
            end_date: tk.end_date ? addDays(tk.end_date, delta) : '',
            ...(toTime ? { start_time: newStart, end_time: tk.end_time ? newEnd : '' } : {}),
          }),
        'feedback.moved',
      );
    } else if (item.kind === 'deadline') {
      await run(() => updateRecord('tasks', item.id, { deadline: toDay }), 'feedback.moved');
    }
  }

  const onDragStart = (e: DragEvent, item: CalItem) => {
    e.dataTransfer.setData('text/plain', item.key);
    e.dataTransfer.effectAllowed = 'move';
  };
  const dropOn = (day: DayStr, time?: string) => (e: DragEvent) => {
    e.preventDefault();
    const key = e.dataTransfer.getData('text/plain');
    const item = items.find((i) => i.key === key);
    if (item && item.kind !== 'finance') void moveItem(item, day, time);
  };

  function openItem(item: CalItem) {
    if (item.kind === 'task' || item.kind === 'deadline') {
      const tk = tasks.items.find((x) => x.id === item.id);
      if (tk) taskActions.edit(tk);
    } else if (item.kind === 'finance') {
      window.location.assign('/finances/recurrences');
    } else setDetail(item);
  }

  const visibleCats = [...refs.categories.map((c) => ({ id: c.id, name: c.name, color: c.color })), { id: '-', name: t('fields.noCategory'), color: '#D5CFC6' }];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">{t('planning.title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon={<CheckSquare className="size-4" aria-hidden />} onClick={() => taskActions.create({ start_date: view === 'day' ? date : today })}>
            {t('tasks.new')}
          </Button>
          <Button size="sm" icon={<CalendarPlus className="size-4" aria-hidden />} onClick={() => setEventModal({ event: null, defaults: { start_date: view === 'day' ? date : today, end_date: view === 'day' ? date : today } })}>
            {t('events.new')}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => navigate(-1)} aria-label={t('planning.prev')} className="grid size-10 place-items-center rounded-full bg-surface/70 hover:bg-surface">
            <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
          <button type="button" onClick={() => navigate(1)} aria-label={t('planning.next')} className="grid size-10 place-items-center rounded-full bg-surface/70 hover:bg-surface">
            <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
          <button type="button" onClick={() => setDate(today)} className="h-10 rounded-pill bg-surface/70 px-4 text-sm font-medium hover:bg-surface">
            {t('planning.today')}
          </button>
          <p className="ms-2 font-display text-lg font-semibold" aria-live="polite">{title}</p>
        </div>
        <Segmented
          label={t('planning.title')}
          value={view}
          onChange={changeView}
          options={(['day', 'week', 'month'] as const).map((v) => ({ value: v, label: t(`planning.views.${v}`) }))}
        />
      </div>

      <details className="mb-4 rounded-2xl bg-surface/60 px-4 py-2">
        <summary className="cursor-pointer py-1 text-sm font-medium">{t('planning.filters')}</summary>
        <div className="flex flex-wrap gap-2 py-2">
          {visibleCats.map((c) => {
            const on = !hidden.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setHidden((h) => { const n = new Set(h); if (on) n.add(c.id); else n.delete(c.id); return n; })}
                className={cn('inline-flex h-8 items-center gap-2 rounded-pill px-3 text-sm', on ? 'bg-white/80' : 'bg-transparent text-ink-2 line-through')}
              >
                <span className="size-3 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.name}
              </button>
            );
          })}
        </div>
        <Toggle label={t('planning.showDone')} checked={showDone} onChange={setShowDone} />
        <Legend t={t} />
      </details>

      {conflicts.size > 0 && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-2xl bg-danger/10 px-4 py-2 text-sm font-medium text-danger">
          <TriangleAlert className="size-4" aria-hidden />
          {t('events.conflicts', { n: Math.ceil(conflicts.size / 2) })}
        </p>
      )}

      {view === 'month' ? (
        <MonthView days={range.days} month={date} today={today} items={items} conflicts={conflicts} locale={locale} t={t} currency={currency}
          onOpen={openItem} onDragStart={onDragStart} dropOn={dropOn}
          onDay={(d) => { setDate(d); changeView('day'); }} />
      ) : (
        <TimeGrid days={range.days} today={today} items={items} conflicts={conflicts} locale={locale} t={t} currency={currency}
          onOpen={openItem} onDragStart={onDragStart} dropOn={dropOn}
          onSlot={(d, time) => setEventModal({ event: null, defaults: { start_date: d, end_date: d, start_time: time, end_time: minToTime(timeToMin(time) + 60) } })} />
      )}
      <p className="mt-3 hidden text-xs text-ink-2 md:block">{t('planning.dragHint')}</p>

      <Modal open={!!eventModal} onClose={() => setEventModal(null)} title={eventModal?.event ? t('events.edit') : t('events.new')} closeLabel={t('actions.close')}>
        {eventModal && <EventForm key={eventModal.event?.id ?? 'new'} locale={locale} event={eventModal.event} defaults={eventModal.defaults} onDone={() => setEventModal(null)} />}
      </Modal>

      <Modal open={!!detail} onClose={() => { setArmed(false); setDetail(null); }} title={detail?.title ?? ''} closeLabel={t('actions.close')}>
        {detail && (() => {
          const ev = events.items.find((e) => e.id === detail.id);
          if (!ev) return null;
          return (
            <div className="flex flex-col gap-4">
              <p className="text-ink-2">
                {fmtDay(detail.date, locale, 'long')}
                {!detail.allDay && ` · ${fmtTime(detail.start, locale)} – ${fmtTime(detail.end, locale)}`}
                {detail.endDate !== detail.date && ` → ${fmtDay(detail.endDate, locale, 'medium')}`}
              </p>
              {ev.description && <p className="whitespace-pre-wrap">{ev.description}</p>}
              {conflicts.has(detail.key) && <p className="flex items-center gap-2 text-sm font-medium text-danger"><TriangleAlert className="size-4" aria-hidden />{t('events.conflict')}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                {ev.recurrence ? (
                  <>
                    <Button variant="secondary" icon={<Trash2 className="size-4" aria-hidden />} onClick={async () => { await run(() => updateRecord('events', ev.id, { exdates: [...(ev.exdates ?? []), detail.occurrence] }), 'feedback.deleted'); setDetail(null); }}>
                      {t('events.occurrenceOnly')}
                    </Button>
                    <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={async () => { await run(() => deleteRecord('events', ev.id), 'feedback.deleted'); setDetail(null); }}>
                      {t('events.wholeSeries')}
                    </Button>
                  </>
                ) : (
                  <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={async () => { if (!armed) return setArmed(true); await run(() => deleteRecord('events', ev.id), 'feedback.deleted'); setArmed(false); setDetail(null); }}>
                    {armed ? t('actions.confirm') : t('actions.delete')}
                  </Button>
                )}
                <Button icon={<Pencil className="size-4" aria-hidden />} onClick={() => { setDetail(null); setEventModal({ event: ev }); }}>
                  {t('actions.edit')}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>
      {taskActions.elements}
    </>
  );
}

type T = ReturnType<typeof useTaskActions>['t'];

function Legend({ t }: { t: T }) {
  return (
    <ul className="flex flex-wrap gap-4 py-2 text-xs text-ink-2">
      <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-apricot" aria-hidden />{t('planning.legend.event')}</li>
      <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border-2 border-dashed border-ink/40 bg-white" aria-hidden />{t('planning.legend.task')}</li>
      <li className="flex items-center gap-1.5"><Flag className="size-3.5" aria-hidden />{t('planning.legend.deadline')}</li>
      <li className="flex items-center gap-1.5"><Coins className="size-3.5" aria-hidden />{t('planning.legend.finance')}</li>
    </ul>
  );
}

interface ViewProps {
  today: DayStr;
  items: CalItem[];
  conflicts: Set<string>;
  locale: Locale;
  t: T;
  currency: string;
  onOpen: (i: CalItem) => void;
  onDragStart: (e: DragEvent, i: CalItem) => void;
  dropOn: (day: DayStr, time?: string) => (e: DragEvent) => void;
}

/** Pastille d'un élément (événement plein / tâche en pointillés). */
function Chip({ item, conflict, onOpen, onDragStart, locale, t, currency, compact }: { item: CalItem; conflict: boolean; compact?: boolean } & Pick<ViewProps, 'onOpen' | 'onDragStart' | 'locale' | 't' | 'currency'>) {
  const isTask = item.kind === 'task';
  const label = `${item.start ? fmtTime(item.start, locale) + ' ' : ''}${item.title}`;
  return (
    <button
      type="button"
      draggable={item.kind !== 'finance'}
      onDragStart={(e) => onDragStart(e, item)}
      onClick={(e) => { e.stopPropagation(); onOpen(item); }}
      title={item.kind === 'finance' && item.amountCents ? `${item.title} · ${formatCents(item.amountCents, currency, locale)}` : label}
      className={cn(
        'flex w-full min-w-0 items-center gap-1 truncate rounded-md px-1.5 text-start text-[0.72rem] leading-5 font-medium text-ink',
        isTask ? 'border border-dashed border-ink/35 bg-white/85' : '',
        item.done && 'line-through opacity-60',
        conflict && 'ring-2 ring-danger/60',
        compact ? 'py-0' : 'py-0.5',
      )}
      style={isTask ? { borderInlineStartColor: item.color, borderInlineStartWidth: 3, borderInlineStartStyle: 'solid' } : { background: item.color }}
    >
      {item.kind === 'deadline' && <Flag className="size-3 shrink-0" aria-label={t('planning.legend.deadline')} />}
      {item.kind === 'finance' && <Coins className="size-3 shrink-0" aria-label={t('planning.legend.finance')} />}
      {item.recurring && item.kind === 'event' && <Repeat className="size-3 shrink-0" aria-hidden />}
      {conflict && <TriangleAlert className="size-3 shrink-0 text-danger" aria-label={t('events.conflict')} />}
      <span className="truncate">{label}</span>
    </button>
  );
}

function MonthView({ days, month, onDay, ...p }: ViewProps & { days: DayStr[]; month: DayStr; onDay: (d: DayStr) => void }) {
  const mk = month.slice(0, 7);
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-line/70 bg-surface-2/60 text-center text-xs font-medium text-ink-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="py-2">{weekdayShort(i, p.locale)}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = itemsOnDay(p.items, d);
          const max = 3;
          return (
            <div
              key={d}
              onDragOver={(e) => e.preventDefault()}
              onDrop={p.dropOn(d)}
              className={cn('flex min-h-24 flex-col gap-0.5 border-e border-b border-line/50 p-1 sm:min-h-28', d.slice(0, 7) !== mk && 'bg-ink/[0.03]')}
            >
              <button
                type="button"
                onClick={() => onDay(d)}
                aria-label={fmtDay(d, p.locale, 'long')}
                className={cn('mb-0.5 grid size-7 place-items-center self-start rounded-full text-xs tabular-nums hover:bg-bg', d === p.today && 'bg-coral font-semibold', d.slice(0, 7) !== mk && 'text-ink-2/70')}
              >
                {fmtNumber(Number(d.slice(8)), p.locale)}
              </button>
              {list.slice(0, max).map((i) => <Chip key={i.key + d} item={i} conflict={p.conflicts.has(i.key)} compact {...p} />)}
              {list.length > max && (
                <button type="button" onClick={() => onDay(d)} className="px-1 text-start text-[0.7rem] font-medium text-coral-strong">
                  {p.t('planning.more', { n: list.length - max })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TimeGrid({ days, onSlot, ...p }: ViewProps & { days: DayStr[]; onSlot: (d: DayStr, time: string) => void }) {
  const hours = Array.from({ length: 24 - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
  const single = days.length === 1;
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <div className={cn(single ? 'min-w-0' : 'min-w-[720px]')}>
          {/* En-têtes + journée entière */}
          <div className="grid border-b border-line/70" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}>
            <div className="p-1 text-[0.65rem] text-ink-2">{p.t('planning.allDay')}</div>
            {days.map((d) => {
              const allDay = itemsOnDay(p.items, d).filter((i) => i.allDay);
              return (
                <div key={d} onDragOver={(e) => e.preventDefault()} onDrop={p.dropOn(d)} className="flex min-h-12 flex-col gap-0.5 border-s border-line/50 p-1">
                  <p className={cn('mb-1 text-center text-xs font-medium', d === p.today && 'text-coral-strong')}>
                    {fmtDay(d, p.locale, 'weekday')}
                  </p>
                  {allDay.map((i) => <Chip key={i.key} item={i} conflict={false} {...p} />)}
                  {single && allDay.length === 0 && itemsOnDay(p.items, d).length === 0 && <p className="py-2 text-center text-sm text-ink-2">{p.t('planning.empty')}</p>}
                </div>
              );
            })}
          </div>
          {/* Grille horaire */}
          <div className="relative grid max-h-[65vh] overflow-y-auto" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="relative border-b border-line/40 text-end text-[0.65rem] text-ink-2" style={{ height: HOUR_PX }}>
                  {h > FIRST_HOUR && <span className="absolute -top-2 end-1.5 bg-surface px-0.5">{fmtTime(`${String(h).padStart(2, '0')}:00`, p.locale)}</span>}
                </div>
              ))}
            </div>
            {days.map((d) => {
              const timed = itemsOnDay(p.items, d).filter((i) => !i.allDay && i.date === d);
              const cols = layoutColumns(timed);
              return (
                <div key={d} className="relative border-s border-line/50">
                  {hours.map((h) =>
                    [0, 30].map((m) => {
                      const time = `${String(h).padStart(2, '0')}:${m ? '30' : '00'}`;
                      return (
                        <button
                          key={time}
                          type="button"
                          aria-label={`${p.t('planning.newHere')} ${fmtDay(d, p.locale, 'short')} ${time}`}
                          onClick={() => onSlot(d, time)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={p.dropOn(d, time)}
                          className={cn('block w-full hover:bg-coral-soft/40', m ? 'border-b border-line/40' : 'border-b border-dashed border-line/25')}
                          style={{ height: HOUR_PX / 2 }}
                        />
                      );
                    }),
                  )}
                  {timed.map((i) => {
                    const top = ((Math.max(timeToMin(i.start), FIRST_HOUR * 60) - FIRST_HOUR * 60) / 60) * HOUR_PX;
                    const endMin = i.end ? timeToMin(i.end) : timeToMin(i.start) + 30;
                    const height = Math.max(22, ((endMin - Math.max(timeToMin(i.start), FIRST_HOUR * 60)) / 60) * HOUR_PX - 2);
                    const c = cols.get(i.key) ?? { col: 0, cols: 1 };
                    const isTask = i.kind === 'task';
                    return (
                      <button
                        key={i.key}
                        type="button"
                        draggable
                        onDragStart={(e) => p.onDragStart(e, i)}
                        onClick={() => p.onOpen(i)}
                        className={cn(
                          'absolute overflow-hidden rounded-lg px-1.5 py-1 text-start text-xs leading-tight text-ink shadow-soft',
                          isTask && 'border border-dashed border-ink/40 bg-white/90',
                          i.done && 'opacity-60 line-through',
                          p.conflicts.has(i.key) && 'ring-2 ring-danger/60',
                        )}
                        style={{
                          top,
                          height,
                          insetInlineStart: `calc(${(c.col / c.cols) * 100}% + 2px)`,
                          width: `calc(${100 / c.cols}% - 4px)`,
                          ...(isTask ? { borderInlineStart: `3px solid ${i.color}` } : { background: i.color }),
                        }}
                      >
                        <span className="block font-semibold">{i.title}</span>
                        <span className="block text-[0.68rem] text-ink-2">
                          {fmtTime(i.start, p.locale)}{i.end && `–${fmtTime(i.end, p.locale)}`}
                        </span>
                        {p.conflicts.has(i.key) && <TriangleAlert className="absolute end-1 top-1 size-3 text-danger" aria-label={p.t('events.conflict')} />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

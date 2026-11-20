import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { useTranslations, type Locale } from '@/i18n';
import type { AgendaItem, FinanceSummary, HabitToday, PriorityTask, ProjectSummary } from '@/types/dashboard';
import type { DashboardWidget } from '@/types/models';
import { AgendaWidget, FinanceWidget, HabitsWidget, PrioritiesWidget, ProjectsWidget } from './widgets';
import { MiniCalendar } from './MiniCalendar';
import { ALLOWED_SIZES, DEFAULT_LAYOUT, type WidgetId, type WidgetLayout } from './registry';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/primitives';
import { useTaskActions } from '@/components/tasks/useTaskActions';
import { useList } from '@/hooks/useList';
import { usePlanningRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, pb, updateRecord } from '@/lib/pocketbase/client';
import { topPriorities } from '@/lib/planning/tasks';
import { buildCalendarItems, itemsOnDay } from '@/lib/planning/calendar';
import { scheduledOn, isDone } from '@/lib/habits';
import { budgetStatus, periodTotals, savingsTotal, upcomingDues } from '@/lib/finance/compute';
import { addDays, endOfMonth, monthGridDays, startOfMonth } from '@/lib/utils/day';
import { fmtDay, fmtTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const SPAN: Record<WidgetLayout['size'], string> = {
  sm: 'lg:col-span-4',
  md: 'lg:col-span-6',
  lg: 'lg:col-span-8',
  full: 'lg:col-span-12',
};

export default function Dashboard({ locale, todayIso, timeZone, currency }: { locale: Locale; todayIso: string; timeZone: string; currency: string }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const taskActions = useTaskActions(locale, todayIso);
  const refs = usePlanningRefs();
  const today = todayIso;
  const monthFrom = startOfMonth(today);
  const monthTo = endOfMonth(today);
  const grid = monthGridDays(today);

  const widgetsQ = useList('dashboard_widgets', { sort: 'order' });
  const tasks = useList('tasks', { filter: `status = "todo" || status = "in_progress" || (status = "done" && completed_at >= "${today} 00:00:00")` });
  const events = useList('events', {});
  const projects = useList('projects', { filter: 'status = "in_progress" || status = "todo"' });
  const projectTasks = useList('tasks', { filter: 'project != ""' });
  const habits = useList('habits', { filter: 'archived = false', sort: 'sort,created' });
  const logs = useList('habit_logs', { filter: pb().filter('date = {:d}', { d: today }) });
  const txs = useList('transactions', { filter: pb().filter('date >= {:f} || status = "planned" || recurring != ""', { f: addDays(monthFrom, -1) }) });
  const budgets = useList('monthly_budgets', { filter: pb().filter('month = {:m}', { m: today.slice(0, 7) }) });
  const contribs = useList('savings_contributions', {});
  const recurring = useList('recurring_transactions', { filter: 'active = true' });
  const [customizing, setCustomizing] = useState(false);

  const layout: WidgetLayout[] = useMemo(() => {
    const saved = new Map(widgetsQ.items.map((w) => [w.widget, w]));
    return DEFAULT_LAYOUT.map((d) => {
      const s = saved.get(d.id);
      return s ? { id: d.id, visible: s.visible, order: s.order, size: (ALLOWED_SIZES[d.id].includes(s.size) ? s.size : d.size) as WidgetLayout['size'] } : d;
    }).sort((a, b) => a.order - b.order);
  }, [widgetsQ.items]);

  // ── Données des widgets ─────────────────────────────
  const priorities: PriorityTask[] = useMemo(
    () =>
      topPriorities(tasks.items.filter((x) => x.status !== 'done'), today).map((x) => ({
        id: x.id,
        title: x.title,
        category: refs.catById.get(x.category) ? { name: refs.catById.get(x.category)!.name, color: refs.catById.get(x.category)!.color } : null,
        priority: x.priority,
        due: x.start_date === today && x.start_time ? fmtTime(x.start_time, locale) : x.deadline ? fmtDay(x.deadline, locale, 'short') : null,
        done: false,
      })),
    [tasks.items, refs.catById, today, locale],
  );

  const monthItems = useMemo(
    () => buildCalendarItems({ from: grid[0]!, to: grid[grid.length - 1]!, events: events.items, tasks: tasks.items, recurring: recurring.items, planned: txs.items, categories: refs.catById, showDone: false }),
    [grid, events.items, tasks.items, recurring.items, txs.items, refs.catById],
  );

  const agenda: AgendaItem[] = useMemo(
    () =>
      itemsOnDay(monthItems, today)
        .filter((i) => i.kind === 'event' || i.kind === 'task')
        .map((i) => ({
          id: i.key,
          title: i.title,
          kind: i.kind === 'task' ? 'task' : 'event',
          start: fmtTime(i.start, locale),
          end: i.end ? fmtTime(i.end, locale) : null,
          allDay: i.allDay,
          category: null,
        })),
    [monthItems, today, locale],
  );

  const dots = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const d of grid) {
      const list = itemsOnDay(monthItems, d);
      if (list.length) m[d] = [...new Set(list.map((i) => i.color))].slice(0, 3);
    }
    return m;
  }, [monthItems, grid]);

  const projectSummaries: ProjectSummary[] = useMemo(
    () =>
      projects.items.slice(0, 4).map((p) => {
        const list = projectTasks.items.filter((x) => x.project === p.id && x.status !== 'cancelled');
        return { id: p.id, name: p.name, color: p.color || 'var(--color-coral)', done: list.filter((x) => x.status === 'done').length, total: list.length, deadline: p.deadline ? fmtDay(p.deadline, locale, 'short') : null };
      }),
    [projects.items, projectTasks.items, locale],
  );

  const habitsToday: HabitToday[] = useMemo(() => {
    const byHabit = new Map(logs.items.map((l) => [l.habit, l]));
    return habits.items.filter((h) => scheduledOn(h, today)).map((h) => ({ id: h.id, name: h.name, emoji: h.icon || '🌱', color: h.color || '#e6ece1', done: isDone(h, byHabit.get(h.id)) }));
  }, [habits.items, logs.items, today]);

  const finance: FinanceSummary | null = useMemo(() => {
    if (!txs.items.length && !budgets.items.length && !contribs.items.length && !recurring.items.length) return null;
    const totals = periodTotals(txs.items, monthFrom, monthTo);
    const b = budgetStatus(budgets.items, txs.items, today.slice(0, 7));
    const next = upcomingDues(recurring.items, txs.items, today, addDays(today, 60))[0];
    return {
      currency,
      incomeCents: totals.incomeCents,
      expenseCents: totals.expenseCents,
      budgetLeftCents: budgets.items.length ? b.remaining : null,
      savingsCents: savingsTotal(contribs.items),
      nextDue: next ? { label: next.label, date: fmtDay(next.date, locale, 'short'), amountCents: next.amountCents } : null,
    };
  }, [txs.items, budgets.items, contribs.items, recurring.items, monthFrom, monthTo, today, currency, locale]);

  async function toggleTask(id: string, done: boolean) {
    const tk = tasks.items.find((x) => x.id === id);
    if (tk) await taskActions.toggle(tk, done);
  }

  async function toggleHabit(id: string, done: boolean) {
    const h = habits.items.find((x) => x.id === id);
    const log = logs.items.find((l) => l.habit === id);
    if (!h) return;
    if (done) await run(() => (log ? updateRecord('habit_logs', log.id, { qty: Math.max(h.target_qty, 1) }) : createRecord('habit_logs', { habit: id, date: today, qty: Math.max(h.target_qty, 1) })));
    else if (log) await run(() => deleteRecord('habit_logs', log.id));
  }

  const loading = tasks.loading || widgetsQ.loading;
  const render: Record<WidgetId, () => ReactNode> = {
    priorities: () => <PrioritiesWidget items={priorities} t={t} onToggle={(id, d) => void toggleTask(id, d)} />,
    planning: () => <AgendaWidget items={agenda} t={t} />,
    calendar: () => <MiniCalendar locale={locale} todayIso={todayIso} timeZone={timeZone} dots={dots} />,
    projects: () => <ProjectsWidget items={projectSummaries} t={t} />,
    habits: () => <HabitsWidget items={habitsToday} t={t} onToggle={(id, d) => void toggleHabit(id, d)} />,
    finances: () => <FinanceWidget data={finance} t={t} locale={locale} />,
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => setCustomizing(true)} className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-medium hover:bg-surface/70">
          <LayoutGrid className="size-4" aria-hidden />
          {t('widgets.customize')}
        </button>
      </div>
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-56 lg:col-span-8" />
          <Skeleton className="h-56 lg:col-span-4" />
          <Skeleton className="h-48 lg:col-span-6" />
          <Skeleton className="h-48 lg:col-span-6" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {layout
            .filter((w) => w.visible)
            .map((w, i) => (
              <div key={w.id} className={cn(SPAN[w.size], w.size === 'full' && 'md:col-span-2')} style={{ animationDelay: `${i * 40}ms` }}>
                {render[w.id]()}
              </div>
            ))}
        </div>
      )}
      <Modal open={customizing} onClose={() => setCustomizing(false)} title={t('dashboardCustom.title')} closeLabel={t('actions.close')}>
        {customizing && <Customizer locale={locale} layout={layout} saved={widgetsQ.items} onDone={() => setCustomizing(false)} />}
      </Modal>
      {taskActions.elements}
    </>
  );
}

function Customizer({ locale, layout, saved, onDone }: { locale: Locale; layout: WidgetLayout[]; saved: DashboardWidget[]; onDone: () => void }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [items, setItems] = useState<WidgetLayout[]>(layout.map((w, i) => ({ ...w, order: i })));
  const [busy, setBusy] = useState(false);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setItems(next.map((w, k) => ({ ...w, order: k })));
  };
  async function save() {
    setBusy(true);
    await run(async () => {
      for (const w of items) {
        const existing = saved.find((s) => s.widget === w.id);
        const data = { widget: w.id, visible: w.visible, order: w.order, size: w.size };
        if (existing) await updateRecord('dashboard_widgets', existing.id, data);
        else await createRecord('dashboard_widgets', data);
      }
    }, 'feedback.saved');
    setBusy(false);
    onDone();
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">{t('dashboardCustom.hint')}</p>
      <ul className="flex flex-col gap-2">
        {items.map((w, i) => (
          <li key={w.id} className={cn('flex flex-wrap items-center gap-2 rounded-2xl bg-white/60 px-3 py-2', !w.visible && 'opacity-60')}>
            <button type="button" aria-pressed={w.visible} onClick={() => setItems(items.map((x) => (x.id === w.id ? { ...x, visible: !x.visible } : x)))} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={w.visible ? t('dashboardCustom.hide') : t('dashboardCustom.show')}>
              {w.visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
            </button>
            <span className="min-w-28 flex-1 font-medium">{t(`dashboardCustom.names.${w.id}`)}</span>
            <label className="text-xs text-ink-2">
              <span className="sr-only">{t('dashboardCustom.size')}</span>
              <select value={w.size} onChange={(e) => setItems(items.map((x) => (x.id === w.id ? { ...x, size: e.target.value as WidgetLayout['size'] } : x)))} className="h-9 rounded-xl bg-bg/50 px-2 text-sm">
                {ALLOWED_SIZES[w.id].map((s) => <option key={s} value={s}>{t(`dashboardCustom.sizes.${s}`)}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-9 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label={t('dashboardCustom.up')}>
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="grid size-9 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label={t('dashboardCustom.down')}>
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={() => setItems(DEFAULT_LAYOUT.map((w) => ({ ...w })))}>{t('dashboardCustom.reset')}</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>{t('actions.cancel')}</Button>
          <Button loading={busy} onClick={() => void save()}>{t('actions.save')}</Button>
        </div>
      </div>
    </div>
  );
}

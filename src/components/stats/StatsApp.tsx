import { useMemo, useState } from 'react';
import { Card, Progress, Skeleton } from '@/components/ui/primitives';
import { PageHeader, Segmented } from '@/components/ui/forms';
import { CategoryBars, IncomeExpenseChart, SimpleBars } from '@/components/finance/charts';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { usePlanningRefs } from '@/hooks/useRefs';
import { isOpen, isOverdue } from '@/lib/planning/tasks';
import { habitStats, isDone, scheduledOn } from '@/lib/habits';
import { lastMonths, monthlySeries, savingsTotal, sumCents } from '@/lib/finance/compute';
import { formatCents } from '@/lib/finance/money';
import { addDays, startOfWeek } from '@/lib/utils/day';
import { fmtDay, fmtNumber } from '@/lib/utils/format';
import { projectProgress } from '@/components/projects/ProjectsApp';

type Tab = 'productivity' | 'habits' | 'finances';
const MIN_DAYS = 7;

export default function StatsApp({ locale, today, currency }: { locale: Locale; today: string; currency: string }) {
  const t = useTranslations(locale);
  const [tab, setTab] = useState<Tab>('productivity');
  return (
    <>
      <PageHeader title={t('stats.title')} />
      <div className="mb-5"><Segmented label={t('stats.title')} value={tab} onChange={setTab} options={(['productivity', 'habits', 'finances'] as const).map((v) => ({ value: v, label: t(`stats.tabs.${v}`) }))} /></div>
      {tab === 'productivity' && <Productivity locale={locale} today={today} />}
      {tab === 'habits' && <Habits locale={locale} today={today} />}
      {tab === 'finances' && <Finances locale={locale} today={today} currency={currency} />}
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function NotEnough({ t }: { t: ReturnType<typeof useTranslations> }) {
  return <p className="rounded-2xl bg-surface/70 p-5 text-ink-2">{t('stats.notEnough')}</p>;
}

/** Ancienneté des données : on n'affiche pas de tendance sur moins de MIN_DAYS jours. */
function dataAgeDays(items: Array<{ created: string }>, today: string): number {
  const first = items.reduce((min, i) => (i.created && i.created.slice(0, 10) < min ? i.created.slice(0, 10) : min), today);
  return Math.round((Date.parse(today) - Date.parse(first)) / 86400000);
}

function Productivity({ locale, today }: { locale: Locale; today: string }) {
  const t = useTranslations(locale);
  const tasks = useList('tasks', {});
  const projects = useList('projects', { filter: 'status != "archived"' });
  const refs = usePlanningRefs();
  const s = useMemo(() => {
    const since = addDays(today, -29);
    const done30 = tasks.items.filter((x) => x.status === 'done' && x.completed_at.slice(0, 10) >= since);
    const created30 = tasks.items.filter((x) => x.created.slice(0, 10) >= since && x.status !== 'cancelled');
    const weeks = Array.from({ length: 8 }, (_, i) => startOfWeek(addDays(today, -7 * (7 - i))));
    const weekly = weeks.map((w) => ({ label: fmtDay(w, locale, 'short'), value: tasks.items.filter((x) => x.status === 'done' && x.completed_at.slice(0, 10) >= w && x.completed_at.slice(0, 10) <= addDays(w, 6)).length }));
    const byCat = new Map<string, number>();
    for (const x of tasks.items.filter(isOpen)) byCat.set(x.category, (byCat.get(x.category) ?? 0) + 1);
    return {
      done30: done30.length,
      overdue: tasks.items.filter((x) => isOverdue(x, today)).length,
      open: tasks.items.filter(isOpen).length,
      rate: created30.length >= 3 ? Math.round((created30.filter((x) => x.status === 'done').length / created30.length) * 100) : null,
      weekly,
      byCat: [...byCat.entries()].map(([id, n]) => ({ name: refs.catById.get(id)?.name ?? t('fields.noCategory'), cents: n })),
      age: dataAgeDays(tasks.items, today),
    };
  }, [tasks.items, refs.catById, today, locale, t]);

  if (tasks.loading) return <Skeleton className="h-64" />;
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:col-span-12">
        <Kpi label={t('stats.done30')} value={fmtNumber(s.done30, locale)} />
        <Kpi label={t('stats.openNow')} value={fmtNumber(s.open, locale)} />
        <Kpi label={t('stats.overdueNow')} value={fmtNumber(s.overdue, locale)} />
        <Kpi label={t('stats.completionRate')} value={s.rate === null ? '—' : `${fmtNumber(s.rate, locale)} %`} />
      </div>
      <Card className="p-5 lg:col-span-7">
        <h2 className="mb-3 font-display text-lg font-semibold">{t('stats.weekly')}</h2>
        {s.age < MIN_DAYS ? <NotEnough t={t} /> : <SimpleBars data={s.weekly} label={t('stats.weekly')} />}
      </Card>
      <Card className="p-5 lg:col-span-5">
        <h2 className="mb-3 font-display text-lg font-semibold">{t('stats.byCategory')}</h2>
        {s.byCat.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {s.byCat.sort((a, b) => b.cents - a.cents).map((c) => (
              <li key={c.name} className="flex justify-between rounded-xl bg-white/55 px-3 py-2"><span>{c.name}</span><span className="font-semibold tabular-nums">{fmtNumber(c.cents, locale)}</span></li>
            ))}
          </ul>
        ) : <NotEnough t={t} />}
      </Card>
      <Card className="p-5 lg:col-span-12">
        <h2 className="mb-3 font-display text-lg font-semibold">{t('stats.projects')}</h2>
        {projects.items.length === 0 ? <NotEnough t={t} /> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {projects.items.map((p) => {
              const prog = projectProgress(tasks.items.filter((x) => x.project === p.id));
              return (
                <li key={p.id} className="rounded-2xl bg-white/55 p-3">
                  <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{p.icon} {p.name}</span><span className="tabular-nums">{fmtNumber(prog.pct, locale)} %</span></div>
                  <Progress value={prog.pct} label={p.name} color={p.color || undefined} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Habits({ locale, today }: { locale: Locale; today: string }) {
  const t = useTranslations(locale);
  const habits = useList('habits', { filter: 'archived = false' });
  const logs = useList('habit_logs', {});
  const s = useMemo(() => {
    const per = habits.items.map((h) => ({ h, st: habitStats(h, logs.items, addDays(today, -29), today, today) }));
    const scheduled = per.reduce((a, b) => a + b.st.scheduled, 0);
    const done = per.reduce((a, b) => a + b.st.done, 0);
    const weeks = Array.from({ length: 8 }, (_, i) => startOfWeek(addDays(today, -7 * (7 - i))));
    const weekly = weeks.map((w) => {
      let sch = 0;
      let ok = 0;
      for (let d = w; d <= addDays(w, 6) && d < today; d = addDays(d, 1))
        for (const h of habits.items)
          if (scheduledOn(h, d)) {
            sch++;
            if (isDone(h, logs.items.find((l) => l.habit === h.id && l.date === d))) ok++;
          }
      return { label: fmtDay(w, locale, 'short'), value: sch ? Math.round((ok / sch) * 100) : 0, sch };
    });
    return { per, rate: scheduled >= MIN_DAYS ? Math.round((done / scheduled) * 100) : null, weekly: weekly.filter((w) => w.sch > 0) };
  }, [habits.items, logs.items, today, locale]);

  if (habits.loading) return <Skeleton className="h-64" />;
  if (!habits.items.length) return <NotEnough t={t} />;
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4"><Kpi label={t('stats.habitRate')} value={s.rate === null ? '—' : `${fmtNumber(s.rate, locale)} %`} /></div>
      <Card className="p-5 lg:col-span-8">
        <h2 className="mb-3 font-display text-lg font-semibold">{t('stats.habitWeek')}</h2>
        {s.weekly.length < 2 ? <NotEnough t={t} /> : <SimpleBars data={s.weekly} label={t('stats.habitWeek')} valueFormat={(v) => `${v} %`} />}
      </Card>
      <Card className="p-5 lg:col-span-12">
        <ul className="grid gap-3 md:grid-cols-2">
          {s.per.map(({ h, st }) => (
            <li key={h.id} className="rounded-2xl bg-white/55 p-3">
              <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{h.icon} {h.name}</span><span className="tabular-nums">{st.rate === null ? '—' : `${fmtNumber(st.rate, locale)} %`}</span></div>
              <Progress value={st.rate ?? 0} label={h.name} color="var(--color-sage-strong)" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Finances({ locale, today, currency }: { locale: Locale; today: string; currency: string }) {
  const t = useTranslations(locale);
  const txs = useList('transactions', {});
  const contribs = useList('savings_contributions', {});
  const refs = useFinanceRefsLite();
  const s = useMemo(() => {
    const months = lastMonths(today, 12);
    const series = monthlySeries(txs.items, months);
    const complete = series.slice(0, -1).filter((m) => m.incomeCents || m.expenseCents);
    const avg = complete.length ? Math.round(sumCents(complete.map((m) => m.expenseCents)) / complete.length) : null;
    const byCat = new Map<string, number>();
    const since = addDays(today, -365);
    for (const x of txs.items) if (x.type === 'expense' && x.status === 'confirmed' && x.date >= since) byCat.set(x.category, (byCat.get(x.category) ?? 0) + x.amount_cents);
    return { series, avg, byCat: [...byCat.entries()].map(([id, cents]) => ({ name: refs.get(id) ?? t('finance.noCategory'), cents })) };
  }, [txs.items, today, refs, t]);
  if (txs.loading) return <Skeleton className="h-64" />;
  const has = s.series.some((m) => m.incomeCents || m.expenseCents);
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="grid grid-cols-2 gap-4 lg:col-span-12">
        <Kpi label={t('stats.savingsTotal')} value={formatCents(savingsTotal(contribs.items), currency, locale)} />
        <Kpi label={t('stats.avgExpense')} value={s.avg === null ? '—' : formatCents(s.avg, currency, locale)} />
      </div>
      <Card className="p-5 lg:col-span-7">
        <h2 className="mb-3 font-display text-lg font-semibold">{t('stats.incomeVsExpense')}</h2>
        {has ? <IncomeExpenseChart data={s.series} locale={locale} currency={currency} t={t} /> : <NotEnough t={t} />}
      </Card>
      <Card className="p-5 lg:col-span-5">
        <h2 className="mb-3 font-display text-lg font-semibold">{t('finance.reports.byCategory')}</h2>
        {s.byCat.length ? <CategoryBars data={s.byCat} locale={locale} currency={currency} caption={t('finance.reports.byCategory')} /> : <NotEnough t={t} />}
      </Card>
    </div>
  );
}

function useFinanceRefsLite() {
  const cats = useList('finance_categories', {});
  return useMemo(() => new Map(cats.items.map((c) => [c.id, `${c.icon} ${c.name}`])), [cats.items]);
}

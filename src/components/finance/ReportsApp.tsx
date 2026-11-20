import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/forms';
import { CategoryBars } from './charts';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useFinanceRefs } from '@/hooks/useRefs';
import { budgetStatus, periodTotals, savingsTotal, spendByCategory } from '@/lib/finance/compute';
import { formatCents } from '@/lib/finance/money';
import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek } from '@/lib/utils/day';
import { fmtDay, fmtMonth, fmtNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export default function ReportsApp({ locale, today, currency, alertPct }: { locale: Locale; today: string; currency: string; alertPct: number }) {
  const t = useTranslations(locale);
  const refs = useFinanceRefs();
  const txs = useList('transactions', {});
  const contribs = useList('savings_contributions', {});
  const budgets = useList('monthly_budgets', {});
  const [kind, setKind] = useState<'week' | 'month'>('month');
  const [anchor, setAnchor] = useState(today);
  const money = (c: number) => formatCents(c, currency, locale);

  const period = useMemo(() => {
    if (kind === 'week') {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, 6), prevFrom: addDays(from, -7), prevTo: addDays(from, -1), label: `${fmtDay(from, locale, 'short')} – ${fmtDay(addDays(from, 6), locale, 'medium')}` };
    }
    const from = startOfMonth(anchor);
    const prev = addMonths(from, -1);
    return { from, to: endOfMonth(from), prevFrom: prev, prevTo: endOfMonth(prev), label: fmtMonth(from, locale) };
  }, [kind, anchor, locale]);

  const r = useMemo(() => {
    const cur = periodTotals(txs.items, period.from, period.to);
    const prev = periodTotals(txs.items, period.prevFrom, period.prevTo);
    const saved = savingsTotal(contribs.items.filter((c) => c.date >= period.from && c.date <= period.to));
    const spend = spendByCategory(txs.items, period.from, period.to);
    const byCat = [...spend.entries()].map(([id, cents]) => ({ id, name: refs.catById.get(id)?.name ?? t('finance.noCategory'), cents })).sort((a, b) => b.cents - a.cents);
    const over = kind === 'month' ? budgetStatus(budgets.items, txs.items, period.from.slice(0, 7), alertPct).lines.filter((l) => l.state === 'over') : [];
    const delta = prev.expenseCents > 0 ? Math.round(((cur.expenseCents - prev.expenseCents) / prev.expenseCents) * 100) : null;
    const advice: string[] = [];
    if (cur.expenseCents === 0 && cur.incomeCents === 0) advice.push(t('finance.reports.adviceNoData'));
    else {
      for (const o of over) advice.push(t('finance.reports.adviceOver', { name: refs.catById.get(o.category)?.name ?? '?' }));
      if (delta !== null && delta >= 10) advice.push(t('finance.reports.adviceUp', { pct: fmtNumber(delta, locale) }));
      if (delta !== null && delta <= -10) advice.push(t('finance.reports.adviceDown', { pct: fmtNumber(-delta, locale) }));
      const top = byCat[0];
      if (top && cur.expenseCents > 0 && byCat.length > 1) {
        const pct = Math.round((top.cents / cur.expenseCents) * 100);
        if (pct >= 40) advice.push(t('finance.reports.adviceTopCat', { name: top.name, pct: fmtNumber(pct, locale) }));
      }
      if (cur.netCents > 0 && saved < cur.netCents) advice.push(t('finance.reports.adviceSave', { amount: money(Math.floor((cur.netCents - saved) / 2)) }));
    }
    return { cur, prev, saved, byCat, over, delta, advice };
  }, [txs.items, contribs.items, budgets.items, period, refs.catById, kind, alertPct, t, locale]);

  const move = (dir: -1 | 1) => setAnchor((a) => (kind === 'week' ? addDays(a, 7 * dir) : addMonths(a, dir)));

  if (txs.loading) return <Skeleton className="h-64" />;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label={t('finance.reports.title')} value={kind} onChange={setKind} options={[{ value: 'week', label: t('finance.reports.weekly') }, { value: 'month', label: t('finance.reports.monthly') }]} />
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => move(-1)} className="grid size-10 place-items-center rounded-full bg-surface/70" aria-label={t('planning.prev')}><ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden /></button>
          <p className="min-w-40 text-center font-display font-semibold">{period.label}</p>
          <button type="button" onClick={() => move(1)} className="grid size-10 place-items-center rounded-full bg-surface/70" aria-label={t('planning.next')}><ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden /></button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label={t('finance.reports.income')} value={money(r.cur.incomeCents)} prev={money(r.prev.incomeCents)} t={t} />
        <Kpi label={t('finance.reports.expenses')} value={money(r.cur.expenseCents)} prev={money(r.prev.expenseCents)} t={t} delta={r.delta} />
        <Kpi label={t('finance.reports.net')} value={money(r.cur.netCents)} prev={money(r.prev.netCents)} t={t} negative={r.cur.netCents < 0} />
        <Kpi label={t('finance.reports.savingsDone')} value={money(r.saved)} t={t} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">{t('finance.reports.byCategory')}</h2>
          {r.byCat.length ? <CategoryBars data={r.byCat} locale={locale} currency={currency} t={t} caption={t('finance.reports.byCategory')} /> : <p className="text-sm text-ink-2">{t('finance.overview.noData')}</p>}
        </Card>
        <div className="flex flex-col gap-4">
          {kind === 'month' && (
            <Card className="p-5">
              <h2 className="mb-2 font-display text-lg font-semibold">{t('finance.reports.overBudgets')}</h2>
              {r.over.length === 0 ? <p className="text-sm text-ink-2">{t('finance.reports.noneOver')}</p> : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {r.over.map((o) => <li key={o.category} className="flex justify-between rounded-xl bg-danger/10 px-3 py-2 text-danger"><span>{refs.catById.get(o.category)?.name}</span><span className="tabular-nums">+{money(-o.remainingCents)}</span></li>)}
                </ul>
              )}
            </Card>
          )}
          <Card tone="apricot" className="p-5">
            <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold"><Lightbulb className="size-5" aria-hidden />{t('finance.reports.advice')}</h2>
            <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm">{r.advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, prev, delta, negative, t }: { label: string; value: string; prev?: string; delta?: number | null; negative?: boolean; t: ReturnType<typeof useTranslations> }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-2">{label}</p>
      <p className={cn('font-display text-2xl font-semibold tabular-nums', negative && 'text-danger')}>{value}</p>
      {prev !== undefined && (
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-2">
          {delta !== undefined && delta !== null && (delta > 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />)}
          {t('finance.reports.prevPeriod')} : {prev}
        </p>
      )}
    </Card>
  );
}

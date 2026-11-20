import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Minus, Plus, Settings2, Tags } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Card, Progress, Skeleton } from '@/components/ui/primitives';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { AccountsManager, FinanceCategoriesManager, confirmDue } from './common';
import { CategoryBars, IncomeExpenseChart } from './charts';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useFinanceRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { budgetStatus, forecastBalance, lastMonths, monthlySeries, overdueDues, periodTotals, recordedBalance, savingsTotal, spendByCategory, upcomingDues } from '@/lib/finance/compute';
import { formatCents } from '@/lib/finance/money';
import { addDays, endOfMonth, startOfMonth } from '@/lib/utils/day';
import { fmtDay, fmtNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { TxType } from '@/types/models';

export default function FinanceOverview({ locale, today, currency, alertPct }: { locale: Locale; today: string; currency: string; alertPct: number }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = useFinanceRefs();
  const allAccounts = useList('finance_accounts', { sort: 'name' });
  const txs = useList('transactions', { sort: '-date' });
  const budgets = useList('monthly_budgets', { filter: `month = "${today.slice(0, 7)}"` });
  const recurring = useList('recurring_transactions', { filter: 'active = true' });
  const contribs = useList('savings_contributions', {});
  const [newTx, setNewTx] = useState<TxType | null>(null);
  const [manage, setManage] = useState<'accounts' | 'categories' | null>(null);

  const monthFrom = startOfMonth(today);
  const monthTo = endOfMonth(today);
  const money = (c: number) => formatCents(c, currency, locale);

  const d = useMemo(() => {
    const recorded = recordedBalance(allAccounts.items, txs.items, today);
    const upcomingMonth = upcomingDues(recurring.items, txs.items, today, monthTo);
    const totals = periodTotals(txs.items, monthFrom, monthTo);
    const b = budgetStatus(budgets.items, txs.items, today.slice(0, 7), alertPct);
    const spend = spendByCategory(txs.items, monthFrom, monthTo);
    return {
      recorded,
      forecast: forecastBalance(recorded, upcomingMonth),
      totals,
      budget: b,
      savings: savingsTotal(contribs.items),
      upcoming: upcomingDues(recurring.items, txs.items, today, addDays(today, 45)).filter((u) => u.type === 'expense').slice(0, 6),
      overdue: overdueDues(recurring.items, txs.items, today),
      series: monthlySeries(txs.items, lastMonths(today, 6)),
      byCat: [...spend.entries()].map(([id, cents]) => ({ name: refs.catById.get(id)?.name ?? t('finance.noCategory'), cents })),
    };
  }, [allAccounts.items, txs.items, recurring.items, budgets.items, contribs.items, today, monthFrom, monthTo, alertPct, refs.catById, t]);

  const alerts = d.budget.lines
    .filter((l) => l.state !== 'ok')
    .map((l) => ({
      over: l.state === 'over',
      text: l.state === 'over' ? t('finance.overview.budgetOver', { name: refs.catById.get(l.category)?.name ?? '?', amount: money(-l.remainingCents) }) : t('finance.overview.budgetWarning', { name: refs.catById.get(l.category)?.name ?? '?', pct: fmtNumber(Math.round(l.pct), locale) }),
    }));

  const confirm = (u: (typeof d.upcoming)[number]) => run(() => confirmDue(u, recurring.items, refs.accounts[0]?.id ?? '', currency), 'finance.overview.confirmed');

  if (txs.loading || allAccounts.loading) return <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>;

  const hasSeries = d.series.some((s) => s.incomeCents || s.expenseCents);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button icon={<Minus className="size-4" aria-hidden />} onClick={() => setNewTx('expense')}>{t('finance.tx.newExpense')}</Button>
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setNewTx('income')}>{t('finance.tx.newIncome')}</Button>
        <Button variant="ghost" icon={<Settings2 className="size-4" aria-hidden />} onClick={() => setManage('accounts')}>{t('finance.overview.manageAccounts')}</Button>
        <Button variant="ghost" icon={<Tags className="size-4" aria-hidden />} onClick={() => setManage('categories')}>{t('finance.categories.title')}</Button>
      </div>

      {/* Les trois soldes, clairement distincts */}
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <BalanceCard label={t('finance.overview.recorded')} hint={t('finance.overview.recordedHint')} value={money(d.recorded)} tone="surface" />
        <BalanceCard label={t('finance.overview.budgetLeft')} hint={t('finance.overview.budgetLeftHint')} value={budgets.items.length ? money(d.budget.remaining) : t('finance.overview.noBudget')} muted={!budgets.items.length} tone="apricot" negative={budgets.items.length > 0 && d.budget.remaining < 0} />
        <BalanceCard label={t('finance.overview.forecast')} hint={t('finance.overview.forecastHint')} value={money(d.forecast)} tone="peach" negative={d.forecast < 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-4">
          <dl className="grid gap-3">
            <Line label={t('finance.overview.monthIncome')} value={money(d.totals.incomeCents)} />
            <Line label={t('finance.overview.monthExpense')} value={money(d.totals.expenseCents)} />
            <Line label={t('finance.overview.savings')} value={money(d.savings)} />
          </dl>
          {budgets.items.length > 0 && (
            <div className="mt-4">
              <Progress value={d.budget.totalBudget ? (d.budget.totalSpent / d.budget.totalBudget) * 100 : 0} label={t('finance.overview.budgetLeft')} />
              <p className="mt-1 text-xs text-ink-2">{money(d.budget.totalSpent)} / {money(d.budget.totalBudget)}</p>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-4">
          <h2 className="mb-3 font-display text-lg font-semibold">{t('finance.overview.alerts')}</h2>
          {alerts.length === 0 && d.overdue.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ink-2"><CheckCircle2 className="size-4 text-sage-strong" aria-hidden />{t('finance.overview.noAlerts')}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {alerts.map((a, i) => (
                <li key={i} className={cn('flex items-start gap-2 rounded-xl px-3 py-2', a.over ? 'bg-danger/10 text-danger' : 'bg-apricot-soft')}>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{a.text}
                </li>
              ))}
              {d.overdue.length > 0 && <li className="mt-1 text-xs font-semibold text-ink-2">{t('finance.overview.toConfirm')}</li>}
              {d.overdue.map((u) => (
                <li key={u.key} className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2">
                  <Info className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1">{u.label} · {fmtDay(u.date, locale, 'short')}</span>
                  <span className="tabular-nums">{money(u.amountCents)}</span>
                  <Button size="sm" variant="secondary" onClick={() => void confirm(u)}>{t('finance.overview.confirmPayment')}</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-4">
          <h2 className="mb-3 font-display text-lg font-semibold">{t('finance.overview.upcoming')}</h2>
          {d.upcoming.length === 0 ? (
            <p className="text-sm text-ink-2">{t('finance.overview.upcomingEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {d.upcoming.map((u) => (
                <li key={u.key} className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2">
                  <span className="flex-1">{u.label}<span className="block text-xs text-ink-2">{fmtDay(u.date, locale, 'weekday')}</span></span>
                  <span className="font-semibold tabular-nums">{money(u.amountCents)}</span>
                  {u.date <= today && <Button size="sm" variant="secondary" onClick={() => void confirm(u)}>{t('finance.overview.confirmPayment')}</Button>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-7">
          <h2 className="mb-3 font-display text-lg font-semibold">{t('finance.overview.evolution')}</h2>
          {hasSeries ? <IncomeExpenseChart data={d.series} locale={locale} currency={currency} t={t} /> : <p className="text-sm text-ink-2">{t('finance.overview.noData')}</p>}
        </Card>
        <Card className="p-5 lg:col-span-5">
          <h2 className="mb-3 font-display text-lg font-semibold">{t('finance.overview.byCategory')}</h2>
          {d.byCat.length ? <CategoryBars data={d.byCat} locale={locale} currency={currency} t={t} caption={t('finance.overview.byCategory')} /> : <p className="text-sm text-ink-2">{t('finance.overview.noData')}</p>}
        </Card>
      </div>

      <Modal open={!!newTx} onClose={() => setNewTx(null)} title={newTx === 'income' ? t('finance.tx.newIncome') : t('finance.tx.newExpense')} closeLabel={t('actions.close')}>
        {newTx && <TransactionForm locale={locale} currency={currency} today={today} defaults={{ type: newTx }} onDone={() => setNewTx(null)} />}
      </Modal>
      <Modal open={!!manage} onClose={() => setManage(null)} title={manage === 'accounts' ? t('finance.accounts.title') : t('finance.categories.title')} closeLabel={t('actions.close')}>
        {manage === 'accounts' && <AccountsManager locale={locale} accounts={allAccounts.items} txs={txs.items} today={today} currency={currency} />}
        {manage === 'categories' && <FinanceCategoriesManager locale={locale} categories={refs.categories} />}
      </Modal>
    </>
  );
}

function BalanceCard({ label, hint, value, tone, negative, muted }: { label: string; hint: string; value: string; tone: 'surface' | 'apricot' | 'peach'; negative?: boolean; muted?: boolean }) {
  return (
    <Card tone={tone} className="p-5">
      <p className="text-sm font-medium">{label}</p>
      <p className={cn('mt-1 font-display font-semibold tabular-nums', muted ? 'text-lg text-ink-2' : 'text-3xl', negative && 'text-danger')}>{value}</p>
      <p className="mt-2 text-xs text-ink-2">{hint}</p>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

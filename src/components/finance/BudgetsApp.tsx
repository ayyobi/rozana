import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Card, Progress, Skeleton } from '@/components/ui/primitives';
import { Input } from '@/components/ui/forms';
import { MoneyInput } from '@/components/forms/TransactionForm';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useFinanceRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, pb, updateRecord } from '@/lib/pocketbase/client';
import { budgetStatus, centsToInput, parseAmountToCents, periodTotals, suggestBudgets } from '@/lib/finance/compute';
import { formatCents } from '@/lib/finance/money';
import { addMonths, endOfMonth } from '@/lib/utils/day';
import { fmtMonth } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export default function BudgetsApp({ locale, today, currency, alertPct }: { locale: Locale; today: string; currency: string; alertPct: number }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = useFinanceRefs();
  const [month, setMonth] = useState(today.slice(0, 7));
  const budgets = useList('monthly_budgets', { filter: pb().filter('month = {:m} || month = {:p}', { m: month, p: addMonths(`${month}-01`, -1).slice(0, 7) }) });
  const txs = useList('transactions', { filter: pb().filter('date >= {:f}', { f: addMonths(`${month}-01`, -4) }) });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState(false);

  const expenseCats = refs.categories.filter((c) => c.kind === 'expense');
  const current = budgets.items.filter((b) => b.month === month);
  const prev = budgets.items.filter((b) => b.month !== month);

  useEffect(() => {
    setDraft(Object.fromEntries(current.map((b) => [b.category, centsToInput(b.amount_cents)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets.items, month]);

  const status = useMemo(() => budgetStatus(current, txs.items, month, alertPct), [current, txs.items, month, alertPct]);
  const money = (c: number) => formatCents(c, currency, locale);

  async function saveAll(values: Record<string, string>, source: 'manual' | 'suggested' = 'manual') {
    setBusy(true);
    await run(async () => {
      for (const c of expenseCats) {
        const raw = (values[c.id] ?? '').trim();
        const existing = current.find((b) => b.category === c.id);
        const cents = raw ? parseAmountToCents(raw) : null;
        if (raw && cents === null) throw Object.assign(new Error('invalid'), { status: 400 });
        if (cents === null || cents === 0) {
          if (existing) await deleteRecord('monthly_budgets', existing.id);
        } else if (existing) {
          if (existing.amount_cents !== cents) await updateRecord('monthly_budgets', existing.id, { amount_cents: cents, source });
        } else await createRecord('monthly_budgets', { month, category: c.id, amount_cents: cents, source });
      }
    }, 'feedback.saved');
    setBusy(false);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))} className="grid size-10 place-items-center rounded-full bg-surface/70" aria-label={t('planning.prev')}><ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden /></button>
          <button type="button" onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))} className="grid size-10 place-items-center rounded-full bg-surface/70" aria-label={t('planning.next')}><ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden /></button>
          <p className="ms-2 font-display text-lg font-semibold">{fmtMonth(`${month}-01`, locale)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {prev.length > 0 && <Button variant="secondary" size="sm" icon={<Copy className="size-4" aria-hidden />} onClick={() => setDraft(Object.fromEntries(prev.map((b) => [b.category, centsToInput(b.amount_cents)])))}>{t('finance.budgets.copyPrev')}</Button>}
          <Button size="sm" icon={<Sparkles className="size-4" aria-hidden />} onClick={() => setSuggesting(true)}>{t('finance.budgets.suggest')}</Button>
        </div>
      </div>

      {budgets.loading || refs.loading ? (
        <Skeleton className="h-64" />
      ) : (
        <Card className="p-4 sm:p-5">
          <form onSubmit={(e) => { e.preventDefault(); void saveAll(draft); }}>
            <ul className="flex flex-col gap-3">
              {expenseCats.map((c) => {
                const line = status.lines.find((l) => l.category === c.id);
                return (
                  <li key={c.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_7.5rem] items-center gap-3 sm:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_8rem]">
                    <span className="grid size-9 place-items-center rounded-xl" style={{ background: c.color || '#eee' }} aria-hidden>{c.icon}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}{c.essential && <span className="ms-1 text-xs text-ink-2">· {t('finance.categories.essential')}</span>}</p>
                      {line && <p className={cn('text-xs', line.state === 'over' ? 'font-semibold text-danger' : 'text-ink-2')}>{t('finance.budgets.spent')} {money(line.spentCents)} · {t('finance.budgets.remaining')} {money(line.remainingCents)}</p>}
                    </div>
                    <div className="hidden sm:block">{line && <Progress value={line.pct} label={c.name} color={line.state === 'over' ? 'var(--color-danger)' : line.state === 'warning' ? '#B7791F' : undefined} />}</div>
                    <label className="flex items-center gap-1">
                      <span className="sr-only">{t('finance.budgets.budget')} · {c.name}</span>
                      <input inputMode="decimal" dir="ltr" placeholder="0,00" value={draft[c.id] ?? ''} onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })} className="h-10 w-full rounded-xl border border-line bg-white/70 px-3 text-end tabular-nums outline-none focus:border-coral-strong" />
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-sm">
                <span className="text-ink-2">{t('finance.budgets.total')} : </span>
                <span className="font-semibold tabular-nums">{money(status.totalBudget)}</span>
                <span className="text-ink-2"> · {t('finance.budgets.spent')} {money(status.totalSpent)}</span>
              </p>
              <Button type="submit" loading={busy}>{t('finance.budgets.saveAll')}</Button>
            </div>
          </form>
        </Card>
      )}

      <Modal open={suggesting} onClose={() => setSuggesting(false)} title={t('finance.budgets.suggestionTitle')} closeLabel={t('actions.close')}>
        {suggesting && (
          <Suggestion
            locale={locale}
            currency={currency}
            month={month}
            categories={expenseCats}
            txs={txs.items}
            defaultIncome={(() => {
              const p = addMonths(`${month}-01`, -1);
              return periodTotals(txs.items, p, endOfMonth(p)).incomeCents;
            })()}
            onAccept={async (v) => { setDraft(v); setSuggesting(false); await saveAll(v, 'suggested'); }}
            onCancel={() => setSuggesting(false)}
          />
        )}
      </Modal>
    </>
  );
}

function Suggestion({ locale, currency, month, categories, txs, defaultIncome, onAccept, onCancel }: { locale: Locale; currency: string; month: string; categories: Array<{ id: string; name: string; icon: string; essential: boolean }>; txs: Parameters<typeof suggestBudgets>[0]['txs']; defaultIncome: number; onAccept: (v: Record<string, string>) => void; onCancel: () => void }) {
  const t = useTranslations(locale);
  const [income, setIncome] = useState(centsToInput(defaultIncome));
  const [rate, setRate] = useState('10');
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const compute = () => {
    const cents = parseAmountToCents(income) ?? 0;
    const s = suggestBudgets({ expectedIncomeCents: cents, categories, txs, month, savingsRatePct: Math.min(90, Math.max(0, Number(rate) || 0)) });
    setValues(Object.fromEntries([...s.entries()].map(([k, v]) => [k, centsToInput(v)])));
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">{t('finance.budgets.suggestionHint')}</p>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label={t('finance.budgets.expectedIncome')} value={income} onChange={setIncome} currency={currency} />
        <Input label={t('finance.budgets.savingsRate')} type="number" min={0} max={90} value={rate} onChange={(e) => setRate(e.target.value)} />
      </div>
      <Button variant="secondary" icon={<Sparkles className="size-4" aria-hidden />} onClick={compute}>{t('finance.budgets.suggest')}</Button>
      {values && (
        <ul className="flex flex-col gap-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{c.icon} {c.name}</span>
              <input aria-label={c.name} inputMode="decimal" dir="ltr" value={values[c.id] ?? ''} onChange={(e) => setValues({ ...values, [c.id]: e.target.value })} className="h-9 w-32 rounded-xl border border-line bg-white/70 px-3 text-end tabular-nums" />
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>{t('actions.cancel')}</Button>
        <Button disabled={!values} onClick={() => values && onAccept(values)}>{t('finance.budgets.accept')}</Button>
      </div>
    </div>
  );
}

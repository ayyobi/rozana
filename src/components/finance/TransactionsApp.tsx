import { useMemo, useState } from 'react';
import { Minus, Plus, Repeat, Search, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { Coins } from '@/components/ui/illustrations';
import { ConfirmDialog, Input, Select } from '@/components/ui/forms';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useFinanceRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { deleteRecord } from '@/lib/pocketbase/client';
import { sumCents } from '@/lib/finance/compute';
import { formatCents } from '@/lib/finance/money';
import { fmtDay } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Transaction, TxType } from '@/types/models';

export default function TransactionsApp({ locale, today, currency }: { locale: Locale; today: string; currency: string }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = useFinanceRefs();
  const txs = useList('transactions', { sort: '-date,-created' });
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [cat, setCat] = useState('');
  const [acc, setAcc] = useState('');
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [form, setForm] = useState<{ tx: Transaction | null; type?: TxType } | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLocaleLowerCase();
    return txs.items.filter(
      (x) =>
        (!month || x.date.startsWith(month)) &&
        (!type || x.type === type) &&
        (!cat || (cat === '-' ? !x.category : x.category === cat)) &&
        (!acc || x.account === acc) &&
        (!status || x.status === status) &&
        (!s || x.description.toLocaleLowerCase().includes(s) || (refs.catById.get(x.category)?.name ?? '').toLocaleLowerCase().includes(s)),
    );
  }, [txs.items, q, type, cat, acc, status, month, refs.catById]);

  const confirmed = list.filter((x) => x.status === 'confirmed');
  const income = sumCents(confirmed.filter((x) => x.type === 'income').map((x) => x.amount_cents));
  const expense = sumCents(confirmed.filter((x) => x.type === 'expense').map((x) => x.amount_cents));
  const money = (c: number, cur = currency) => formatCents(c, cur, locale);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button icon={<Minus className="size-4" aria-hidden />} onClick={() => setForm({ tx: null, type: 'expense' })}>{t('finance.tx.newExpense')}</Button>
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setForm({ tx: null, type: 'income' })}>{t('finance.tx.newIncome')}</Button>
      </div>
      <Card className="mb-4 p-3">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('finance.tx.search')} aria-label={t('actions.search')} className="h-10 w-full rounded-pill bg-white/60 ps-9 pe-4 text-sm outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Input label={t('finance.month')} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Select label={t('finance.type')} value={type} onChange={(e) => setType(e.target.value)} options={[{ value: '', label: t('finance.tx.allTypes') }, { value: 'expense', label: t('finance.expense') }, { value: 'income', label: t('finance.income') }]} />
          <Select label={t('fields.category')} value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: '', label: t('actions.all') }, { value: '-', label: t('finance.noCategory') }, ...refs.categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))]} />
          <Select label={t('finance.account')} value={acc} onChange={(e) => setAcc(e.target.value)} options={[{ value: '', label: t('finance.tx.allAccounts') }, ...refs.accounts.map((a) => ({ value: a.id, label: a.name }))]} />
          <Select label={t('finance.statusLabel')} value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: '', label: t('finance.tx.allStatus') }, { value: 'confirmed', label: t('finance.confirmed') }, { value: 'planned', label: t('finance.planned') }]} />
        </div>
      </Card>

      <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
        <Total label={t('finance.income')} value={money(income)} />
        <Total label={t('finance.expense')} value={money(expense)} />
        <Total label={t('finance.reports.net')} value={money(income - expense)} />
      </div>

      {txs.loading ? (
        <Skeleton className="h-48" />
      ) : list.length === 0 ? (
        <Card className="p-4"><EmptyState illustration={<Coins />} title={t('finance.tx.empty')} hint={t('finance.tx.emptyHint')} /></Card>
      ) : (
        <Card className="divide-y divide-line/60 p-0">
          {list.map((x) => {
            const c = refs.catById.get(x.category);
            return (
              <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: c?.color || '#EAD3BF' }} aria-hidden>{c?.icon || (x.type === 'income' ? '＋' : '−')}</span>
                <button type="button" onClick={() => setForm({ tx: x })} className="min-w-0 flex-1 text-start">
                  <p className="truncate font-medium">{x.description || c?.name || t(`finance.${x.type}`)}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                    {fmtDay(x.date, locale, 'medium')}
                    {c && ` · ${c.name}`}
                    {x.status === 'planned' && <span className="rounded-pill bg-apricot px-2 text-ink">{t('finance.planned')}</span>}
                    {x.recurring && <Repeat className="size-3" aria-label={t('finance.tx.fromRecurring')} />}
                    {x.transfer && <Send className="size-3" aria-label={t('finance.tx.fromTransfer')} />}
                  </p>
                </button>
                <span className={cn('font-semibold tabular-nums', x.type === 'income' ? 'text-[#1c5f94]' : 'text-ink')}>
                  {x.type === 'income' ? '+' : '−'}{money(x.amount_cents, x.currency)}
                </span>
                <button type="button" onClick={() => setDeleting(x)} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.delete')} · ${x.description}`}><Trash2 className="size-4" aria-hidden /></button>
              </div>
            );
          })}
        </Card>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.tx ? t('finance.tx.edit') : form?.type === 'income' ? t('finance.tx.newIncome') : t('finance.tx.newExpense')} closeLabel={t('actions.close')}>
        {form && <TransactionForm key={form.tx?.id ?? form.type} locale={locale} currency={currency} today={today} tx={form.tx} defaults={{ type: form.type ?? 'expense' }} onDone={() => setForm(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleting} title={t('confirmDelete.title')} message={deleting ? t('confirmDelete.message', { name: deleting.description || money(deleting.amount_cents) }) : ''} confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')} closeLabel={t('actions.close')} onClose={() => setDeleting(null)} onConfirm={async () => { if (deleting) await run(() => deleteRecord('transactions', deleting.id), 'feedback.deleted'); setDeleting(null); }} />
    </>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface/80 px-3 py-2 shadow-soft">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

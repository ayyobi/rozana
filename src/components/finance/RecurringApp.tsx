import { useMemo, useState, type SubmitEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { Coins } from '@/components/ui/illustrations';
import { ConfirmDialog, Input, Segmented, Select, Toggle } from '@/components/ui/forms';
import { MoneyInput } from '@/components/forms/TransactionForm';
import { confirmDue } from './common';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useFinanceRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, updateRecord } from '@/lib/pocketbase/client';
import { centsToInput, parseAmountToCents, upcomingDues } from '@/lib/finance/compute';
import { recurringDueDates } from '@/lib/planning/calendar';
import { formatCents } from '@/lib/finance/money';
import { addDays } from '@/lib/utils/day';
import { fmtDay } from '@/lib/utils/format';
import type { RecurringTx, TxType } from '@/types/models';

export default function RecurringApp({ locale, today, currency }: { locale: Locale; today: string; currency: string }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = useFinanceRefs();
  const recurring = useList('recurring_transactions', { sort: 'label' });
  const txs = useList('transactions', { filter: 'recurring != ""' });
  const [form, setForm] = useState<RecurringTx | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RecurringTx | null>(null);
  const money = (c: number, cur = currency) => formatCents(c, cur, locale);

  const dues = useMemo(() => upcomingDues(recurring.items.filter((r) => r.active), txs.items, addDays(today, -60), addDays(today, 31)), [recurring.items, txs.items, today]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-ink-2">{t('finance.recurring.notPaidHint')}</p>
        <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setForm('new')}>{t('finance.recurring.new')}</Button>
      </div>
      {recurring.loading ? (
        <Skeleton className="h-48" />
      ) : recurring.items.length === 0 ? (
        <Card className="p-4"><EmptyState illustration={<Coins />} title={t('finance.recurring.empty')} hint={t('finance.recurring.emptyHint')} action={<Button onClick={() => setForm('new')}>{t('finance.recurring.new')}</Button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="divide-y divide-line/60 p-0">
            {recurring.items.map((r) => {
              const next = recurringDueDates(r, today, addDays(today, 400))[0];
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">{r.label}{!r.active && <Badge>{t('actions.none')}</Badge>}</p>
                    <p className="text-xs text-ink-2">
                      {t(`finance.recurring.every.${r.frequency}`, { n: r.interval || 1 })} · {refs.catById.get(r.category)?.name ?? t('finance.noCategory')}
                      {next && ` · ${t('finance.recurring.next', { date: fmtDay(next, locale, 'short') })}`}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{r.type === 'income' ? '+' : '−'}{money(r.amount_cents, r.currency)}</span>
                  <button type="button" onClick={() => setForm(r)} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.edit')} · ${r.label}`}><Pencil className="size-4" aria-hidden /></button>
                  <button type="button" onClick={() => setDeleting(r)} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.delete')} · ${r.label}`}><Trash2 className="size-4" aria-hidden /></button>
                </div>
              );
            })}
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 font-display text-lg font-semibold">{t('finance.recurring.dues')}</h2>
            {dues.length === 0 ? <p className="text-sm text-ink-2">{t('finance.overview.upcomingEmpty')}</p> : (
              <ul className="flex flex-col gap-2 text-sm">
                {dues.map((u) => (
                  <li key={u.key} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${u.date < today ? 'bg-apricot-soft' : 'bg-white/60'}`}>
                    <span className="flex-1">{u.label}<span className="block text-xs text-ink-2">{fmtDay(u.date, locale, 'weekday')}</span></span>
                    <span className="font-semibold tabular-nums">{money(u.amountCents)}</span>
                    {u.date <= today && <Button size="sm" variant="secondary" onClick={() => void run(() => confirmDue(u, recurring.items, refs.accounts[0]?.id ?? '', currency), 'finance.overview.confirmed')}>{t('finance.overview.confirmPayment')}</Button>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form && form !== 'new' ? t('finance.recurring.edit') : t('finance.recurring.new')} closeLabel={t('actions.close')}>
        {form && <RecurringForm key={form === 'new' ? 'new' : form.id} locale={locale} rec={form === 'new' ? null : form} currency={currency} today={today} onDone={() => setForm(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleting} title={t('confirmDelete.title')} message={deleting ? t('confirmDelete.message', { name: deleting.label }) : ''} confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')} closeLabel={t('actions.close')} onClose={() => setDeleting(null)} onConfirm={async () => { if (deleting) await run(() => deleteRecord('recurring_transactions', deleting.id), 'feedback.deleted'); setDeleting(null); }} />
    </>
  );
}

function RecurringForm({ locale, rec, currency, today, onDone }: { locale: Locale; rec: RecurringTx | null; currency: string; today: string; onDone: () => void }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = useFinanceRefs();
  const [label, setLabel] = useState(rec?.label ?? '');
  const [type, setType] = useState<TxType>(rec?.type ?? 'expense');
  const [amount, setAmount] = useState(rec ? centsToInput(rec.amount_cents) : '');
  const [frequency, setFrequency] = useState<RecurringTx['frequency']>(rec?.frequency ?? 'monthly');
  const [interval, setInterval] = useState(String(rec?.interval || 1));
  const [start, setStart] = useState(rec?.start_date ?? today);
  const [end, setEnd] = useState(rec?.end_date ?? '');
  const [category, setCategory] = useState(rec?.category ?? '');
  const [account, setAccount] = useState(rec?.account ?? '');
  const [reminder, setReminder] = useState(String(rec?.reminder_days ?? 2));
  const [active, setActive] = useState(rec?.active ?? true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const cents = parseAmountToCents(amount);
    if (!label.trim() || !cents) return setErr(t('finance.invalidAmount'));
    setBusy(true);
    const acc = account || refs.accounts[0]?.id || '';
    const data = {
      label: label.trim(),
      type,
      amount_cents: cents,
      currency: refs.accountById.get(acc)?.currency || currency,
      frequency,
      interval: Math.max(1, Number(interval) || 1),
      start_date: start,
      end_date: end,
      category,
      account: acc,
      reminder_days: Math.max(0, Math.min(60, Number(reminder) || 0)),
      active,
    };
    const ok = await run(() => (rec ? updateRecord('recurring_transactions', rec.id, data) : createRecord('recurring_transactions', data)), 'feedback.saved');
    setBusy(false);
    if (ok) onDone();
  }

  const cats = refs.categories.filter((c) => c.kind === type);
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Segmented label={t('finance.type')} value={type} onChange={setType} options={[{ value: 'expense', label: t('finance.expense') }, { value: 'income', label: t('finance.income') }]} />
      <Input label={t('finance.recurring.label')} value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} required autoFocus />
      <MoneyInput label={t('finance.amount')} value={amount} onChange={setAmount} currency={currency} required error={err || undefined} />
      <div className="grid grid-cols-2 gap-3">
        <Select label={t('finance.recurring.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringTx['frequency'])} options={(['weekly', 'monthly', 'yearly', 'days'] as const).map((f) => ({ value: f, label: t(`finance.recurring.${f}`) }))} />
        <Input label={t('finance.recurring.interval')} type="number" min={1} max={365} value={interval} onChange={(e) => setInterval(e.target.value)} hint={t(`finance.recurring.every.${frequency}`, { n: Number(interval) || 1 })} />
        <Input label={t('finance.recurring.start')} type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        <Input label={t('finance.recurring.end')} optional={t('fields.optional')} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        <Select label={t('fields.category')} value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: t('finance.noCategory') }, ...cats.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))]} />
        <Select label={t('finance.account')} value={account || refs.accounts[0]?.id || ''} onChange={(e) => setAccount(e.target.value)} options={refs.accounts.map((a) => ({ value: a.id, label: a.name }))} />
        <Input label={t('finance.recurring.reminderDays')} type="number" min={0} max={60} value={reminder} onChange={(e) => setReminder(e.target.value)} />
      </div>
      <Toggle label={t('finance.recurring.active')} checked={active} onChange={setActive} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('actions.cancel')}</Button>
        <Button type="submit" loading={busy}>{rec ? t('actions.save') : t('actions.create')}</Button>
      </div>
    </form>
  );
}

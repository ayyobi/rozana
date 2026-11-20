import { useMemo, useState, type SubmitEvent } from 'react';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { Coins } from '@/components/ui/illustrations';
import { ConfirmDialog, Input, Segmented, Select, TextArea } from '@/components/ui/forms';
import { MoneyInput } from '@/components/forms/TransactionForm';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useFinanceRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, updateRecord } from '@/lib/pocketbase/client';
import { centsToInput, parseAmountToCents, sumCents } from '@/lib/finance/compute';
import { formatCents } from '@/lib/finance/money';
import { fmtDay, fmtMonth } from '@/lib/utils/format';
import type { MoneyTransfer } from '@/types/models';

const TONE = { planned: 'apricot', sent: 'peach', received: 'sage', cancelled: 'neutral' } as const;

export default function TransfersApp({ locale, today, currency }: { locale: Locale; today: string; currency: string }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = useFinanceRefs();
  const transfers = useList('money_transfers', { sort: '-date' });
  const [group, setGroup] = useState<'month' | 'year'>('month');
  const [form, setForm] = useState<MoneyTransfer | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MoneyTransfer | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, MoneyTransfer[]>();
    for (const x of transfers.items) {
      const k = group === 'month' ? x.date.slice(0, 7) : x.date.slice(0, 4);
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return [...m.entries()];
  }, [transfers.items, group]);

  /** Crée UNE fois la dépense liée (pas de double comptage). */
  async function linkExpense(x: MoneyTransfer) {
    if (x.transaction) return;
    await run(async () => {
      const tx = await createRecord('transactions', {
        type: 'expense',
        amount_cents: x.amount_cents + (x.fee_cents || 0),
        currency: x.currency,
        date: x.date,
        description: `→ ${x.recipient}`,
        status: 'confirmed',
        account: refs.accounts[0]?.id ?? '',
        transfer: x.id,
        category: refs.categories.find((c) => c.kind === 'expense' && /famil|خانواده/i.test(c.name))?.id ?? '',
      });
      await updateRecord('money_transfers', x.id, { transaction: tx.id });
    }, 'finance.transfers.linked');
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl text-sm text-ink-2">
          <p>{t('finance.transfers.onlyTracking')}</p>
          <p>{t('finance.transfers.noDouble')}</p>
        </div>
        <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setForm('new')}>{t('finance.transfers.new')}</Button>
      </div>
      {transfers.loading ? <Skeleton className="h-48" /> : transfers.items.length === 0 ? (
        <Card className="p-4"><EmptyState illustration={<Coins />} title={t('finance.transfers.empty')} hint={t('finance.transfers.emptyHint')} action={<Button onClick={() => setForm('new')}>{t('finance.transfers.new')}</Button>} /></Card>
      ) : (
        <>
          <div className="mb-4"><Segmented label={t('finance.transfers.title')} value={group} onChange={setGroup} options={[{ value: 'month', label: t('finance.transfers.byMonth') }, { value: 'year', label: t('finance.transfers.byYear') }]} /></div>
          <div className="flex flex-col gap-5">
            {groups.map(([k, list]) => {
              const active = list.filter((x) => x.status !== 'cancelled');
              const byCur = new Map<string, { sent: number; fees: number }>();
              for (const x of active) {
                const c = byCur.get(x.currency) ?? { sent: 0, fees: 0 };
                byCur.set(x.currency, { sent: sumCents([c.sent, x.amount_cents]), fees: sumCents([c.fees, x.fee_cents || 0]) });
              }
              return (
                <section key={k} aria-label={k}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-lg font-semibold">{group === 'month' ? fmtMonth(`${k}-01`, locale) : k}</h2>
                    <p className="text-sm text-ink-2">
                      {[...byCur.entries()].map(([cur, v]) => `${t('finance.transfers.total')} ${formatCents(v.sent, cur, locale)} · ${t('finance.transfers.totalFees')} ${formatCents(v.fees, cur, locale)}`).join(' — ')}
                    </p>
                  </div>
                  <Card className="divide-y divide-line/60 p-0">
                    {list.map((x) => (
                      <div key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 font-medium">{x.recipient}<Badge tone={TONE[x.status]}>{t(`finance.transfers.status.${x.status}`)}</Badge></p>
                          <p className="text-xs text-ink-2">
                            {fmtDay(x.date, locale, 'medium')}
                            {x.fee_cents > 0 && ` · ${t('finance.transfers.fee')} ${formatCents(x.fee_cents, x.currency, locale)}`}
                            {x.rate && ` · ${t('finance.transfers.rate')} ${x.rate}`}
                            {x.received_cents > 0 && x.received_currency && ` · ${t('finance.transfers.received')} ${formatCents(x.received_cents, x.received_currency, locale)}`}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums">{formatCents(x.amount_cents, x.currency, locale)}</span>
                        {x.transaction ? (
                          <span className="inline-flex items-center gap-1 text-xs text-sage-strong"><Link2 className="size-3.5" aria-hidden />{t('finance.transfers.linked')}</span>
                        ) : (x.status === 'sent' || x.status === 'received') ? (
                          <Button size="sm" variant="secondary" onClick={() => void linkExpense(x)}>{t('finance.transfers.linkExpense')}</Button>
                        ) : null}
                        <button type="button" onClick={() => setForm(x)} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.edit')} · ${x.recipient}`}><Pencil className="size-4" aria-hidden /></button>
                        <button type="button" onClick={() => setDeleting(x)} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.delete')} · ${x.recipient}`}><Trash2 className="size-4" aria-hidden /></button>
                      </div>
                    ))}
                  </Card>
                </section>
              );
            })}
          </div>
        </>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form && form !== 'new' ? t('finance.transfers.edit') : t('finance.transfers.new')} closeLabel={t('actions.close')}>
        {form && <TransferForm key={form === 'new' ? 'new' : form.id} locale={locale} tr={form === 'new' ? null : form} currency={currency} today={today} onDone={() => setForm(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleting} title={t('confirmDelete.title')} message={deleting ? t('confirmDelete.message', { name: deleting.recipient }) : ''} confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')} closeLabel={t('actions.close')} onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await run(async () => {
            if (deleting.transaction) await deleteRecord('transactions', deleting.transaction).catch(() => undefined);
            await deleteRecord('money_transfers', deleting.id);
          }, 'feedback.deleted');
          setDeleting(null);
        }} />
    </>
  );
}

function TransferForm({ locale, tr, currency, today, onDone }: { locale: Locale; tr: MoneyTransfer | null; currency: string; today: string; onDone: () => void }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [recipient, setRecipient] = useState(tr?.recipient ?? '');
  const [amount, setAmount] = useState(tr ? centsToInput(tr.amount_cents) : '');
  const [cur, setCur] = useState(tr?.currency ?? currency);
  const [fee, setFee] = useState(tr?.fee_cents ? centsToInput(tr.fee_cents) : '');
  const [rate, setRate] = useState(tr?.rate ?? '');
  const [received, setReceived] = useState(tr?.received_cents ? centsToInput(tr.received_cents) : '');
  const [recCur, setRecCur] = useState(tr?.received_currency ?? '');
  const [date, setDate] = useState(tr?.date ?? today);
  const [status, setStatus] = useState<MoneyTransfer['status']>(tr?.status ?? 'planned');
  const [notes, setNotes] = useState(tr?.notes ?? '');
  const [err, setErr] = useState('');
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const cents = parseAmountToCents(amount);
    const feeC = fee.trim() ? parseAmountToCents(fee) : 0;
    const recC = received.trim() ? parseAmountToCents(received) : 0;
    const rateOk = !rate.trim() || /^\d+(\.\d+)?$/.test(rate.replace(',', '.').trim());
    if (!recipient.trim() || !cents || feeC === null || recC === null || !rateOk || !/^[A-Z]{3}$/.test(cur) || (recCur && !/^[A-Z]{3}$/.test(recCur))) return setErr(t('errors.validation'));
    const data = { recipient: recipient.trim(), amount_cents: cents, currency: cur, fee_cents: feeC, rate: rate.replace(',', '.').trim(), received_cents: recC, received_currency: recCur, date, status, notes };
    const ok = await run(() => (tr ? updateRecord('money_transfers', tr.id, data) : createRecord('money_transfers', data)), 'feedback.saved');
    if (ok) onDone();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input label={t('finance.transfers.recipient')} value={recipient} maxLength={120} onChange={(e) => setRecipient(e.target.value)} required autoFocus error={err || undefined} />
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <MoneyInput label={t('finance.transfers.sent')} value={amount} onChange={setAmount} currency={cur} required />
        <Input label={t('finance.currency')} value={cur} maxLength={3} dir="ltr" onChange={(e) => setCur(e.target.value.toUpperCase())} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label={t('finance.transfers.fee')} value={fee} onChange={setFee} currency={cur} />
        <Input label={t('finance.transfers.rate')} optional={t('fields.optional')} value={rate} dir="ltr" inputMode="decimal" onChange={(e) => setRate(e.target.value)} />
        <MoneyInput label={t('finance.transfers.received')} value={received} onChange={setReceived} currency={recCur || '—'} />
        <Input label={t('finance.transfers.receivedCurrency')} value={recCur} maxLength={3} dir="ltr" onChange={(e) => setRecCur(e.target.value.toUpperCase())} />
        <Input label={t('fields.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Select label={t('fields.status')} value={status} onChange={(e) => setStatus(e.target.value as MoneyTransfer['status'])} options={(['planned', 'sent', 'received', 'cancelled'] as const).map((s) => ({ value: s, label: t(`finance.transfers.status.${s}`) }))} />
      </div>
      <TextArea label={t('fields.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('actions.cancel')}</Button>
        <Button type="submit">{tr ? t('actions.save') : t('actions.create')}</Button>
      </div>
    </form>
  );
}

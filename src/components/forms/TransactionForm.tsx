import { useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Disclosure, Input, Segmented, Select } from '@/components/ui/forms';
import { useTranslations, type Locale } from '@/i18n';
import { useFinanceRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord, updateRecord } from '@/lib/pocketbase/client';
import { centsToInput, parseAmountToCents } from '@/lib/finance/compute';
import type { Transaction, TxType } from '@/types/models';

export function MoneyInput({ label, value, onChange, error, currency, required, optional }: { label: string; value: string; onChange: (v: string) => void; error?: string | undefined; currency: string; required?: boolean; optional?: string }) {
  return (
    <Input
      label={`${label} (${currency})`}
      inputMode="decimal"
      autoComplete="off"
      dir="ltr"
      placeholder="0,00"
      value={value}
      required={required}
      optional={optional}
      onChange={(e) => onChange(e.target.value)}
      error={error}
    />
  );
}

export function TransactionForm({ locale, tx, defaults, currency, today, onDone }: { locale: Locale; tx?: Transaction | null; defaults?: Partial<Transaction>; currency: string; today: string; onDone: () => void }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = useFinanceRefs();
  const init = { ...defaults, ...tx };
  const [type, setType] = useState<TxType>(init.type ?? 'expense');
  const [amount, setAmount] = useState(init.amount_cents ? centsToInput(init.amount_cents) : '');
  const [category, setCategory] = useState(init.category ?? '');
  const [date, setDate] = useState(init.date ?? today);
  const [description, setDescription] = useState(init.description ?? '');
  const [account, setAccount] = useState(init.account ?? '');
  const [method, setMethod] = useState(init.payment_method ?? '');
  const [status, setStatus] = useState<Transaction['status']>(init.status ?? (date > today ? 'planned' : 'confirmed'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cats = refs.categories.filter((c) => c.kind === type);
  const acc = account || refs.accounts[0]?.id || '';
  const txCurrency = refs.accountById.get(acc)?.currency || currency;

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const cents = parseAmountToCents(amount);
    if (!cents || cents <= 0) return setError(t('finance.invalidAmount'));
    if (!date) return setError(t('errors.validation'));
    setBusy(true);
    const data = {
      type,
      amount_cents: cents,
      currency: txCurrency,
      category: cats.some((c) => c.id === category) ? category : '',
      date,
      description: description.trim(),
      account: acc,
      payment_method: method as Transaction['payment_method'],
      status,
    };
    const ok = await run(() => (tx ? updateRecord('transactions', tx.id, data) : createRecord('transactions', data)), tx ? 'feedback.saved' : 'feedback.created');
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Segmented label={t('finance.type')} value={type} onChange={setType} options={[{ value: 'expense', label: t('finance.expense') }, { value: 'income', label: t('finance.income') }]} />
      <MoneyInput label={t('finance.amount')} value={amount} onChange={setAmount} currency={txCurrency} required error={error || undefined} />
      <div className="grid grid-cols-2 gap-3">
        <Select label={t('fields.category')} value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: t('finance.noCategory') }, ...cats.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))]} />
        <Input label={t('fields.date')} type="date" value={date} onChange={(e) => { setDate(e.target.value); if (!tx) setStatus(e.target.value > today ? 'planned' : 'confirmed'); }} required />
      </div>
      <Input label={t('fields.description')} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
      <Disclosure title={t('actions.advanced')} defaultOpen={!!tx}>
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('finance.account')} value={acc} onChange={(e) => setAccount(e.target.value)} options={refs.accounts.map((a) => ({ value: a.id, label: a.name }))} />
          <Select label={t('finance.paymentMethod')} value={method} onChange={(e) => setMethod(e.target.value as Transaction['payment_method'])} options={[{ value: '', label: '—' }, ...(['card', 'cash', 'transfer', 'direct_debit', 'check', 'other'] as const).map((m) => ({ value: m, label: t(`finance.methods.${m}`) }))]} />
          <Select label={t('finance.statusLabel')} value={status} onChange={(e) => setStatus(e.target.value as Transaction['status'])} options={[{ value: 'confirmed', label: t('finance.confirmed') }, { value: 'planned', label: t('finance.planned') }]} />
        </div>
      </Disclosure>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('actions.cancel')}</Button>
        <Button type="submit" loading={busy}>{tx ? t('actions.save') : t('actions.create')}</Button>
      </div>
    </form>
  );
}

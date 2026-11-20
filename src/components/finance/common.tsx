import { useState, type SubmitEvent } from 'react';
import { Archive, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ColorPicker, Input, Select, Toggle } from '@/components/ui/forms';
import { MoneyInput } from '@/components/forms/TransactionForm';
import { useTranslations, type Locale } from '@/i18n';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, updateRecord } from '@/lib/pocketbase/client';
import { centsToInput, parseAmountToCents, recordedBalance, type Upcoming } from '@/lib/finance/compute';
import { formatCents } from '@/lib/finance/money';
import type { FinanceAccount, FinanceCategory, RecurringTx, Transaction } from '@/types/models';

type T = ReturnType<typeof useTranslations>;

/** Confirme une échéance : crée (ou confirme) la transaction réelle, sans doublon. */
export async function confirmDue(u: Upcoming, recurring: RecurringTx[], defaultAccount: string, currency: string): Promise<void> {
  if (u.transactionId) {
    await updateRecord('transactions', u.transactionId, { status: 'confirmed' });
    return;
  }
  const r = recurring.find((x) => x.id === u.recurringId);
  await createRecord('transactions', {
    type: u.type,
    amount_cents: u.amountCents,
    currency: r?.currency || currency,
    category: r?.category ?? '',
    account: r?.account || defaultAccount,
    date: u.date,
    description: u.label,
    status: 'confirmed',
    recurring: u.recurringId ?? '',
    due_key: u.recurringId ? u.date : '',
  });
}

export function AccountsManager({ locale, accounts, txs, today, currency }: { locale: Locale; accounts: FinanceAccount[]; txs: Transaction[]; today: string; currency: string }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [editing, setEditing] = useState<FinanceAccount | 'new' | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-white/60 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.name}{a.archived && ' · 🗄'}</p>
              <p className="text-xs text-ink-2">{t(`finance.accounts.types.${a.type}`)} · {a.currency}</p>
            </div>
            <span className="font-semibold tabular-nums">{formatCents(recordedBalance([a], txs, today, a.id), a.currency, locale)}</span>
            <button type="button" onClick={() => setEditing(a)} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.edit')} · ${a.name}`}><Pencil className="size-4" aria-hidden /></button>
            <button type="button" onClick={() => void run(() => updateRecord('finance_accounts', a.id, { archived: !a.archived }), 'feedback.saved')} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('finance.accounts.archive')} · ${a.name}`}><Archive className="size-4" aria-hidden /></button>
          </li>
        ))}
      </ul>
      {editing ? (
        <AccountForm t={t} account={editing === 'new' ? null : editing} currency={currency} onDone={() => setEditing(null)} />
      ) : (
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>{t('finance.accounts.new')}</Button>
      )}
    </div>
  );
}

function AccountForm({ t, account, currency, onDone }: { t: T; account: FinanceAccount | null; currency: string; onDone: () => void }) {
  const run = useAction(t);
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<FinanceAccount['type']>(account?.type ?? 'checking');
  const [cur, setCur] = useState(account?.currency ?? currency);
  const [opening, setOpening] = useState(account ? centsToInput(account.opening_balance_cents) : '');
  const [err, setErr] = useState('');
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const neg = opening.trim().startsWith('-');
    const cents = opening.trim() ? parseAmountToCents(opening.replace('-', '')) : 0;
    if (!name.trim() || cents === null || !/^[A-Z]{3}$/.test(cur)) return setErr(t('errors.validation'));
    const data = { name: name.trim(), type, currency: cur, opening_balance_cents: neg ? -cents : cents };
    const ok = await run(() => (account ? updateRecord('finance_accounts', account.id, data) : createRecord('finance_accounts', { ...data, archived: false })), 'feedback.saved');
    if (ok) onDone();
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 rounded-2xl border border-line p-3">
      <Input className="col-span-2" label={t('finance.accounts.name')} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} error={err || undefined} />
      <Select label={t('finance.type')} value={type} onChange={(e) => setType(e.target.value as FinanceAccount['type'])} options={(['checking', 'savings', 'cash', 'other'] as const).map((v) => ({ value: v, label: t(`finance.accounts.types.${v}`) }))} />
      <Input label={t('finance.currency')} value={cur} maxLength={3} dir="ltr" onChange={(e) => setCur(e.target.value.toUpperCase())} />
      <div className="col-span-2"><MoneyInput label={t('finance.accounts.opening')} value={opening} onChange={setOpening} currency={cur} /></div>
      <div className="col-span-2 flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('actions.cancel')}</Button>
        <Button type="submit">{t('actions.save')}</Button>
      </div>
    </form>
  );
}

export function FinanceCategoriesManager({ locale, categories }: { locale: Locale; categories: FinanceCategory[] }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [icon, setIcon] = useState('•');
  const [color, setColor] = useState('#D5CFC6');
  const [essential, setEssential] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm">
            <span className="grid size-7 place-items-center rounded-lg" style={{ background: c.color || '#eee' }} aria-hidden>{c.icon}</span>
            <span className="flex-1">{c.name}</span>
            <span className="text-xs text-ink-2">{t(`finance.${c.kind}`)}</span>
            {c.kind === 'expense' && (
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={c.essential} onChange={(e) => void run(() => updateRecord('finance_categories', c.id, { essential: e.target.checked }))} className="accent-[var(--color-coral-strong)]" />
                {t('finance.categories.essential')}
              </label>
            )}
            <button type="button" onClick={() => void run(() => deleteRecord('finance_categories', c.id), 'feedback.deleted')} className="grid size-8 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.delete')} · ${c.name}`}><Trash2 className="size-3.5" aria-hidden /></button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const ok = await run(() => createRecord('finance_categories', { name: name.trim(), kind, icon, color, essential: kind === 'expense' && essential, sort: categories.length }), 'feedback.created');
          if (ok) setName('');
        }}
        className="flex flex-col gap-3 rounded-2xl border border-line p-3"
      >
        <div className="grid grid-cols-[4rem_1fr] gap-2">
          <Input label={t('fields.icon')} value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} />
          <Input label={t('fields.name')} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <Select label={t('finance.type')} value={kind} onChange={(e) => setKind(e.target.value as 'expense' | 'income')} options={[{ value: 'expense', label: t('finance.expense') }, { value: 'income', label: t('finance.income') }]} />
        {kind === 'expense' && <Toggle label={t('finance.categories.essential')} hint={t('finance.categories.essentialHint')} checked={essential} onChange={setEssential} />}
        <ColorPicker label={t('fields.color')} value={color} onChange={setColor} />
        <Button type="submit" variant="secondary" icon={<Plus className="size-4" aria-hidden />}>{t('finance.categories.new')}</Button>
      </form>
    </div>
  );
}

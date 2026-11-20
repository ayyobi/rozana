import { useEffect, useState, type SubmitEvent } from 'react';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Card, EmptyState, Progress, Skeleton } from '@/components/ui/primitives';
import { Coins } from '@/components/ui/illustrations';
import { ColorPicker, ConfirmDialog, Input, TextArea } from '@/components/ui/forms';
import { MoneyInput } from '@/components/forms/TransactionForm';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, updateRecord } from '@/lib/pocketbase/client';
import { centsToInput, goalProjection, parseAmountToCents } from '@/lib/finance/compute';
import { formatCents } from '@/lib/finance/money';
import { fmtDay } from '@/lib/utils/format';
import type { SavingsGoal } from '@/types/models';

export default function SavingsApp({ locale, today, currency }: { locale: Locale; today: string; currency: string }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const goals = useList('savings_goals', { sort: 'target_date,name' });
  const contribs = useList('savings_contributions', { sort: '-date' });
  const [form, setForm] = useState<SavingsGoal | 'new' | null>(null);
  const [contrib, setContrib] = useState<{ goal: SavingsGoal; withdraw: boolean } | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  useEffect(() => {
    if (new URLSearchParams(location.search).has('nouveau')) setForm('new');
  }, []);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-ink-2">{t('finance.savings.notAuto')}</p>
        <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setForm('new')}>{t('finance.savings.new')}</Button>
      </div>
      {goals.loading ? <Skeleton className="h-48" /> : goals.items.length === 0 ? (
        <Card className="p-4"><EmptyState illustration={<Coins />} title={t('finance.savings.empty')} hint={t('finance.savings.emptyHint')} action={<Button onClick={() => setForm('new')}>{t('finance.savings.new')}</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.items.map((g) => {
            const list = contribs.items.filter((c) => c.goal === g.id);
            const p = goalProjection(g.target_cents, g.target_date, list, today);
            const money = (c: number) => formatCents(c, g.currency, locale);
            return (
              <Card key={g.id} className="p-5">
                <div className="mb-3 flex items-start gap-3">
                  <span className="mt-1 size-3 rounded-full" style={{ background: g.color || '#D9A47F' }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg font-semibold">{g.name}</h2>
                    {g.target_date && <p className="text-xs text-ink-2">{t('finance.savings.targetDate')} : {fmtDay(g.target_date, locale, 'medium')}</p>}
                  </div>
                  <button type="button" onClick={() => setForm(g)} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.edit')} · ${g.name}`}><Pencil className="size-4" aria-hidden /></button>
                  <button type="button" onClick={() => setDeleting(g)} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.delete')} · ${g.name}`}><Trash2 className="size-4" aria-hidden /></button>
                </div>
                <p className="mb-1 flex justify-between text-sm"><span className="font-semibold tabular-nums">{money(p.savedCents)}</span><span className="text-ink-2 tabular-nums">/ {money(g.target_cents)}</span></p>
                <Progress value={p.pct} label={g.name} color={g.color || undefined} />
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-white/55 px-3 py-2"><dt className="text-xs text-ink-2">{t('finance.savings.remaining')}</dt><dd className="font-semibold tabular-nums">{money(p.remainingCents)}</dd></div>
                  <div className="rounded-xl bg-white/55 px-3 py-2"><dt className="text-xs text-ink-2">{t('finance.savings.monthly')}</dt><dd className="font-semibold tabular-nums">{p.monthlyNeededCents !== null ? money(p.monthlyNeededCents) : '—'}</dd></div>
                  <div className="col-span-2 rounded-xl bg-white/55 px-3 py-2"><dt className="text-xs text-ink-2">{t('finance.savings.estimated')}</dt><dd className="font-semibold">{p.remainingCents === 0 ? t('finance.savings.reached') : p.estimatedDate ? fmtDay(p.estimatedDate, locale, 'medium') : <span className="font-normal text-ink-2">{t('finance.savings.noEstimate')}</span>}</dd></div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setContrib({ goal: g, withdraw: false })}>{t('finance.savings.addContribution')}</Button>
                  <Button size="sm" variant="secondary" icon={<Minus className="size-4" aria-hidden />} onClick={() => setContrib({ goal: g, withdraw: true })}>{t('finance.savings.withdraw')}</Button>
                </div>
                {list.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-ink-2">{t('finance.savings.contributions')} ({list.length})</summary>
                    <ul className="mt-2 flex flex-col gap-1">
                      {list.map((c) => (
                        <li key={c.id} className="flex items-center gap-2">
                          <span className="flex-1 text-ink-2">{fmtDay(c.date, locale, 'short')}{c.note && ` · ${c.note}`}</span>
                          <span className="tabular-nums">{c.amount_cents > 0 ? '+' : '−'}{money(Math.abs(c.amount_cents))}</span>
                          <button type="button" onClick={() => void run(() => deleteRecord('savings_contributions', c.id), 'feedback.deleted')} className="grid size-7 place-items-center rounded-full hover:bg-ink/5" aria-label={t('actions.delete')}><Trash2 className="size-3.5" aria-hidden /></button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form && form !== 'new' ? t('finance.savings.edit') : t('finance.savings.new')} closeLabel={t('actions.close')}>
        {form && <GoalForm key={form === 'new' ? 'new' : form.id} locale={locale} goal={form === 'new' ? null : form} currency={currency} today={today} onDone={() => setForm(null)} />}
      </Modal>
      <Modal open={!!contrib} onClose={() => setContrib(null)} title={contrib?.withdraw ? t('finance.savings.withdraw') : t('finance.savings.addContribution')} closeLabel={t('actions.close')}>
        {contrib && <ContributionForm locale={locale} goal={contrib.goal} withdraw={contrib.withdraw} today={today} onDone={() => setContrib(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleting} title={t('confirmDelete.title')} message={deleting ? t('confirmDelete.message', { name: deleting.name }) : ''} confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')} closeLabel={t('actions.close')} onClose={() => setDeleting(null)} onConfirm={async () => { if (deleting) await run(() => deleteRecord('savings_goals', deleting.id), 'feedback.deleted'); setDeleting(null); }} />
    </>
  );
}

function GoalForm({ locale, goal, currency, today, onDone }: { locale: Locale; goal: SavingsGoal | null; currency: string; today: string; onDone: () => void }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? centsToInput(goal.target_cents) : '');
  const [date, setDate] = useState(goal?.target_date ?? '');
  const [initial, setInitial] = useState('');
  const [notes, setNotes] = useState(goal?.notes ?? '');
  const [color, setColor] = useState(goal?.color || '#D9A47F');
  const [err, setErr] = useState('');
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const cents = parseAmountToCents(target);
    const init = initial.trim() ? parseAmountToCents(initial) : 0;
    if (!name.trim() || !cents || init === null) return setErr(t('finance.invalidAmount'));
    const data = { name: name.trim(), target_cents: cents, target_date: date, notes, color, currency: goal?.currency ?? currency };
    const ok = await run(async () => {
      const g = goal ? await updateRecord('savings_goals', goal.id, data) : await createRecord('savings_goals', { ...data, archived: false });
      if (!goal && init > 0) await createRecord('savings_contributions', { goal: g.id, amount_cents: init, date: today, note: '' });
      return g;
    }, 'feedback.saved');
    if (ok) onDone();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input label={t('fields.name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
      <MoneyInput label={t('finance.savings.target')} value={target} onChange={setTarget} currency={goal?.currency ?? currency} required error={err || undefined} />
      <Input label={t('finance.savings.targetDate')} optional={t('fields.optional')} type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
      {!goal && <MoneyInput label={t('finance.savings.initial')} value={initial} onChange={setInitial} currency={currency} />}
      <ColorPicker label={t('fields.color')} value={color} onChange={setColor} />
      <TextArea label={t('fields.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('actions.cancel')}</Button>
        <Button type="submit">{goal ? t('actions.save') : t('actions.create')}</Button>
      </div>
    </form>
  );
}

function ContributionForm({ locale, goal, withdraw, today, onDone }: { locale: Locale; goal: SavingsGoal; withdraw: boolean; today: string; onDone: () => void }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const cents = parseAmountToCents(amount);
    if (!cents) return setErr(t('finance.invalidAmount'));
    const ok = await run(() => createRecord('savings_contributions', { goal: goal.id, amount_cents: withdraw ? -cents : cents, date, note: note.trim() }), 'feedback.saved');
    if (ok) onDone();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <MoneyInput label={t('finance.amount')} value={amount} onChange={setAmount} currency={goal.currency} required error={err || undefined} />
      <Input label={t('fields.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <Input label={t('fields.notes')} optional={t('fields.optional')} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('actions.cancel')}</Button>
        <Button type="submit">{t('actions.save')}</Button>
      </div>
    </form>
  );
}

import { useMemo, useState, type ReactNode, type SubmitEvent } from 'react';
import { Download, Globe2, KeyRound, Languages, Pencil, Plus, Sparkles, Tags, Trash2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/primitives';
import { ColorPicker, ConfirmDialog, Input, PageHeader, Select, Toggle } from '@/components/ui/forms';
import { PushSettings } from './PushSettings';
import { useTranslations, LOCALES, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, listRecords, pb, updateRecord } from '@/lib/pocketbase/client';
import { wipeLocalData } from '@/lib/offline/idb';
import { toast } from '@/stores/toast';
import type { Category, CollectionName, UserSettings } from '@/types/models';

const EXPORTABLE: CollectionName[] = ['user_settings', 'categories', 'tasks', 'subtasks', 'events', 'projects', 'project_sections', 'habits', 'habit_logs', 'finance_accounts', 'finance_categories', 'transactions', 'monthly_budgets', 'recurring_transactions', 'savings_goals', 'savings_contributions', 'money_transfers', 'dashboard_widgets', 'ai_conversations', 'ai_messages'];

export default function SettingsApp({ locale, settings, email }: { locale: Locale; settings: UserSettings; email: string }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [s, setS] = useState(settings);

  async function save(patch: Partial<UserSettings>, reload = false) {
    const next = { ...s, ...patch };
    setS(next);
    const ok = await run(() => updateRecord('user_settings', s.id, patch), 'settings.saved');
    if (ok && reload) {
      if (patch.locale) {
        const f = new FormData();
        f.set('locale', patch.locale);
        await fetch('/api/preferences/locale', { method: 'POST', body: f });
      }
      location.reload();
    }
  }

  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone');
    } catch {
      return ['Europe/Paris', 'Asia/Kabul', 'Asia/Tehran', 'UTC'];
    }
  }, []);

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={<Languages className="size-5" />} title={t('settings.sections.general')}>
          <Select label={t('settings.language')} hint={t('settings.languageHint')} value={s.locale} onChange={(e) => void save({ locale: e.target.value as Locale }, true)} options={LOCALES.map((l) => ({ value: l, label: t(`settings.${l}`) }))} />
          <Select label={t('settings.timezone')} hint={t('settings.timezoneHint')} value={s.timezone} onChange={(e) => void save({ timezone: e.target.value }, true)} options={zones.map((z) => ({ value: z, label: z }))} />
          <CurrencyField t={t} value={s.currency} onSave={(c) => void save({ currency: c }, true)} />
          <p className="flex items-start gap-2 text-xs text-ink-2"><Globe2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t('settings.calendarNote')}</p>
        </Section>

        <Section icon={<Bell className="size-5" />} title={t('settings.sections.notifications')}>
          <PushSettings locale={locale} />
          <div className="border-t border-line pt-3">
            <Toggle label={t('settings.notifyTasks')} checked={s.notify_tasks} onChange={(v) => void save({ notify_tasks: v })} />
            <Toggle label={t('settings.notifyEvents')} checked={s.notify_events} onChange={(v) => void save({ notify_events: v })} />
            <Toggle label={t('settings.notifyHabits')} checked={s.notify_habits} onChange={(v) => void save({ notify_habits: v })} />
            <Toggle label={t('settings.notifyFinance')} checked={s.notify_finance} onChange={(v) => void save({ notify_finance: v })} />
            <Toggle label={t('settings.dailySummary')} checked={s.daily_summary} onChange={(v) => void save({ daily_summary: v })} />
            {s.daily_summary && <Input className="mt-1 mb-2" label={t('settings.dailyTime')} type="time" value={s.daily_summary_time || '08:00'} onChange={(e) => void save({ daily_summary_time: e.target.value })} />}
            <Toggle label={t('settings.weeklySummary')} checked={s.weekly_summary} onChange={(v) => void save({ weekly_summary: v })} />
            <Input className="mt-2" label={t('settings.budgetAlert')} type="number" min={1} max={100} value={s.budget_alert_pct || 80} onChange={(e) => setS({ ...s, budget_alert_pct: Number(e.target.value) })} onBlur={() => void save({ budget_alert_pct: Math.min(100, Math.max(1, s.budget_alert_pct || 80)) })} />
          </div>
        </Section>

        <Section icon={<Tags className="size-5" />} title={t('settings.sections.categories')}>
          <CategoriesManager locale={locale} />
        </Section>

        <Section icon={<Sparkles className="size-5" />} title={t('settings.sections.ai')}>
          <Toggle label={t('settings.ai.enabled')} checked={s.ai_enabled} onChange={(v) => void save({ ai_enabled: v })} />
          <Toggle label={t('settings.ai.consent')} checked={!!s.ai_consent_at} onChange={(v) => void save({ ai_consent_at: v ? new Date().toISOString() : '', ...(v ? {} : { ai_finance_consent: false }) })} />
          <Toggle label={t('settings.ai.finance')} disabled={!s.ai_consent_at} checked={s.ai_finance_consent} onChange={(v) => void save({ ai_finance_consent: v })} />
          <p className="text-xs text-ink-2">{t('settings.ai.hint')}</p>
        </Section>

        <Section icon={<KeyRound className="size-5" />} title={t('settings.sections.account')}>
          <p className="text-sm text-ink-2" dir="ltr">{email}</p>
          <PasswordForm t={t} />
        </Section>

        <Section icon={<Download className="size-5" />} title={t('settings.sections.data')}>
          <DataTools t={t} />
        </Section>
      </div>
    </>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-5 sm:p-6">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold"><span aria-hidden>{icon}</span>{title}</h2>
      {children}
    </Card>
  );
}

function CurrencyField({ t, value, onSave }: { t: ReturnType<typeof useTranslations>; value: string; onSave: (c: string) => void }) {
  const [v, setV] = useState(value);
  const valid = /^[A-Z]{3}$/.test(v);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valid && v !== value) onSave(v); }} className="flex items-end gap-2">
      <Input className="flex-1" label={t('settings.currency')} hint={t('settings.currencyHint')} value={v} maxLength={3} dir="ltr" onChange={(e) => setV(e.target.value.toUpperCase())} error={v && !valid ? t('errors.validation') : undefined} />
      <Button type="submit" variant="secondary" disabled={!valid || v === value} className="mb-5">{t('actions.save')}</Button>
    </form>
  );
}

function CategoriesManager({ locale }: { locale: Locale }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const cats = useList('categories', { sort: 'sort,name' });
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#D9A47F');
  const [deleting, setDeleting] = useState<Category | null>(null);
  const start = (c: Category | 'new') => {
    setEditing(c);
    setName(c === 'new' ? '' : c.name);
    setColor(c === 'new' ? '#D9A47F' : c.color || '#D9A47F');
  };
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !editing) return;
    const ok = await run(() => (editing === 'new' ? createRecord('categories', { name: name.trim(), color, sort: cats.items.length }) : updateRecord('categories', editing.id, { name: name.trim(), color })), 'feedback.saved');
    if (ok) setEditing(null);
  }
  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {cats.items.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white/60 px-3 py-2">
            <span className="size-4 rounded-full" style={{ background: c.color }} aria-hidden />
            <span className="flex-1">{c.name}</span>
            <button type="button" onClick={() => start(c)} className="grid size-8 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.edit')} · ${c.name}`}><Pencil className="size-4" aria-hidden /></button>
            <button type="button" onClick={() => setDeleting(c)} className="grid size-8 place-items-center rounded-full hover:bg-ink/5" aria-label={`${t('actions.delete')} · ${c.name}`}><Trash2 className="size-4" aria-hidden /></button>
          </li>
        ))}
      </ul>
      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line p-3">
          <Input label={t('fields.name')} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required autoFocus />
          <ColorPicker label={t('fields.color')} value={color} onChange={setColor} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>{t('actions.cancel')}</Button>
            <Button type="submit">{t('actions.save')}</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => start('new')}>{t('categories.new')}</Button>
      )}
      <ConfirmDialog open={!!deleting} title={t('confirmDelete.title')} message={deleting ? `${t('confirmDelete.message', { name: deleting.name })} ${t('confirmDelete.category')}` : ''} confirmLabel={t('actions.delete')} cancelLabel={t('actions.cancel')} closeLabel={t('actions.close')} onClose={() => setDeleting(null)} onConfirm={async () => { if (deleting) await run(() => deleteRecord('categories', deleting.id), 'feedback.deleted'); setDeleting(null); }} />
    </>
  );
}

function PasswordForm({ t }: { t: ReturnType<typeof useTranslations> }) {
  const run = useAction(t);
  const [oldPassword, setOld] = useState('');
  const [password, setPw] = useState('');
  const [passwordConfirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 10) return setErr(t('auth.passwordTooShort'));
    if (password !== passwordConfirm) return setErr(t('auth.passwordMismatch'));
    setErr('');
    const ok = await run(() => pb().collection('users').update(pb().authStore.record!.id, { oldPassword, password, passwordConfirm }), 'settings.password.changed');
    if (ok) setTimeout(() => location.assign('/connexion'), 1200);
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm font-medium">{t('settings.password.title')}</p>
      <Input label={t('settings.password.old')} type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOld(e.target.value)} required dir="ltr" />
      <Input label={t('settings.password.new')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPw(e.target.value)} required dir="ltr" hint={t('auth.passwordHint')} />
      <Input label={t('settings.password.confirm')} type="password" autoComplete="new-password" value={passwordConfirm} onChange={(e) => setConfirm(e.target.value)} required dir="ltr" error={err || undefined} />
      <Button type="submit" variant="secondary" className="self-start">{t('actions.save')}</Button>
    </form>
  );
}

function DataTools({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const word = t('settings.delete.confirmWord');

  async function exportAll() {
    setBusy(true);
    try {
      const out: Record<string, unknown> = { app: 'Rozana', exported_at: new Date().toISOString(), user: pb().authStore.record?.email };
      for (const c of EXPORTABLE) out[c] = await listRecords(c, {});
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rozana-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast(t('settings.export.done'), 'success');
    } catch {
      toast(t('errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await pb().collection('users').delete(pb().authStore.record!.id);
      await wipeLocalData();
      const f = new FormData();
      await fetch('/api/auth/logout', { method: 'POST', body: f });
      location.assign('/connexion');
    } catch {
      toast(t('errors.generic'), 'error');
      setBusy(false);
    }
  }

  return (
    <>
      <div>
        <p className="text-sm font-medium">{t('settings.export.title')}</p>
        <p className="mb-2 text-xs text-ink-2">{t('settings.export.hint')}</p>
        <Button variant="secondary" loading={busy} icon={<Download className="size-4" aria-hidden />} onClick={() => void exportAll()}>{t('settings.export.button')}</Button>
      </div>
      <div className="mt-2 rounded-2xl border border-danger/40 p-4">
        <p className="text-sm font-semibold text-danger">{t('settings.delete.title')}</p>
        <p className="mb-3 text-xs text-ink-2">{t('settings.delete.hint')}</p>
        <Input label={t('settings.delete.typeToConfirm', { word })} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        <Button variant="danger" className="mt-3" disabled={confirmText.trim() !== word} loading={busy} icon={<Trash2 className="size-4" aria-hidden />} onClick={() => void deleteAccount()}>{t('settings.delete.button')}</Button>
      </div>
    </>
  );
}

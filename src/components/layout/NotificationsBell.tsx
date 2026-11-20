import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bell, CalendarClock, Coins, Send, TriangleAlert } from 'lucide-react';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { isOverdue } from '@/lib/planning/tasks';
import { budgetStatus, overdueDues, upcomingDues } from '@/lib/finance/compute';
import { addDays } from '@/lib/utils/day';
import { fmtDay } from '@/lib/utils/format';
import { formatCents } from '@/lib/finance/money';

interface Alert {
  key: string;
  icon: typeof Bell;
  text: string;
  href: string;
  tone: 'danger' | 'warn' | 'info';
}

/** Cloche : alertes réelles calculées à partir des données (retards, budgets, échéances). */
export default function NotificationsBell({ locale, today, currency, alertPct }: { locale: Locale; today: string; currency: string; alertPct: number }) {
  const t = useTranslations(locale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tasks = useList('tasks', { filter: 'status = "todo" || status = "in_progress"' });
  const budgets = useList('monthly_budgets', { filter: `month = "${today.slice(0, 7)}"` });
  const txs = useList('transactions', { filter: `date >= "${today.slice(0, 7)}-01" || recurring != "" || status = "planned"` });
  const recurring = useList('recurring_transactions', { filter: 'active = true' });
  const transfers = useList('money_transfers', { filter: `status = "planned" && date <= "${addDays(today, 3)}"` });
  const cats = useList('finance_categories', {});

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    const late = tasks.items.filter((x) => isOverdue(x, today));
    if (late.length) out.push({ key: 'late', icon: TriangleAlert, text: t('notif.overdue', { n: late.length }), href: '/taches', tone: 'danger' });
    const catName = new Map(cats.items.map((c) => [c.id, c.name]));
    for (const l of budgetStatus(budgets.items, txs.items, today.slice(0, 7), alertPct).lines) {
      if (l.state === 'ok') continue;
      out.push({ key: `b-${l.category}`, icon: AlertTriangle, text: l.state === 'over' ? t('finance.overview.budgetOver', { name: catName.get(l.category) ?? '?', amount: formatCents(-l.remainingCents, currency, locale) }) : t('finance.overview.budgetWarning', { name: catName.get(l.category) ?? '?', pct: Math.round(l.pct) }), href: '/finances/budgets', tone: l.state === 'over' ? 'danger' : 'warn' });
    }
    const toConfirm = overdueDues(recurring.items, txs.items, today);
    if (toConfirm.length) out.push({ key: 'confirm', icon: Coins, text: t('notif.toConfirm', { n: toConfirm.length }), href: '/finances', tone: 'warn' });
    for (const u of upcomingDues(recurring.items, txs.items, today, addDays(today, 3))) {
      const r = recurring.items.find((x) => x.id === u.recurringId);
      if (r && u.date > addDays(today, r.reminder_days)) continue;
      out.push({ key: `u-${u.key}`, icon: CalendarClock, text: t('notif.due', { label: u.label, date: fmtDay(u.date, locale, 'short'), amount: formatCents(u.amountCents, currency, locale) }), href: '/finances/recurrences', tone: 'info' });
    }
    for (const tr of transfers.items) out.push({ key: `tr-${tr.id}`, icon: Send, text: t('notif.transfer', { name: tr.recipient, date: fmtDay(tr.date, locale, 'short') }), href: '/finances/transferts', tone: 'info' });
    return out;
  }, [tasks.items, budgets.items, txs.items, recurring.items, transfers.items, cats.items, today, alertPct, currency, locale, t]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" className="relative grid size-11 place-items-center rounded-full bg-surface/80 shadow-soft hover:bg-surface" aria-label={`${t('header.notifications')}${alerts.length ? ` (${alerts.length})` : ''}`}>
        <Bell className="size-5" strokeWidth={1.9} aria-hidden />
        {alerts.length > 0 && <span className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white" aria-hidden>{alerts.length}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label={t('header.notifications')} className="absolute end-0 top-13 z-40 w-80 max-w-[calc(100vw-2rem)] animate-pop rounded-card border border-line bg-surface p-4 text-ink shadow-lift">
          <p className="mb-2 font-display text-lg font-semibold">{t('header.notifications')}</p>
          {alerts.length === 0 ? (
            <p className="text-sm text-ink-2">{t('header.noNotifications')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {alerts.map((a) => (
                <li key={a.key}>
                  <a href={a.href} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm hover:brightness-95 ${a.tone === 'danger' ? 'bg-danger/10 text-danger' : a.tone === 'warn' ? 'bg-apricot-soft' : 'bg-white/60'}`}>
                    <a.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {a.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, CheckSquare, FolderPlus, PiggyBank, Plus, Sprout, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations, type Locale, type TranslationKey } from '@/i18n';
import { Modal } from '@/components/ui/Modal';
import { TaskForm } from '@/components/forms/TaskForm';
import { EventForm } from '@/components/forms/EventForm';
import { ProjectForm } from '@/components/forms/ProjectForm';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { HabitForm } from '@/components/forms/HabitForm';
import { cn } from '@/lib/utils/cn';

type Kind = 'task' | 'event' | 'project' | 'expense' | 'income' | 'habit' | 'savings';

const ACTIONS: Array<{ kind: Kind; key: TranslationKey; icon: typeof Plus; tone: string }> = [
  { kind: 'task', key: 'quickAdd.task', icon: CheckSquare, tone: 'bg-peach' },
  { kind: 'event', key: 'quickAdd.event', icon: CalendarPlus, tone: 'bg-apricot' },
  { kind: 'project', key: 'quickAdd.project', icon: FolderPlus, tone: 'bg-coral-soft' },
  { kind: 'expense', key: 'quickAdd.expense', icon: TrendingDown, tone: 'bg-coral' },
  { kind: 'income', key: 'quickAdd.income', icon: TrendingUp, tone: 'bg-sage' },
  { kind: 'habit', key: 'quickAdd.habit', icon: Sprout, tone: 'bg-sage' },
  { kind: 'savings', key: 'quickAdd.savings', icon: PiggyBank, tone: 'bg-apricot-soft' },
];

/** Bouton + disponible partout : ouvre directement le bon formulaire. */
export default function QuickAdd({ locale, today, currency }: { locale: Locale; today: string; currency: string }) {
  const t = useTranslations(locale);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Kind | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const choose = (k: Kind) => {
    setOpen(false);
    if (k === 'savings') {
      window.location.assign('/finances/epargne?nouveau=1');
      return;
    }
    setForm(k);
  };
  const close = () => setForm(null);
  const titles: Record<Kind, TranslationKey> = { task: 'tasks.new', event: 'events.new', project: 'projects.new', expense: 'finance.tx.newExpense', income: 'finance.tx.newIncome', habit: 'habits.new', savings: 'finance.savings.new' };

  return (
    <>
      <div className="fixed end-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 lg:end-8 lg:bottom-8">
        {open && (
          <div ref={panelRef} id="quick-add-menu" role="menu" aria-label={t('quickAdd.title')} className="absolute end-0 bottom-[4.5rem] w-64 origin-bottom-right animate-pop rounded-card border border-line/70 bg-surface p-2 shadow-lift rtl:origin-bottom-left">
            <p className="px-3 pt-2 pb-1 font-display text-lg font-semibold">{t('quickAdd.title')}</p>
            <ul>
              {ACTIONS.map((a, idx) => {
                const Icon = a.icon;
                return (
                  <li key={a.kind}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => choose(a.kind)}
                      onKeyDown={(e) => {
                        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                        e.preventDefault();
                        const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
                        items[(idx + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start text-[0.95rem] outline-none hover:bg-bg/50 focus-visible:bg-bg/50"
                    >
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', a.tone)}>
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="font-medium">{t(a.key)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="quick-add-menu"
          aria-label={open ? t('quickAdd.close') : t('quickAdd.open')}
          className="grid size-15 place-items-center rounded-full bg-coral text-ink shadow-lift transition-transform duration-200 ease-soft hover:scale-105 active:scale-95"
        >
          <Plus className={cn('size-7 transition-transform duration-200 ease-soft', open && 'rotate-45')} strokeWidth={2.2} aria-hidden />
        </button>
      </div>

      <Modal open={!!form} onClose={close} title={form ? t(titles[form]) : ''} closeLabel={t('actions.close')}>
        {form === 'task' && <TaskForm locale={locale} defaults={{ start_date: today }} onDone={close} />}
        {form === 'event' && <EventForm locale={locale} defaults={{ start_date: today, end_date: today }} onDone={close} />}
        {form === 'project' && <ProjectForm locale={locale} onDone={(p) => { close(); if (p?.id) window.location.assign(`/projets/${p.id}`); }} />}
        {(form === 'expense' || form === 'income') && <TransactionForm key={form} locale={locale} currency={currency} today={today} defaults={{ type: form }} onDone={close} />}
        {form === 'habit' && <HabitForm locale={locale} onDone={close} />}
      </Modal>
    </>
  );
}

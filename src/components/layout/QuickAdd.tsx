import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, CheckSquare, FolderPlus, PiggyBank, Plus, Sprout, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations, type Locale, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils/cn';

interface Action {
  key: TranslationKey;
  icon: typeof Plus;
  tone: string;
  /** Phase où le formulaire devient disponible. `null` = déjà disponible. */
  phase: number | null;
  href: string;
}

// Les formulaires arrivent avec leurs modules : chaque entrée indique honnêtement sa phase.
const ACTIONS: Action[] = [
  { key: 'quickAdd.task', icon: CheckSquare, tone: 'bg-peach', phase: 3, href: '/taches' },
  { key: 'quickAdd.event', icon: CalendarPlus, tone: 'bg-apricot', phase: 3, href: '/planning' },
  { key: 'quickAdd.project', icon: FolderPlus, tone: 'bg-coral-soft', phase: 3, href: '/projets' },
  { key: 'quickAdd.expense', icon: TrendingDown, tone: 'bg-coral', phase: 4, href: '/finances/transactions' },
  { key: 'quickAdd.income', icon: TrendingUp, tone: 'bg-sage', phase: 4, href: '/finances/transactions' },
  { key: 'quickAdd.habit', icon: Sprout, tone: 'bg-sage', phase: 6, href: '/habitudes' },
  { key: 'quickAdd.savings', icon: PiggyBank, tone: 'bg-apricot-soft', phase: 4, href: '/finances/epargne' },
];

export default function QuickAdd({ locale }: { locale: Locale }) {
  const t = useTranslations(locale);
  const [open, setOpen] = useState(false);
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

  return (
    <div className="fixed end-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 lg:end-8 lg:bottom-8">
      {open && (
        <div
          ref={panelRef}
          id="quick-add-menu"
          role="menu"
          aria-label={t('quickAdd.title')}
          className="absolute end-0 bottom-[4.5rem] w-72 origin-bottom-right animate-pop rounded-card border border-line/70 bg-surface p-2 shadow-lift rtl:origin-bottom-left"
        >
          <p className="px-3 pt-2 pb-1 font-display text-lg font-semibold">{t('quickAdd.title')}</p>
          <ul>
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              const disabled = a.phase !== null;
              return (
                <li key={a.key}>
                  <a
                    role="menuitem"
                    href={a.href}
                    aria-disabled={disabled || undefined}
                    onClick={(e) => {
                      if (disabled) e.preventDefault();
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[0.95rem] outline-none',
                      disabled ? 'cursor-not-allowed' : 'hover:bg-bg/50 focus-visible:bg-bg/50',
                      'focus-visible:outline-2 focus-visible:outline-coral-strong',
                    )}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                      e.preventDefault();
                      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
                      const i = items.indexOf(e.currentTarget);
                      const next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
                      next?.focus();
                    }}
                  >
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', a.tone, disabled && 'opacity-60')}>
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className={cn('font-medium', disabled && 'text-ink-2')}>{t(a.key)}</span>
                      {disabled && <span className="text-xs text-ink-2">{t('quickAdd.availableIn', { phase: a.phase ?? '' })}</span>}
                    </span>
                  </a>
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
  );
}

import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/* ── Carte ─────────────────────────────────────── */
type Tone = 'surface' | 'peach' | 'apricot' | 'coral' | 'sage';
const tones: Record<Tone, string> = {
  surface: 'bg-surface',
  peach: 'bg-peach-soft',
  apricot: 'bg-apricot-soft',
  coral: 'bg-coral-soft',
  sage: 'bg-[#e6ece1]',
};

export function Card({
  tone = 'surface',
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { tone?: Tone }) {
  return (
    <section
      className={cn('rounded-card border border-line/70 shadow-soft', tones[tone], className)}
      {...rest}
    />
  );
}

/* ── Badge ─────────────────────────────────────── */
type BadgeTone = 'neutral' | 'peach' | 'apricot' | 'coral' | 'sage' | 'danger';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-ink/6 text-ink',
  peach: 'bg-peach text-ink',
  apricot: 'bg-apricot text-ink',
  coral: 'bg-coral text-ink',
  sage: 'bg-sage text-ink',
  danger: 'bg-danger/12 text-danger',
};

export function Badge({ tone = 'neutral', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium', badgeTones[tone], className)}
      {...rest}
    />
  );
}

/* ── Case à cocher ronde ───────────────────────── */
export function RoundCheckbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 ease-soft',
        'before:absolute before:-inset-2.5 relative', // zone tactile ≥ 44px
        checked ? 'border-coral-strong bg-coral-strong text-white' : 'border-ink-2/50 bg-white/60 hover:border-coral-strong',
      )}
    >
      <Check className={cn('size-3.5 transition-transform duration-200', checked ? 'scale-100' : 'scale-0')} strokeWidth={3} aria-hidden />
    </button>
  );
}

/* ── Barre de progression ──────────────────────── */
export function Progress({ value, label, color = 'var(--color-coral-strong)' }: { value: number; label: string; color?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-pill bg-ink/8">
      <div className="h-full rounded-pill transition-[width] duration-500 ease-soft" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

/* ── Squelette de chargement ───────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/* ── État vide illustré ────────────────────────── */
export function EmptyState({
  illustration,
  title,
  hint,
  action,
  compact,
}: {
  illustration: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'gap-1.5 py-3' : 'gap-3 py-8')}>
      <div className={cn('text-coral-strong/80', compact ? 'w-16' : 'w-28')} aria-hidden>
        {illustration}
      </div>
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="max-w-[28ch] text-sm text-ink-2">{hint}</p>}
      {action}
    </div>
  );
}

/* ── Champ de formulaire ───────────────────────── */
export function Field({
  label,
  error,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined; hint?: string }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 rounded-field border bg-white/70 px-4 text-base text-ink placeholder:text-ink-2/70',
          'transition-[border-color,box-shadow] duration-200 outline-none',
          'focus:border-coral-strong focus:shadow-[0_0_0_4px_rgb(217_164_127/0.35)]',
          error ? 'border-danger' : 'border-line',
        )}
        {...rest}
      />
      {error ? (
        <p id={`${id}-err`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

import { useId, useState, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type InputHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Modal } from './Modal';
import { Button } from './Button';

export const fieldClass =
  'w-full rounded-field border border-line bg-white/70 px-3.5 text-base text-ink placeholder:text-ink-2/70 outline-none transition-[border-color,box-shadow] duration-200 focus:border-coral-strong focus:shadow-[0_0_0_4px_rgb(217_164_127/0.3)] disabled:opacity-60';

function Label({ htmlFor, children, optional }: { htmlFor: string; children: ReactNode; optional?: string | undefined }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
      {children}
      {optional && <span className="ms-1 font-normal text-ink-2">({optional})</span>}
    </label>
  );
}

type Common = { label: string; error?: string | undefined; hint?: string | undefined; optional?: string | undefined; className?: string | undefined };

export function Input({ label, error, hint, optional, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <input id={id} aria-invalid={error ? true : undefined} className={cn(fieldClass, 'h-11', error && 'border-danger')} {...rest} />
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function TextArea({ label, error, hint, optional, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <textarea id={id} rows={3} className={cn(fieldClass, 'min-h-20 py-2.5', error && 'border-danger')} {...rest} />
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function Select({
  label,
  error,
  hint,
  optional,
  className,
  options,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }> }) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <div className="relative">
        <select id={id} className={cn(fieldClass, 'h-11 appearance-none pe-9', error && 'border-danger')} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <label htmlFor={id} className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-ink-2">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-pill transition-colors duration-200 disabled:opacity-50',
          checked ? 'bg-coral-strong' : 'bg-ink/15',
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200',
            checked ? 'start-6' : 'start-1',
          )}
        />
      </button>
    </div>
  );
}

/** Boutons segmentés (choix exclusif). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-pill bg-surface/70 p-1 shadow-soft">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-pill font-medium transition-colors duration-200',
            size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
            value === o.value ? 'bg-coral text-ink shadow-soft' : 'text-ink hover:bg-ink/5',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Section « options avancées » dépliable. */
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-line/80">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium"
      >
        {title}
        <ChevronDown className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <div className="flex flex-col gap-4 border-t border-line/80 px-4 py-4">{children}</div>}
    </div>
  );
}

export const PALETTE = ['#D9A47F', '#E7D29E', '#EAD3BF', '#C6D3BD', '#B9D3D6', '#C9C2DD', '#E3B9A3', '#D5CFC6', '#9C4F31', '#4B6542'];

export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={cn('size-8 rounded-full border-2 transition-transform', value === c ? 'scale-110 border-ink' : 'border-white/80')}
            style={{ background: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Confirmation (suppression, etc.). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  closeLabel,
  danger = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title} closeLabel={closeLabel}>
      <p className="text-ink-2">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string | undefined; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

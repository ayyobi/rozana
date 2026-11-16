import { useStore } from '@nanostores/react';
import { CheckCircle2, CircleAlert, CloudOff, Info, RefreshCw, X } from 'lucide-react';
import { $toasts, dismissToast, type ToastKind } from '@/stores/toast';
import { cn } from '@/lib/utils/cn';

const icons: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
  offline: CloudOff,
  syncing: RefreshCw,
};

const tones: Record<ToastKind, string> = {
  success: 'bg-[#eef4ea] text-sage-strong',
  error: 'bg-[#fbe4e2] text-danger',
  info: 'bg-surface text-ink',
  offline: 'bg-apricot-soft text-ink',
  syncing: 'bg-surface text-ink',
};

export default function Toaster({ dismissLabel }: { dismissLabel: string }) {
  const toasts = useStore($toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)] md:items-end md:pe-6 md:pt-6"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-fade-up items-center gap-3 rounded-2xl border border-line/70 px-4 py-3 shadow-lift',
              tones[t.kind],
            )}
          >
            <Icon className={cn('size-5 shrink-0', t.kind === 'syncing' && 'animate-spin')} aria-hidden />
            <p className="flex-1 text-sm font-medium text-ink">{t.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-ink/5"
              aria-label={dismissLabel}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

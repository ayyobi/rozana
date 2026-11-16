import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Modale accessible basée sur <dialog> : piège du focus, Échap et fond gérés par le navigateur.
 * Sur mobile elle s'affiche comme une feuille ancrée en bas (bottom sheet).
 */
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
      className={cn(
        'm-0 mt-auto w-full max-w-none rounded-t-[28px] bg-surface p-0 text-ink shadow-lift',
        'md:m-auto md:max-w-lg md:rounded-card',
        'backdrop:bg-[#2f2925]/30 backdrop:backdrop-blur-[2px]',
        'open:animate-fade-up',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 px-6 pt-5">
        <h2 id="modal-title" className="text-xl font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-ink/5"
          aria-label={closeLabel}
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="px-6 pt-3 pb-[max(env(safe-area-inset-bottom),24px)]">{children}</div>
    </dialog>
  );
}

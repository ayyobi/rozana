import { atom } from 'nanostores';

export type ToastKind = 'success' | 'error' | 'info' | 'offline' | 'syncing';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Durée en ms ; 0 = reste affiché jusqu'à fermeture. */
  duration: number;
}

export const $toasts = atom<Toast[]>([]);
let seq = 0;

export function toast(message: string, kind: ToastKind = 'success', duration = 3500): number {
  const id = ++seq;
  $toasts.set([...$toasts.get(), { id, kind, message, duration }]);
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}

export function dismissToast(id: number): void {
  $toasts.set($toasts.get().filter((t) => t.id !== id));
}

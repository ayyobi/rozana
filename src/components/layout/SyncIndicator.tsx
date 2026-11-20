import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import { $sync, patchSync } from '@/stores/sync';
import { flushOutbox, listConflicts, refreshCounts, resolveConflict, type Conflict } from '@/lib/pocketbase/client';
import { useTranslations, type Locale } from '@/i18n';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils/cn';

/** Indique clairement l'état de synchronisation et rejoue la file hors ligne. */
export default function SyncIndicator({ locale }: { locale: Locale }) {
  const t = useTranslations(locale);
  const s = useStore($sync);
  const [open, setOpen] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    const sync = async () => {
      patchSync({ online: navigator.onLine });
      if (!navigator.onLine) return;
      const r = await flushOutbox();
      if (r.sent > 0) toast(t('sync.synced', { n: r.sent }), 'success');
      if (r.conflicts > 0) toast(t('sync.conflictsFound', { n: r.conflicts }), 'error', 8000);
    };
    const goOffline = () => {
      patchSync({ online: false });
      toast(t('sync.offline'), 'offline', 5000);
    };
    void refreshCounts().then(sync);
    window.addEventListener('online', sync);
    window.addEventListener('offline', goOffline);
    // Enregistrement du service worker (PWA, hors ligne, notifications).
    const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if ('serviceWorker' in navigator && secure) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', goOffline);
    };
  }, [t]);

  useEffect(() => {
    if (open) void listConflicts().then(setConflicts);
  }, [open, s.conflicts]);

  const state = !s.online ? 'offline' : s.syncing ? 'syncing' : s.conflicts ? 'conflict' : s.pending ? 'pending' : 'ok';
  if (state === 'ok' && !s.stale) return null;

  const label =
    state === 'offline' ? (s.pending ? t('sync.offlinePending', { n: s.pending }) : t('sync.offlineShort')) : state === 'syncing' ? t('sync.syncing') : state === 'conflict' ? t('sync.conflicts', { n: s.conflicts }) : state === 'pending' ? t('sync.pending', { n: s.pending }) : t('sync.stale');
  const Icon = state === 'offline' ? CloudOff : state === 'syncing' ? RefreshCw : state === 'conflict' ? AlertTriangle : state === 'pending' ? RefreshCw : CheckCircle2;

  return (
    <>
      <button
        type="button"
        onClick={() => (state === 'conflict' ? setOpen(true) : state === 'pending' ? void flushOutbox() : undefined)}
        className={cn(
          'fixed start-1/2 top-[max(env(safe-area-inset-top),8px)] z-[55] inline-flex -translate-x-1/2 items-center gap-2 rounded-pill px-4 py-1.5 text-sm font-medium shadow-lift rtl:translate-x-1/2',
          state === 'conflict' ? 'bg-danger text-white' : 'bg-apricot text-ink',
        )}
        role="status"
        aria-live="polite"
      >
        <Icon className={cn('size-4', state === 'syncing' && 'animate-spin')} aria-hidden />
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('sync.conflictTitle')} closeLabel={t('actions.close')}>
        <p className="mb-4 text-sm text-ink-2">{t('sync.conflictHint')}</p>
        <ul className="flex flex-col gap-3">
          {conflicts.map((c) => (
            <li key={c.seq} className="rounded-2xl bg-white/60 p-3">
              <p className="font-medium">{c.title}</p>
              <p className="mb-2 text-xs text-ink-2">{new Date(c.at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'fr-FR')}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={async () => { await resolveConflict(c, 'mine'); setConflicts(await listConflicts()); }}>{t('sync.keepMine')}</Button>
                <Button size="sm" variant="secondary" onClick={async () => { await resolveConflict(c, 'server'); setConflicts(await listConflicts()); }}>{t('sync.keepServer')}</Button>
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

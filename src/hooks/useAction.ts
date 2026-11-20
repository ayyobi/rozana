import { useCallback } from 'react';
import { QueuedOffline, errorKey } from '@/lib/pocketbase/client';
import { toast } from '@/stores/toast';
import type { TranslationKey } from '@/i18n';

type T = (k: TranslationKey, p?: Record<string, string | number>) => string;

/** Exécute une action et affiche un retour (succès / erreur) cohérent. */
export function useAction(t: T) {
  return useCallback(
    async <R>(fn: () => Promise<R>, success?: TranslationKey): Promise<R | undefined> => {
      try {
        const result = await fn();
        if (success) toast(t(success), 'success');
        return result;
      } catch (err) {
        if (err instanceof QueuedOffline) {
          // Jamais « enregistré » : la modification n'existe que sur l'appareil.
          toast(t('sync.queued'), 'offline', 5000);
          return { queued: true } as R;
        }
        console.error(err);
        const key = errorKey(err);
        toast(t(key), key === 'errors.offline' ? 'offline' : 'error', 6000);
        if (key === 'errors.session') setTimeout(() => window.location.assign('/connexion?expired=1'), 1500);
        return undefined;
      }
    },
    [t],
  );
}

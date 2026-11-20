import { atom } from 'nanostores';

export interface SyncState {
  online: boolean;
  /** Modifications enregistrées sur l'appareil, pas encore sur le serveur. */
  pending: number;
  syncing: boolean;
  conflicts: number;
  /** Les données affichées viennent du cache local (pas du serveur). */
  stale: boolean;
}

export const $sync = atom<SyncState>({ online: true, pending: 0, syncing: false, conflicts: 0, stale: false });

export function patchSync(p: Partial<SyncState>): void {
  $sync.set({ ...$sync.get(), ...p });
}

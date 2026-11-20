/**
 * Mini-couche IndexedDB (sans dépendance) pour le mode hors ligne :
 *  - `cache`  : dernières listes synchronisées (lecture hors ligne) ;
 *  - `outbox` : modifications faites hors ligne, en attente d'envoi ;
 *  - `conflicts` : modifications refusées car l'enregistrement a changé sur le serveur.
 */
const DB = 'rozana';
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      if (!db.objectStoreNames.contains('conflicts')) db.createObjectStore('conflicts', { keyPath: 'seq', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  const db = await open();
  return new Promise<T | undefined>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    t.onerror = () => reject(t.error);
  });
}

export const idb = {
  get: <T>(store: string, key: IDBValidKey) => tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>),
  put: (store: string, value: unknown, key?: IDBValidKey) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
  add: (store: string, value: unknown) => tx<IDBValidKey>(store, 'readwrite', (s) => s.add(value)),
  all: <T>(store: string) => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  delete: (store: string, key: IDBValidKey) => tx(store, 'readwrite', (s) => s.delete(key)),
  clear: (store: string) => tx(store, 'readwrite', (s) => s.clear()),
};

/** Efface toutes les données locales (déconnexion). */
export async function wipeLocalData(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await Promise.all(['cache', 'outbox', 'conflicts'].map((s) => idb.clear(s).catch(() => undefined)));
}

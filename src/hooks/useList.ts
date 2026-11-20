import { useCallback, useEffect, useRef, useState } from 'react';
import { listRecords } from '@/lib/pocketbase/client';
import type { CollectionMap, CollectionName } from '@/types/models';

/**
 * Charge une collection côté navigateur et la recharge automatiquement
 * quand une modification est signalée (`rozana:changed`).
 */
export function useList<K extends CollectionName>(
  name: K,
  options: { filter?: string; sort?: string } = {},
  watch: CollectionName[] = [],
) {
  const [items, setItems] = useState<CollectionMap[K][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const key = JSON.stringify(options);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    try {
      const data = await listRecords(name, options);
      if (id === seq.current) {
        setItems(data);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e);
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, key]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    const names = new Set<string>([name, ...watch]);
    const onChange = (e: Event) => {
      if (names.has((e as CustomEvent<string>).detail)) void reload();
    };
    window.addEventListener('rozana:changed', onChange);
    return () => window.removeEventListener('rozana:changed', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, name, watch.join(',')]);

  return { items, setItems, loading, error, reload };
}

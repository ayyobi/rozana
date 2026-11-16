/**
 * Limiteur mémoire simple (fenêtre glissante) pour une instance unique.
 * Suffisant pour une application mono-utilisatrice ; PocketBase applique aussi
 * ses propres limites (à activer dans ses réglages, voir docs/DEPLOIEMENT.md).
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

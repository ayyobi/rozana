/**
 * Variables d'environnement côté serveur, lues À L'EXÉCUTION (process.env) :
 * les secrets ne sont jamais figés dans le build ni envoyés au navigateur.
 * En développement, Astro/Vite les fournit via import.meta.env.
 */
export function serverEnv(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  return fromProcess || (import.meta.env as Record<string, string | undefined>)[name] || undefined;
}

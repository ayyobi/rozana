import type { APIRoute } from 'astro';
import { sendToUser, vapidConfigured } from '@/lib/notifications/webpush';
import { rateLimit } from '@/lib/auth/rate-limit';
import { serverEnv } from '@/lib/server/env';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

/** Envoie une notification de test à tous les appareils de l'utilisatrice. */
export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, 401);
  if (!vapidConfigured()) return json({ error: 'not_configured' }, 503);
  if (!rateLimit(`push-test:${locals.user.id}`, 5, 60_000)) return json({ error: 'too_many' }, 429);
  const fr = locals.locale !== 'fa';
  const r = await sendToUser(locals.pb, {
    title: 'Rozana',
    body: fr ? 'Les notifications fonctionnent 🌤' : 'اعلان‌ها کار می‌کنند 🌤',
    url: '/parametres',
    tag: 'test',
  });
  return json(r);
};

export const GET: APIRoute = () => json({ configured: vapidConfigured(), publicKey: serverEnv('PUBLIC_VAPID_PUBLIC_KEY') ?? null });

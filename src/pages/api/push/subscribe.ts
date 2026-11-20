import type { APIRoute } from 'astro';
import { z } from 'zod';

const schema = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith('https://'), 'https'),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(4).max(100) }),
});

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

/** Enregistre (ou met à jour) l'abonnement push de cet appareil. */
export const POST: APIRoute = async ({ request, locals }) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !locals.user) return json({ error: 'invalid' }, 400);
  const { endpoint, keys } = parsed.data;
  const pb = locals.pb;
  const existing = await pb.collection('push_subscriptions').getFirstListItem(pb.filter('endpoint = {:e}', { e: endpoint })).catch(() => null);
  const data = { owner: locals.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300), failures: 0 };
  if (existing) await pb.collection('push_subscriptions').update(existing.id, data);
  else await pb.collection('push_subscriptions').create(data);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return json({ error: 'invalid' }, 400);
  const pb = locals.pb;
  const existing = await pb.collection('push_subscriptions').getFirstListItem(pb.filter('endpoint = {:e}', { e: body.endpoint })).catch(() => null);
  if (existing) await pb.collection('push_subscriptions').delete(existing.id);
  return json({ ok: true });
};

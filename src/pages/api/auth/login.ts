import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ClientResponseError } from 'pocketbase';
import { secureCookies, writeAuthCookie } from '@/lib/pocketbase/server';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, locals, cookies, clientAddress, url }) => {
  if (!rateLimit(`login:${clientAddress}`, 8, 10 * 60 * 1000)) {
    return json({ error: 'too_many' }, 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return json({ error: 'invalid' }, 400);

  const { pb } = locals;
  try {
    await pb.collection('users').authWithPassword(parsed.data.email, parsed.data.password);
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 0) return json({ error: 'unavailable' }, 503);
    if (err instanceof ClientResponseError && err.status === 429) return json({ error: 'too_many' }, 429);
    // Message volontairement identique pour e-mail inconnu et mauvais mot de passe.
    return json({ error: 'invalid' }, 401);
  }

  writeAuthCookie(pb, cookies, secureCookies(url));
  return json({ ok: true }, 200);
};

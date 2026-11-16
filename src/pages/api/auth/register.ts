import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ClientResponseError } from 'pocketbase';
import { getSetupStatus, writeAuthCookie } from '@/lib/pocketbase/server';
import { rateLimit } from '@/lib/auth/rate-limit';

/**
 * Inscription du PREMIER et unique compte.
 * La vraie protection est dans PocketBase (pb_hooks/rozana.pb.js) : dès qu'un
 * compte existe, toute création est refusée, même en appelant PocketBase directement.
 */
const schema = z
  .object({
    name: z.string().trim().max(60).optional().default(''),
    email: z.email().max(254),
    password: z.string().min(10).max(256),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, { path: ['passwordConfirm'], message: 'mismatch' });

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, locals, cookies, clientAddress }) => {
  if (!rateLimit(`register:${clientAddress}`, 5, 10 * 60 * 1000)) return json({ error: 'too_many' }, 429);

  const status = await getSetupStatus(locals.pb);
  if (!status.reachable) return json({ error: 'unavailable' }, 503);
  if (!status.signupOpen) return json({ error: 'closed' }, 403);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === 'passwordConfirm') return json({ error: 'mismatch' }, 400);
    if (issue?.path[0] === 'password') return json({ error: 'too_short' }, 400);
    return json({ error: 'invalid' }, 400);
  }

  const { name, email, password, passwordConfirm } = parsed.data;
  const { pb } = locals;
  try {
    await pb.collection('users').create({ name, email, password, passwordConfirm, emailVisibility: false });
    await pb.collection('users').authWithPassword(email, password);
  } catch (err) {
    if (err instanceof ClientResponseError) {
      if (err.status === 0) return json({ error: 'unavailable' }, 503);
      if (err.status === 403) return json({ error: 'closed' }, 403);
      if (err.status === 400 && err.response?.data?.email) return json({ error: 'email_taken' }, 400);
      if (err.status === 400 && err.response?.data?.password) return json({ error: 'too_short' }, 400);
    }
    return json({ error: 'invalid' }, 400);
  }

  writeAuthCookie(pb, cookies, import.meta.env.PROD);
  return json({ ok: true }, 201);
};

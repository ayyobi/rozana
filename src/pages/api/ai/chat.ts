import type { APIRoute } from 'astro';
import { z } from 'zod';
import { AiNotConfigured, AiProviderError, aiConfigured, getProvider, maxRequestsPerDay } from '@/lib/ai/provider';
import { buildContext, parseActions, systemPrompt } from '@/lib/ai/context';
import { rateLimit } from '@/lib/auth/rate-limit';
import { todayIn } from '@/lib/utils/day';
import type { AiMessage } from '@/types/models';

const schema = z.object({ conversation: z.string().max(15).optional(), message: z.string().trim().min(1).max(4000) });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = ({ locals }) =>
  json({ configured: aiConfigured(), enabled: !!locals.settings?.ai_enabled, consent: !!locals.settings?.ai_consent_at, financeConsent: !!locals.settings?.ai_finance_consent, limit: maxRequestsPerDay() });

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const s = locals.settings;
  if (!user || !s) return json({ error: 'unauthorized' }, 401);
  if (!aiConfigured()) return json({ error: 'not_configured' }, 503);
  if (!s.ai_enabled) return json({ error: 'disabled' }, 403);
  if (!s.ai_consent_at) return json({ error: 'no_consent' }, 403);
  if (!rateLimit(`ai:${user.id}`, 6, 60_000)) return json({ error: 'too_many' }, 429);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'invalid' }, 400);
  const pb = locals.pb;
  const today = todayIn(locals.timezone);

  // Contrôle des coûts : quota quotidien de questions.
  const used = await pb.collection('ai_messages').getList(1, 1, { filter: pb.filter('role = "user" && created >= {:d}', { d: `${today} 00:00:00` }) });
  if (used.totalItems >= maxRequestsPerDay()) return json({ error: 'quota' }, 429);

  let conversationId = parsed.data.conversation;
  if (conversationId) {
    const ok = await pb.collection('ai_conversations').getOne(conversationId).catch(() => null);
    if (!ok) return json({ error: 'invalid' }, 400);
  } else {
    const c = await pb.collection('ai_conversations').create({ owner: user.id, title: parsed.data.message.slice(0, 80), archived: false });
    conversationId = c.id;
  }

  const history = await pb.collection('ai_messages').getList<AiMessage>(1, 10, { filter: pb.filter('conversation = {:c}', { c: conversationId }), sort: '-created' });
  await pb.collection('ai_messages').create({ owner: user.id, conversation: conversationId, role: 'user', content: parsed.data.message });

  try {
    // Seules les données autorisées par l'utilisatrice sont transmises.
    const context = await buildContext(pb, today, s.ai_finance_consent);
    const provider = getProvider();
    const messages = [...history.items.reverse().map((m) => ({ role: m.role, content: m.content })), { role: 'user' as const, content: parsed.data.message }];
    const res = await provider.chat(systemPrompt(locals.locale, today, locals.timezone, context), messages, 1500);
    const { text, actions } = parseActions(res.text);
    const saved = await pb.collection('ai_messages').create<AiMessage>({ owner: user.id, conversation: conversationId, role: 'assistant', content: text, actions, tokens_in: res.tokensIn, tokens_out: res.tokensOut });
    return json({ conversation: conversationId, message: saved });
  } catch (err) {
    if (err instanceof AiNotConfigured) return json({ error: 'not_configured' }, 503);
    console.error('[ai]', err);
    const status = err instanceof AiProviderError ? err.status : 0;
    return json({ error: status === 401 || status === 403 ? 'bad_key' : status === 429 ? 'provider_quota' : 'provider_error', conversation: conversationId }, 502);
  }
};

import { serverEnv as env } from '@/lib/server/env';
/**
 * Abstraction du fournisseur IA (côté serveur uniquement).
 * La clé reste dans les variables d'environnement ; elle n'est jamais envoyée au navigateur.
 * Fournisseurs : `anthropic` (par défaut) ou `openai` (toute API compatible OpenAI via AI_BASE_URL).
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export interface AiProvider {
  name: string;
  chat(system: string, messages: ChatMessage[], maxTokens: number): Promise<ChatResult>;
}

export class AiNotConfigured extends Error {
  constructor() {
    super('ai_not_configured');
  }
}

export class AiProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}



export function aiConfigured(): boolean {
  return !!env('AI_API_KEY') && !!env('AI_MODEL');
}

const anthropic = (key: string, model: string): AiProvider => ({
  name: 'anthropic',
  async chat(system, messages, maxTokens) {
    const res = await fetch(env('AI_BASE_URL') || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new AiProviderError(res.status, (await res.text()).slice(0, 300));
    const j = (await res.json()) as { content: Array<{ type: string; text?: string }>; usage?: { input_tokens: number; output_tokens: number } };
    return { text: j.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n'), tokensIn: j.usage?.input_tokens ?? 0, tokensOut: j.usage?.output_tokens ?? 0 };
  },
});

const openai = (key: string, model: string): AiProvider => ({
  name: 'openai',
  async chat(system, messages, maxTokens) {
    const res = await fetch(`${env('AI_BASE_URL') || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...messages] }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new AiProviderError(res.status, (await res.text()).slice(0, 300));
    const j = (await res.json()) as { choices: Array<{ message: { content: string } }>; usage?: { prompt_tokens: number; completion_tokens: number } };
    return { text: j.choices[0]?.message.content ?? '', tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0 };
  },
});

export function getProvider(): AiProvider {
  const key = env('AI_API_KEY');
  const model = env('AI_MODEL');
  if (!key || !model) throw new AiNotConfigured();
  return (env('AI_PROVIDER') || 'anthropic') === 'openai' ? openai(key, model) : anthropic(key, model);
}

export function maxRequestsPerDay(): number {
  return Math.max(1, Number(env('AI_MAX_REQUESTS_PER_DAY') || 50));
}

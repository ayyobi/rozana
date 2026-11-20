import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, Check, CheckSquare, MessageSquarePlus, Send, Settings, Sparkles, X } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/ui/forms';
import { getDictionary, useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useAction } from '@/hooks/useAction';
import { createRecord, emitChanged, pb, updateRecord } from '@/lib/pocketbase/client';
import { fmtDay } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { AiAction, AiMessage } from '@/types/models';

interface Status {
  configured: boolean;
  enabled: boolean;
  consent: boolean;
  financeConsent: boolean;
  limit: number;
}

export default function AssistantApp({ locale }: { locale: Locale }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [status, setStatus] = useState<Status | null>(null);
  const conversations = useList('ai_conversations', { sort: '-created', filter: 'archived = false' });
  const [conv, setConv] = useState<string>('');
  const messages = useList('ai_messages', { filter: conv ? pb().filter('conversation = {:c}', { c: conv }) : 'id = ""', sort: 'created' });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/ai/chat').then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false, enabled: false, consent: false, financeConsent: false, limit: 0 }));
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.items.length, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError('');
    setInput('');
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, ...(conv ? { conversation: conv } : {}) }) });
      const j = (await res.json()) as { conversation?: string; error?: string };
      if (j.conversation && j.conversation !== conv) setConv(j.conversation);
      if (!res.ok) {
        const map: Record<string, string> = {
          not_configured: t('assistant.notConfigured'),
          disabled: t('assistant.disabled'),
          no_consent: t('assistant.noConsent'),
          quota: t('assistant.quota', { n: status?.limit ?? 0 }),
          bad_key: t('assistant.badKey'),
          too_many: t('auth.tooMany'),
        };
        setError(map[j.error ?? ''] ?? t('assistant.providerError'));
        setInput(message);
      }
      emitChanged('ai_messages');
      emitChanged('ai_conversations');
    } catch {
      setError(t('errors.offline'));
      setInput(message);
    } finally {
      setBusy(false);
    }
  }

  /** Exécute une action proposée — uniquement après confirmation explicite. */
  async function apply(msg: AiMessage, index: number, accept: boolean) {
    const actions = [...(msg.actions ?? [])];
    const a = actions[index];
    if (!a || a.status === 'done' || a.status === 'rejected') return;
    await run(async () => {
      if (accept) {
        if (a.type === 'create_task')
          await createRecord('tasks', { title: a.title, priority: a.priority ?? 'normal', status: 'todo', start_date: a.start_date ?? '', start_time: a.start_date ? a.start_time ?? '' : '', deadline: a.deadline ?? '' });
        else
          await createRecord('events', { title: a.title, start_date: a.start_date, end_date: a.end_date ?? a.start_date, start_time: a.start_time ?? '', end_time: a.end_time ?? (a.start_time ? a.start_time : ''), all_day: !a.start_time });
      }
      actions[index] = { ...a, status: accept ? 'done' : 'rejected' } as AiAction;
      await updateRecord('ai_messages', msg.id, { actions });
    }, accept ? 'feedback.created' : undefined);
  }

  if (!status) return <Skeleton className="h-64" />;
  const blocked = !status.configured ? t('assistant.notConfigured') : !status.enabled ? t('assistant.disabled') : !status.consent ? t('assistant.noConsent') : null;
  const suggestions = getDictionary(locale).assistant.suggestions;

  return (
    <>
      <PageHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')} actions={<Button variant="secondary" size="sm" icon={<MessageSquarePlus className="size-4" aria-hidden />} onClick={() => setConv('')}>{t('assistant.new')}</Button>} />
      {blocked ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <Sparkles className="size-6 text-coral-strong" aria-hidden />
          <p className="max-w-xl">{blocked}</p>
          {status.configured && <a href="/parametres" className={buttonClasses('primary', 'md')}><Settings className="size-4" aria-hidden />{t('assistant.goSettings')}</a>}
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <Card className="hidden max-h-[70vh] overflow-y-auto p-3 lg:block">
            <p className="px-2 pb-2 text-sm font-medium text-ink-2">{t('assistant.conversations')}</p>
            <ul className="flex flex-col gap-1">
              {conversations.items.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setConv(c.id)} aria-current={conv === c.id ? 'true' : undefined} className={cn('w-full truncate rounded-xl px-3 py-2 text-start text-sm', conv === c.id ? 'bg-coral' : 'hover:bg-bg/50')}>
                    {c.title || '…'}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="flex min-h-[60vh] flex-col p-0">
            <p className="border-b border-line/60 px-4 py-2 text-xs text-ink-2">{status.financeConsent ? t('assistant.financeOn') : t('assistant.financeOff')}</p>
            <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
              {!conv && messages.items.length === 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-ink-2">{t('assistant.empty')}</p>
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className="rounded-2xl bg-white/60 px-4 py-2.5 text-start text-sm hover:bg-white">{s}</button>
                  ))}
                </div>
              )}
              {messages.items.map((m) => (
                <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm', m.role === 'user' ? 'bg-coral' : 'bg-white/70')}>
                    <p className="mb-1 text-xs font-semibold text-ink-2">{m.role === 'user' ? t('assistant.you') : t('assistant.assistantName')}</p>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="mb-2 text-xs font-semibold">{t('assistant.proposed')}</p>
                        <ul className="flex flex-col gap-2">
                          {m.actions.map((a, i) => (
                            <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-bg/40 px-3 py-2">
                              {a.type === 'create_task' ? <CheckSquare className="size-4" aria-hidden /> : <CalendarPlus className="size-4" aria-hidden />}
                              <span className="min-w-0 flex-1">
                                {a.title}
                                <span className="block text-xs text-ink-2">
                                  {a.start_date && fmtDay(a.start_date, locale, 'weekday')}
                                  {a.start_time && ` · ${a.start_time}`}
                                  {a.type === 'create_task' && a.deadline && ` · ${t('tasks.due', { date: fmtDay(a.deadline, locale, 'short') })}`}
                                </span>
                              </span>
                              {a.status === 'done' ? (
                                <span className="inline-flex items-center gap-1 text-xs text-sage-strong"><Check className="size-3.5" aria-hidden />{t('assistant.created')}</span>
                              ) : a.status === 'rejected' ? (
                                <span className="text-xs text-ink-2">{t('assistant.rejected')}</span>
                              ) : (
                                <>
                                  <Button size="sm" onClick={() => void apply(m, i, true)}>{t('assistant.create')}</Button>
                                  <Button size="sm" variant="ghost" aria-label={t('assistant.reject')} onClick={() => void apply(m, i, false)}><X className="size-4" aria-hidden /></Button>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && <p className="text-sm text-ink-2">{t('assistant.thinking')}</p>}
              {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
              <div ref={endRef} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex gap-2 border-t border-line/60 p-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder={t('assistant.placeholder')}
                aria-label={t('assistant.placeholder')}
                className="max-h-40 min-h-11 flex-1 resize-none rounded-field bg-white/70 px-4 py-2.5 outline-none focus:shadow-[0_0_0_3px_rgb(217_164_127/0.35)]"
              />
              <Button type="submit" size="icon" loading={busy} aria-label={t('assistant.send')}><Send className="size-5 rtl:-scale-x-100" aria-hidden /></Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

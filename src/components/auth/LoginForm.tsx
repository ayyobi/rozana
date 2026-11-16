import { useState, type ComponentProps } from 'react';
import { Field } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { useTranslations, type Locale } from '@/i18n';

type ErrorCode = 'invalid' | 'unavailable' | 'too_many';

/** Autorise uniquement une redirection interne (évite les redirections ouvertes). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export default function LoginForm({ locale, next }: { locale: Locale; next: string | null }) {
  const t = useTranslations(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);

  const onSubmit: NonNullable<ComponentProps<'form'>['onSubmit']> = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      if (res.ok) {
        window.location.assign(safeNext(next));
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: ErrorCode };
      setError(body.error ?? 'invalid');
    } catch {
      setError('unavailable');
    }
    setLoading(false);
  };

  const messages: Record<ErrorCode, string> = {
    invalid: t('auth.invalid'),
    unavailable: t('auth.pbDown'),
    too_many: t('auth.tooMany'),
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
      <Field label={t('auth.email')} name="email" type="email" autoComplete="username" inputMode="email" required dir="ltr" />
      <Field label={t('auth.password')} name="password" type="password" autoComplete="current-password" required dir="ltr" />
      {error && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {messages[error]}
        </p>
      )}
      <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
        {loading ? t('auth.submitting') : t('auth.submit')}
      </Button>
    </form>
  );
}

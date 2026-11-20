import { useState, type ComponentProps } from 'react';
import { Field } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { useTranslations, type Locale, type TranslationKey } from '@/i18n';

type ErrorCode = 'invalid' | 'unavailable' | 'too_many' | 'closed' | 'mismatch' | 'too_short' | 'email_taken' | 'bad_invite';

const MESSAGES: Record<ErrorCode, TranslationKey> = {
  invalid: 'auth.signupInvalid',
  unavailable: 'auth.pbDown',
  too_many: 'auth.tooMany',
  closed: 'auth.signupClosed',
  mismatch: 'auth.passwordMismatch',
  too_short: 'auth.passwordTooShort',
  email_taken: 'auth.emailTaken',
  bad_invite: 'auth.badInvite',
};

export default function SignupForm({ locale, inviteRequired = false }: { locale: Locale; inviteRequired?: boolean }) {
  const t = useTranslations(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);

  const onSubmit: NonNullable<ComponentProps<'form'>['onSubmit']> = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    const passwordConfirm = String(form.get('passwordConfirm') ?? '');
    // Vérifications immédiates (le serveur revérifie tout).
    if (password.length < 10) return setError('too_short');
    if (password !== passwordConfirm) return setError('mismatch');

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: form.get('name') ?? '', email: form.get('email'), password, passwordConfirm, invite: form.get('invite') ?? '' }),
      });
      if (res.ok) {
        window.location.assign('/dashboard');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: ErrorCode };
      setError(body.error ?? 'invalid');
    } catch {
      setError('unavailable');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {inviteRequired && <Field label={t('auth.invite')} name="invite" type="text" autoComplete="off" required maxLength={100} dir="ltr" error={error === 'bad_invite' ? t('auth.badInvite') : undefined} />}
      <Field label={t('auth.name')} name="name" type="text" autoComplete="given-name" maxLength={60} />
      <Field label={t('auth.email')} name="email" type="email" autoComplete="email" inputMode="email" required dir="ltr" />
      <Field
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        dir="ltr"
        hint={t('auth.passwordHint')}
        error={error === 'too_short' ? t('auth.passwordTooShort') : undefined}
      />
      <Field
        label={t('auth.passwordConfirm')}
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        dir="ltr"
        error={error === 'mismatch' ? t('auth.passwordMismatch') : undefined}
      />
      {error && error !== 'too_short' && error !== 'mismatch' && error !== 'bad_invite' && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {t(MESSAGES[error])}
          {error === 'closed' && (
            <>
              {' '}
              <a href="/connexion" className="underline">
                {t('auth.haveAccount')}
              </a>
            </>
          )}
        </p>
      )}
      <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
        {loading ? t('auth.signupSubmitting') : t('auth.signupSubmit')}
      </Button>
    </form>
  );
}

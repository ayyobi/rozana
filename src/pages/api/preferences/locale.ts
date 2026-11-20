import type { APIRoute } from 'astro';
import { LOCALE_COOKIE, isLocale } from '@/i18n';
import { secureCookies } from '@/lib/pocketbase/server';

/** Langue : enregistrée dans `user_settings` et dans un cookie (utile avant connexion). */
export const POST: APIRoute = async ({ request, cookies, redirect, locals, url }) => {
  const form = await request.formData();
  const locale = form.get('locale');
  if (!isLocale(locale)) return new Response('Langue invalide', { status: 400 });
  cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    secure: secureCookies(url),
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  // Enregistre aussi la langue dans le compte (user_settings).
  if (locals.settings && locals.settings.locale !== locale) {
    await locals.pb.collection('user_settings').update(locals.settings.id, { locale }).catch(() => undefined);
  }
  return redirect('/parametres', 303);
};

import type { APIRoute } from 'astro';
import { LOCALE_COOKIE, isLocale } from '@/i18n';

/** Phase 1 : la langue est conservée dans un cookie sur l'appareil.
 *  Phase 2 : elle sera aussi enregistrée dans `user_settings` (PocketBase). */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const locale = form.get('locale');
  if (!isLocale(locale)) return new Response('Langue invalide', { status: 400 });
  cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  return redirect('/parametres?saved=locale', 303);
};

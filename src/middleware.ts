import { defineMiddleware } from 'astro:middleware';
import { createServerPb, secureCookies, writeAuthCookie } from '@/lib/pocketbase/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from '@/i18n';
import { ensureUserSetup } from '@/lib/setup/seed';
import { DEFAULT_TIMEZONE } from '@/lib/utils/dates';

/** Routes accessibles sans session. Tout le reste est privé. */
const PUBLIC_PATHS = ['/connexion', '/inscription', '/api/auth/login', '/api/auth/register', '/hors-ligne', '/manifest.webmanifest', '/sw.js', '/favicon.ico'];
const PUBLIC_PREFIXES = ['/_astro/', '/icons/', '/fonts/'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, url, locals, redirect } = context;

  // Langue : cookie en attendant la synchronisation avec user_settings (phase 2).
  const cookieLocale = cookies.get(LOCALE_COOKIE)?.value;
  locals.locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const pb = createServerPb(request.headers.get('cookie'));
  locals.pb = pb;
  locals.user = null;

  let sessionExpired = false;
  if (pb.authStore.isValid) {
    try {
      // Vérification côté serveur : le jeton est revalidé auprès de PocketBase.
      await pb.collection('users').authRefresh();
      locals.user = pb.authStore.record;
    } catch {
      pb.authStore.clear();
      sessionExpired = true;
    }
  } else if (cookies.has('pb_auth')) {
    sessionExpired = true;
    pb.authStore.clear();
  }

  locals.settings = null;
  locals.timezone = DEFAULT_TIMEZONE;
  if (locals.user) {
    try {
      locals.settings = await ensureUserSetup(pb, locals.user.id, locals.locale, DEFAULT_TIMEZONE);
      locals.locale = locals.settings.locale;
      locals.timezone = locals.settings.timezone || DEFAULT_TIMEZONE;
    } catch (err) {
      console.error('[rozana] réglages indisponibles', err);
    }
  }

  if (!locals.user && !isPublic(url.pathname)) {
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    const target = new URL('/connexion', url);
    if (url.pathname !== '/') target.searchParams.set('next', url.pathname);
    if (sessionExpired) target.searchParams.set('expired', '1');
    const res = redirect(target.pathname + target.search, 302);
    cookies.delete('pb_auth', { path: '/' });
    return res;
  }

  const response = await next();

  // Rafraîchit le cookie (nouveau jeton) sur les pages privées.
  if (locals.user) writeAuthCookie(pb, cookies, secureCookies(url));

  // En-têtes de sécurité de base. La CSP complète est réglée au déploiement (voir docs).
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
});

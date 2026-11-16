import type { APIRoute } from 'astro';
import { PB_COOKIE } from '@/lib/pocketbase/server';

export const POST: APIRoute = ({ cookies, locals, redirect }) => {
  locals.pb.authStore.clear();
  cookies.delete(PB_COOKIE, { path: '/' });
  return redirect('/connexion?bye=1', 303);
};

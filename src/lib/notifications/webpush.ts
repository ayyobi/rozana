import * as webpush from 'web-push';
import type PocketBase from 'pocketbase';
import { serverEnv } from '@/lib/server/env';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export function vapidConfigured(): boolean {
  return !!(serverEnv('PUBLIC_VAPID_PUBLIC_KEY') && serverEnv('VAPID_PRIVATE_KEY'));
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    serverEnv('VAPID_SUBJECT') || 'mailto:admin@example.com',
    serverEnv('PUBLIC_VAPID_PUBLIC_KEY')!,
    serverEnv('VAPID_PRIVATE_KEY')!,
  );
  configured = true;
}

interface SubRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failures: number;
}

/** Envoie une notification à tous les appareils abonnés de l'utilisatrice (via son propre jeton). */
export async function sendToUser(pb: PocketBase, payload: PushPayload): Promise<{ sent: number; removed: number }> {
  configure();
  const subs = await pb.collection('push_subscriptions').getFullList<SubRecord>();
  let sent = 0;
  let removed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      await pb.collection('push_subscriptions').update(s.id, { last_success_at: new Date().toISOString(), failures: 0 });
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await pb.collection('push_subscriptions').delete(s.id).catch(() => undefined);
        removed++;
      } else await pb.collection('push_subscriptions').update(s.id, { failures: (s.failures || 0) + 1 }).catch(() => undefined);
    }
  }
  return { sent, removed };
}

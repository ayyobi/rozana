import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Check, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslations, type Locale } from '@/i18n';
import { toast } from '@/stores/toast';

type T = ReturnType<typeof useTranslations>;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

interface Diag {
  secure: boolean;
  sw: boolean;
  push: boolean;
  permission: NotificationPermission | 'unsupported';
  standalone: boolean;
  ios: boolean;
  subscribed: boolean;
  server: boolean | null;
}

/** Activation des notifications push + page de diagnostic (iPhone compris). */
export function PushSettings({ locale }: { locale: Locale }) {
  const t = useTranslations(locale);
  const [d, setD] = useState<Diag | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sw = 'serviceWorker' in navigator;
    const push = 'PushManager' in window;
    let subscribed = false;
    if (sw && push) {
      const reg = await navigator.serviceWorker.getRegistration();
      subscribed = !!(await reg?.pushManager.getSubscription());
    }
    let server: boolean | null = null;
    try {
      const r = await fetch('/api/push/test');
      const j = (await r.json()) as { configured: boolean; publicKey: string | null };
      server = j.configured;
      setPublicKey(j.publicKey);
    } catch {
      server = null;
    }
    setD({
      secure: window.isSecureContext,
      sw,
      push,
      permission: 'Notification' in window ? Notification.permission : 'unsupported',
      standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      ios: /iPhone|iPad|iPod/.test(navigator.userAgent),
      subscribed,
      server,
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // La demande d'autorisation est déclenchée uniquement par ce clic (exigence iOS).
  async function enable() {
    if (!publicKey) {
      toast(t('settings.push.notConfigured'), 'error', 6000);
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast(t('settings.push.denied'), 'error', 6000);
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error('subscribe failed');
      toast(t('settings.push.enabled'), 'success');
    } catch (e) {
      console.error(e);
      toast(t('errors.generic'), 'error');
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function test() {
    setBusy(true);
    try {
      const r = await fetch('/api/push/test', { method: 'POST' });
      const j = (await r.json()) as { sent?: number; error?: string };
      if (j.error === 'not_configured') toast(t('settings.push.notConfigured'), 'error', 6000);
      else if (!j.sent) toast(t('settings.push.testNone'), 'info');
      else toast(t('settings.push.testSent', { n: j.sent }), 'success');
    } catch {
      toast(t('errors.offline'), 'offline');
    } finally {
      setBusy(false);
    }
  }

  if (!d) return null;
  const perm = d.permission === 'granted' ? t('settings.push.granted') : d.permission === 'denied' ? t('settings.push.deniedShort') : d.permission === 'default' ? t('settings.push.default') : t('settings.push.no');
  const rows: Array<[string, boolean | null, string?]> = [
    [t('settings.push.secure'), d.secure],
    [t('settings.push.sw'), d.sw],
    [t('settings.push.pushApi'), d.push],
    [t('settings.push.permission'), d.permission === 'granted' ? true : d.permission === 'denied' ? false : null, perm],
    [t('settings.push.standalone'), d.standalone],
    [t('settings.push.subscribed'), d.subscribed],
    [t('settings.push.server'), d.server],
  ];
  return (
    <div className="flex flex-col gap-4">
      {d.ios && !d.standalone && <p className="rounded-2xl bg-apricot-soft px-4 py-3 text-sm">{t('settings.push.ios')}</p>}
      <div className="flex flex-wrap gap-2">
        {d.subscribed ? (
          <Button variant="secondary" loading={busy} icon={<BellOff className="size-4" aria-hidden />} onClick={() => void disable()}>{t('settings.push.disable')}</Button>
        ) : (
          <Button loading={busy} disabled={!d.push || !d.sw} icon={<Bell className="size-4" aria-hidden />} onClick={() => void enable()}>{t('settings.push.enable')}</Button>
        )}
        <Button variant="secondary" loading={busy} icon={<Send className="size-4" aria-hidden />} onClick={() => void test()}>{t('settings.push.test')}</Button>
      </div>
      <Diagnostic rows={rows} t={t} />
    </div>
  );
}

function Diagnostic({ rows, t }: { rows: Array<[string, boolean | null, string?]>; t: T }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{t('settings.push.diagnostic')}</p>
      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {rows.map(([label, ok, text]) => (
          <li key={label} className="flex items-center gap-2 rounded-xl bg-white/55 px-3 py-2">
            {ok === true ? <Check className="size-4 text-sage-strong" aria-hidden /> : ok === false ? <X className="size-4 text-danger" aria-hidden /> : <span className="size-4 text-center text-ink-2" aria-hidden>?</span>}
            <span className="flex-1">{label}</span>
            <span className="text-ink-2">{text ?? (ok === true ? t('settings.push.yes') : ok === false ? t('settings.push.no') : t('settings.push.unknown'))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type PocketBase from 'pocketbase';
import type { Locale, UserSettings } from '@/types/models';
import { DEFAULT_LAYOUT } from '@/components/dashboard/registry';

/** Valeurs par défaut créées à la première connexion (données propres à l'utilisatrice). */
const DEFAULT_CATEGORIES: Record<Locale, Array<[string, string]>> = {
  fr: [
    ['École', '#E7D29E'],
    ['Travail', '#EAD3BF'],
    ['Projets', '#D9A47F'],
    ['Personnel', '#C6D3BD'],
    ['Rendez-vous', '#C9C2DD'],
    ['Finances', '#B9D3D6'],
  ],
  fa: [
    ['مدرسه', '#E7D29E'],
    ['کار', '#EAD3BF'],
    ['پروژه‌ها', '#D9A47F'],
    ['شخصی', '#C6D3BD'],
    ['قرار ملاقات', '#C9C2DD'],
    ['مالی', '#B9D3D6'],
  ],
};

/** [nom, emoji, essentiel] — l'essentiel est prioritaire dans la répartition du budget. */
const EXPENSE_CATS: Record<Locale, Array<[string, string, boolean, string]>> = {
  fr: [
    ['Logement', '🏠', true, '#D9A47F'],
    ['Alimentation', '🥕', true, '#C6D3BD'],
    ['Transport', '🚌', true, '#B9D3D6'],
    ['Santé', '🩺', true, '#E7D29E'],
    ['Loisirs', '🎨', false, '#C9C2DD'],
    ['Shopping', '🛍️', false, '#EAD3BF'],
    ['Abonnements', '📱', false, '#D7C4B3'],
    ['Famille', '👪', true, '#E3B9A3'],
    ['Autres', '•', false, '#D5CFC6'],
  ],
  fa: [
    ['مسکن', '🏠', true, '#D9A47F'],
    ['خوراک', '🥕', true, '#C6D3BD'],
    ['حمل‌ونقل', '🚌', true, '#B9D3D6'],
    ['سلامت', '🩺', true, '#E7D29E'],
    ['تفریح', '🎨', false, '#C9C2DD'],
    ['خرید', '🛍️', false, '#EAD3BF'],
    ['اشتراک‌ها', '📱', false, '#D7C4B3'],
    ['خانواده', '👪', true, '#E3B9A3'],
    ['سایر', '•', false, '#D5CFC6'],
  ],
};

const INCOME_CATS: Record<Locale, Array<[string, string]>> = {
  fr: [
    ['Salaire', '💼'],
    ['Bourse', '🎓'],
    ['Autres revenus', '✨'],
  ],
  fa: [
    ['حقوق', '💼'],
    ['بورسیه', '🎓'],
    ['سایر درآمدها', '✨'],
  ],
};

/**
 * Garantit que l'utilisatrice a ses réglages et ses données de départ.
 * Idempotent : ne fait rien si `user_settings` existe déjà.
 */
export async function ensureUserSetup(
  pb: PocketBase,
  owner: string,
  locale: Locale,
  timezone: string,
): Promise<UserSettings> {
  const existing = await pb
    .collection('user_settings')
    .getFirstListItem<UserSettings>(pb.filter('owner = {:o}', { o: owner }))
    .catch(() => null);
  if (existing) return existing;

  const settings = await pb.collection('user_settings').create<UserSettings>({
    owner,
    locale,
    timezone,
    currency: 'EUR',
    calendar: 'gregory',
    ai_enabled: true,
    ai_finance_consent: false,
    budget_alert_pct: 80,
    notify_tasks: true,
    notify_events: true,
    notify_habits: true,
    notify_finance: true,
    daily_summary: false,
    daily_summary_time: '08:00',
    weekly_summary: false,
  });

  const batch = pb.createBatch();
  DEFAULT_CATEGORIES[locale].forEach(([name, color], i) => batch.collection('categories').create({ owner, name, color, sort: i }));
  EXPENSE_CATS[locale].forEach(([name, icon, essential, color], i) =>
    batch.collection('finance_categories').create({ owner, name, icon, essential, color, kind: 'expense', sort: i }),
  );
  INCOME_CATS[locale].forEach(([name, icon], i) =>
    batch.collection('finance_categories').create({ owner, name, icon, kind: 'income', color: '#C6D3BD', sort: i }),
  );
  batch.collection('finance_accounts').create({
    owner,
    name: locale === 'fa' ? 'حساب جاری' : 'Compte courant',
    type: 'checking',
    currency: 'EUR',
    opening_balance_cents: 0,
  });
  DEFAULT_LAYOUT.forEach((w) =>
    batch.collection('dashboard_widgets').create({ owner, widget: w.id, visible: w.visible, order: w.order, size: w.size }),
  );
  try {
    await batch.send();
  } catch {
    // Batch désactivé côté serveur : repli séquentiel.
    for (const [i, [name, color]] of DEFAULT_CATEGORIES[locale].entries())
      await pb.collection('categories').create({ owner, name, color, sort: i });
    for (const [i, [name, icon, essential, color]] of EXPENSE_CATS[locale].entries())
      await pb.collection('finance_categories').create({ owner, name, icon, essential, color, kind: 'expense', sort: i });
    for (const [i, [name, icon]] of INCOME_CATS[locale].entries())
      await pb.collection('finance_categories').create({ owner, name, icon, kind: 'income', color: '#C6D3BD', sort: i });
    await pb.collection('finance_accounts').create({ owner, name: locale === 'fa' ? 'حساب جاری' : 'Compte courant', type: 'checking', currency: 'EUR', opening_balance_cents: 0 });
    for (const w of DEFAULT_LAYOUT)
      await pb.collection('dashboard_widgets').create({ owner, widget: w.id, visible: w.visible, order: w.order, size: w.size });
  }
  return settings;
}

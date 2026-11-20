/**
 * Rozana — processus serveur des rappels (notifications push).
 *
 * Tourne en continu à côté de l'application (pm2, systemd, Docker…) et vérifie
 * chaque minute les rappels à envoyer. Il ne dépend PAS du navigateur.
 *
 *   npm run build:worker && npm run worker
 *
 * Variables requises : PUBLIC_PB_URL (ou PB_INTERNAL_URL), PB_SUPERUSER_EMAIL,
 * PB_SUPERUSER_PASSWORD, PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 * Le compte superuser reste sur le serveur : il n'est jamais envoyé au navigateur.
 */
import PocketBase from 'pocketbase';
import * as webpush from 'web-push';
import type { CalEvent, Habit, HabitLog, MonthlyBudget, MoneyTransfer, RecurringTx, Task, Transaction, UserSettings } from '../src/types/models';
import { addDays, nowTimeIn, todayIn, zonedToUtc } from '../src/lib/utils/day';
import { occurrencesBetween } from '../src/lib/planning/recurrence';
import { recurringDueDates } from '../src/lib/planning/calendar';
import { scheduledOn, isDone } from '../src/lib/habits';
import { budgetStatus } from '../src/lib/finance/compute';
import { isOpen, isOverdue, isToday } from '../src/lib/planning/tasks';

const env = process.env;
const PB_URL = env.PB_INTERNAL_URL || env.PUBLIC_PB_URL || 'http://127.0.0.1:8090';
const TOLERANCE_MS = 10 * 60 * 1000; // rattrape un arrêt de quelques minutes
const once = process.argv.includes('--once');

interface Due {
  key: string;
  at: Date;
  title: string;
  body: string;
  url: string;
  type: string;
  id: string;
}

const T = {
  fr: {
    task: 'Tâche', event: 'Événement', habit: 'Habitude', due: 'Échéance', budget: 'Budget', transfer: 'Transfert prévu',
    habitBody: 'C’est le moment, à ton rythme 🌿', budgetWarn: 'consommé à {pct} %', budgetOver: 'dépassé', daily: 'Ta journée', dailyBody: '{tasks} tâche(s) et {events} événement(s) aujourd’hui.',
    weekly: 'Ta semaine', weeklyBody: '{done} tâche(s) terminée(s) la semaine dernière. Belle semaine à toi !', monthly: 'Bilan du mois disponible', monthlyBody: 'Ton bilan financier mensuel t’attend.', overdue: '{n} tâche(s) en retard',
    weeklyFin: 'Bilan hebdomadaire disponible', weeklyFinBody: 'Ton bilan financier de la semaine t’attend.',
  },
  fa: {
    task: 'کار', event: 'رویداد', habit: 'عادت', due: 'سررسید', budget: 'بودجه', transfer: 'حوالهٔ برنامه‌ریزی‌شده',
    habitBody: 'وقتش است، با ریتم خودت 🌿', budgetWarn: '{pct}٪ مصرف شده', budgetOver: 'فراتر رفته', daily: 'روز تو', dailyBody: '{tasks} کار و {events} رویداد امروز.',
    weekly: 'هفتهٔ تو', weeklyBody: 'هفتهٔ گذشته {done} کار انجام دادی. هفتهٔ خوبی داشته باشی!', monthly: 'گزارش ماه آماده است', monthlyBody: 'گزارش مالی ماهانه‌ات منتظر توست.', overdue: '{n} کار عقب‌افتاده',
    weeklyFin: 'گزارش هفتگی آماده است', weeklyFinBody: 'گزارش مالی این هفته‌ات منتظر توست.',
  },
};
const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? ''));

async function computeDues(pb: PocketBase, s: UserSettings, now: Date): Promise<Due[]> {
  const tz = s.timezone || 'Europe/Paris';
  const L = T[s.locale === 'fa' ? 'fa' : 'fr'];
  const today = todayIn(tz, now);
  const tomorrow = addDays(today, 1);
  const owner = pb.filter('owner = {:o}', { o: s.owner });
  const at = (day: string, time: string, minusMin = 0) => new Date(zonedToUtc(day, time, tz).getTime() - minusMin * 60000);
  const dues: Due[] = [];

  if (s.notify_tasks) {
    const tasks = await pb.collection('tasks').getFullList<Task>({ filter: `${owner} && (status = "todo" || status = "in_progress") && reminder_min > 0` });
    for (const tk of tasks) {
      if (tk.start_date && tk.start_time) dues.push({ key: `task:${tk.id}:${tk.start_date}T${tk.start_time}:${tk.reminder_min}`, at: at(tk.start_date, tk.start_time, tk.reminder_min), title: `${L.task} · ${tk.title}`, body: tk.start_time, url: '/taches', type: 'task', id: tk.id });
      else if (tk.deadline) dues.push({ key: `deadline:${tk.id}:${tk.deadline}:${tk.reminder_min}`, at: at(tk.deadline, '09:00', tk.reminder_min), title: `${L.due} · ${tk.title}`, body: tk.deadline, url: '/taches', type: 'task', id: tk.id });
    }
  }

  if (s.notify_events) {
    const events = await pb.collection('events').getFullList<CalEvent>({ filter: `${owner} && reminder_min > 0` });
    for (const ev of events) {
      for (const d of occurrencesBetween(ev.start_date, ev.recurrence, today, tomorrow, ev.exdates)) {
        const time = ev.all_day || !ev.start_time ? '09:00' : ev.start_time;
        dues.push({ key: `event:${ev.id}:${d}:${ev.reminder_min}`, at: at(d, time, ev.reminder_min), title: `${L.event} · ${ev.title}`, body: ev.all_day ? d : `${d} ${time}`, url: `/planning/jour?date=${d}`, type: 'event', id: ev.id });
      }
    }
  }

  if (s.notify_habits) {
    const habits = await pb.collection('habits').getFullList<Habit>({ filter: `${owner} && archived = false && reminder_time != ""` });
    const logs = await pb.collection('habit_logs').getFullList<HabitLog>({ filter: `${owner} && date = "${today}"` });
    for (const h of habits) {
      if (!scheduledOn(h, today) || isDone(h, logs.find((l) => l.habit === h.id))) continue;
      dues.push({ key: `habit:${h.id}:${today}`, at: at(today, h.reminder_time), title: `${L.habit} · ${h.icon} ${h.name}`, body: L.habitBody, url: '/habitudes', type: 'habit', id: h.id });
    }
  }

  if (s.notify_finance) {
    const recurring = await pb.collection('recurring_transactions').getFullList<RecurringTx>({ filter: `${owner} && active = true` });
    for (const r of recurring) {
      for (const d of recurringDueDates(r, today, addDays(today, Math.max(0, r.reminder_days) + 1))) {
        const notifyDay = addDays(d, -Math.max(0, r.reminder_days));
        dues.push({ key: `recurring:${r.id}:${d}`, at: at(notifyDay, '09:00'), title: `${L.due} · ${r.label}`, body: `${d} · ${(r.amount_cents / 100).toFixed(2)} ${r.currency}`, url: '/finances/recurrences', type: 'finance', id: r.id });
      }
    }
    const month = today.slice(0, 7);
    const budgets = await pb.collection('monthly_budgets').getFullList<MonthlyBudget>({ filter: `${owner} && month = "${month}"` });
    if (budgets.length) {
      const txs = await pb.collection('transactions').getFullList<Transaction>({ filter: `${owner} && date >= "${month}-01"` });
      const cats = new Map((await pb.collection('finance_categories').getFullList<{ id: string; name: string }>({ filter: owner })).map((c) => [c.id, c.name]));
      for (const l of budgetStatus(budgets, txs, month, s.budget_alert_pct || 80).lines) {
        if (l.state === 'ok') continue;
        const name = cats.get(l.category) ?? '';
        dues.push({ key: `budget:${l.category}:${month}:${l.state}`, at: at(today, '00:00'), title: `${L.budget} · ${name}`, body: l.state === 'over' ? L.budgetOver : fill(L.budgetWarn, { pct: Math.round(l.pct) }), url: '/finances/budgets', type: 'finance', id: l.category });
      }
    }
    const transfers = await pb.collection('money_transfers').getFullList<MoneyTransfer>({ filter: `${owner} && status = "planned" && date = "${today}"` });
    for (const tr of transfers) dues.push({ key: `transfer:${tr.id}:${tr.date}`, at: at(today, '09:00'), title: `${L.transfer} · ${tr.recipient}`, body: `${(tr.amount_cents / 100).toFixed(2)} ${tr.currency}`, url: '/finances/transferts', type: 'finance', id: tr.id });
    // Bilans : hebdomadaire le lundi, mensuel le 1er.
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    if (weekday === 0) dues.push({ key: `report:week:${today}`, at: at(today, '09:00'), title: L.weeklyFin, body: L.weeklyFinBody, url: '/finances/bilans', type: 'report', id: '' });
    if (today.endsWith('-01')) dues.push({ key: `report:month:${month}`, at: at(today, '09:00'), title: L.monthly, body: L.monthlyBody, url: '/finances/bilans', type: 'report', id: '' });
  }

  if (s.daily_summary) {
    const time = s.daily_summary_time || '08:00';
    if (nowTimeIn(tz, now) >= time) {
      const tasks = await pb.collection('tasks').getFullList<Task>({ filter: `${owner} && (status = "todo" || status = "in_progress")` });
      const events = await pb.collection('events').getFullList<CalEvent>({ filter: owner });
      const nEvents = events.filter((e) => occurrencesBetween(e.start_date, e.recurrence, today, today, e.exdates).length > 0).length;
      const nTasks = tasks.filter((x) => isToday(x, today)).length;
      const overdue = tasks.filter((x) => isOpen(x) && isOverdue(x, today)).length;
      dues.push({ key: `summary:day:${today}`, at: at(today, time), title: L.daily, body: fill(L.dailyBody, { tasks: nTasks, events: nEvents }) + (overdue ? ` ${fill(L.overdue, { n: overdue })}.` : ''), url: '/dashboard', type: 'summary', id: '' });
    }
  }
  if (s.weekly_summary) {
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    if (weekday === 0) {
      const done = await pb.collection('tasks').getList(1, 1, { filter: `${owner} && status = "done" && completed_at >= "${addDays(today, -7)} 00:00:00"` });
      dues.push({ key: `summary:week:${today}`, at: at(today, '09:00'), title: L.weekly, body: fill(L.weeklyBody, { done: done.totalItems }), url: '/statistiques', type: 'summary', id: '' });
    }
  }
  return dues;
}

async function tick(pb: PocketBase): Promise<void> {
  const now = new Date();
  const settings = await pb.collection('user_settings').getFullList<UserSettings>();
  for (const s of settings) {
    const subs = await pb.collection('push_subscriptions').getFullList<{ id: string; endpoint: string; p256dh: string; auth: string; failures: number }>({ filter: pb.filter('owner = {:o}', { o: s.owner }) });
    if (!subs.length) continue;
    let dues: Due[];
    try {
      dues = await computeDues(pb, s, now);
    } catch (e) {
      console.error('[worker] calcul impossible pour', s.owner, e);
      continue;
    }
    for (const d of dues) {
      const delta = now.getTime() - d.at.getTime();
      if (delta < 0 || delta > TOLERANCE_MS) continue;
      // Anti-doublon : l'index unique (owner, dedupe_key) garantit un seul envoi.
      try {
        await pb.collection('reminders').create({ owner: s.owner, dedupe_key: d.key.slice(0, 200), target_type: d.type, target_id: d.id, title: d.title.slice(0, 200), status: 'sent', sent_at: now.toISOString() });
      } catch {
        continue; // déjà envoyé
      }
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: d.title, body: d.body, url: d.url, tag: d.key }), { TTL: 3600 });
          await pb.collection('push_subscriptions').update(sub.id, { last_success_at: now.toISOString(), failures: 0 });
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await pb.collection('push_subscriptions').delete(sub.id).catch(() => undefined);
          else await pb.collection('push_subscriptions').update(sub.id, { failures: (sub.failures || 0) + 1 }).catch(() => undefined);
        }
      }
      console.log(`[worker] ${now.toISOString()} → ${d.key}`);
    }
  }
}

async function main() {
  const missing = ['PB_SUPERUSER_EMAIL', 'PB_SUPERUSER_PASSWORD', 'PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'].filter((k) => !env[k]);
  if (missing.length) {
    console.error(`[worker] Variables manquantes : ${missing.join(', ')}. Voir docs/NOTIFICATIONS.md.`);
    process.exit(1);
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:admin@example.com', env.PUBLIC_VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  const auth = () => pb.collection('_superusers').authWithPassword(env.PB_SUPERUSER_EMAIL!, env.PB_SUPERUSER_PASSWORD!);
  await auth();
  console.log(`[worker] démarré · ${PB_URL}`);
  const loop = async () => {
    try {
      if (!pb.authStore.isValid) await auth();
      await tick(pb);
    } catch (e) {
      console.error('[worker] erreur', e);
    }
  };
  await loop();
  if (once) return;
  setInterval(loop, 60_000);
}

void main();

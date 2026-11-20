import type PocketBase from 'pocketbase';
import type { AiAction, CalEvent, Habit, Project, Task, Transaction, MonthlyBudget, RecurringTx } from '@/types/models';
import { addDays, endOfMonth, startOfMonth } from '@/lib/utils/day';
import { occurrencesBetween } from '@/lib/planning/recurrence';
import { budgetStatus, periodTotals, upcomingDues } from '@/lib/finance/compute';
import type { Locale } from '@/i18n';

/** Résumé compact des données autorisées (limité pour maîtriser les coûts). */
export async function buildContext(pb: PocketBase, today: string, includeFinance: boolean): Promise<string> {
  const horizon = addDays(today, 14);
  const [tasks, events, projects, habits] = await Promise.all([
    pb.collection('tasks').getFullList<Task>({ filter: 'status = "todo" || status = "in_progress"', sort: 'deadline' }),
    pb.collection('events').getFullList<CalEvent>(),
    pb.collection('projects').getFullList<Project>({ filter: 'status = "todo" || status = "in_progress"' }),
    pb.collection('habits').getFullList<Habit>({ filter: 'archived = false' }),
  ]);
  const lines: string[] = [];
  lines.push(`TÂCHES OUVERTES (${tasks.length}) :`);
  for (const t of tasks.slice(0, 60)) {
    const proj = projects.find((p) => p.id === t.project)?.name;
    lines.push(`- [${t.priority}] ${t.title}${t.start_date ? ` | prévue ${t.start_date}${t.start_time ? ' ' + t.start_time : ''}` : ''}${t.deadline ? ` | échéance ${t.deadline}` : ''}${t.estimate_min ? ` | ~${t.estimate_min} min` : ''}${proj ? ` | projet ${proj}` : ''}${t.status === 'in_progress' ? ' | en cours' : ''}`);
  }
  lines.push(`\nÉVÉNEMENTS (du ${today} au ${horizon}) :`);
  for (const e of events) {
    for (const d of occurrencesBetween(e.start_date, e.recurrence, today, horizon, e.exdates)) {
      lines.push(`- ${d} ${e.all_day ? 'journée' : `${e.start_time}-${e.end_time}`} ${e.title}`);
    }
  }
  lines.push(`\nPROJETS EN COURS : ${projects.map((p) => `${p.name}${p.deadline ? ` (échéance ${p.deadline})` : ''}`).join(' ; ') || 'aucun'}`);
  lines.push(`HABITUDES : ${habits.map((h) => h.name).join(', ') || 'aucune'}`);
  if (includeFinance) {
    const from = startOfMonth(today);
    const [txs, budgets, recurring] = await Promise.all([
      pb.collection('transactions').getFullList<Transaction>({ filter: pb.filter('date >= {:d}', { d: addDays(from, -90) }) }),
      pb.collection('monthly_budgets').getFullList<MonthlyBudget>({ filter: pb.filter('month = {:m}', { m: today.slice(0, 7) }) }),
      pb.collection('recurring_transactions').getFullList<RecurringTx>({ filter: 'active = true' }),
    ]);
    const cats = new Map((await pb.collection('finance_categories').getFullList<{ id: string; name: string }>()).map((c) => [c.id, c.name]));
    const tot = periodTotals(txs, from, endOfMonth(from));
    const eur = (c: number) => (c / 100).toFixed(2);
    lines.push(`\nFINANCES DU MOIS (montants) : revenus ${eur(tot.incomeCents)}, dépenses ${eur(tot.expenseCents)}.`);
    for (const l of budgetStatus(budgets, txs, today.slice(0, 7)).lines) lines.push(`- budget ${cats.get(l.category) ?? '?'} : ${eur(l.spentCents)} / ${eur(l.budgetCents)}`);
    for (const u of upcomingDues(recurring, txs, today, endOfMonth(today))) lines.push(`- échéance ${u.date} ${u.label} ${eur(u.amountCents)}`);
  } else lines.push('\n(Données financières non partagées.)');
  return lines.join('\n').slice(0, 12000);
}

export function systemPrompt(locale: Locale, today: string, tz: string, context: string): string {
  const lang = locale === 'fa' ? 'persan (dari), avec un ton chaleureux' : 'français, en tutoyant, avec un ton chaleureux et concis';
  return `Tu es l'assistant de Rozana, une application personnelle de planning, d'habitudes et de finances.
Réponds en ${lang}. Nous sommes le ${today} (fuseau ${tz}).
Tu aides à organiser la journée, préparer un planning, découper un projet, prioriser, repérer les conflits horaires, proposer des étapes et des économies raisonnables.
Règles :
- Appuie-toi UNIQUEMENT sur les données ci-dessous ; si une information manque, dis-le.
- Ne culpabilise jamais l'utilisatrice ; propose, ne juge pas.
- Pas de conseil financier risqué : seulement des économies raisonnables.
- Tu ne modifies rien toi-même. Si tu proposes de créer des tâches ou des événements, ajoute À LA FIN un bloc :
\`\`\`actions
[{"type":"create_task","title":"…","start_date":"AAAA-MM-JJ","start_time":"HH:MM","deadline":"AAAA-MM-JJ","priority":"normal"},
 {"type":"create_event","title":"…","start_date":"AAAA-MM-JJ","start_time":"HH:MM","end_time":"HH:MM"}]
\`\`\`
  (champs facultatifs omis si inconnus ; 10 actions maximum). L'utilisatrice confirmera chaque action.

DONNÉES AUTORISÉES :
${context}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Extrait et valide les actions proposées (jamais exécutées sans confirmation). */
export function parseActions(raw: string): { text: string; actions: AiAction[] | null } {
  const m = /```actions\s*([\s\S]*?)```/i.exec(raw);
  if (!m) return { text: raw.trim(), actions: null };
  const text = raw.replace(m[0], '').trim();
  try {
    const arr = JSON.parse(m[1] ?? '[]') as Array<Record<string, unknown>>;
    const actions: AiAction[] = [];
    for (const a of arr.slice(0, 10)) {
      const title = typeof a.title === 'string' ? a.title.slice(0, 200).trim() : '';
      if (!title) continue;
      const d = (k: string) => (typeof a[k] === 'string' && DATE.test(a[k] as string) ? (a[k] as string) : undefined);
      const tm = (k: string) => (typeof a[k] === 'string' && TIME.test(a[k] as string) ? (a[k] as string) : undefined);
      if (a.type === 'create_task') {
        const pr = ['low', 'normal', 'high', 'urgent'].includes(a.priority as string) ? (a.priority as 'low') : 'normal';
        actions.push({ type: 'create_task', title, priority: pr, status: 'pending', ...(d('start_date') ? { start_date: d('start_date')! } : {}), ...(tm('start_time') ? { start_time: tm('start_time')! } : {}), ...(d('deadline') ? { deadline: d('deadline')! } : {}) });
      } else if (a.type === 'create_event' && d('start_date')) {
        actions.push({ type: 'create_event', title, start_date: d('start_date')!, status: 'pending', ...(tm('start_time') ? { start_time: tm('start_time')! } : {}), ...(d('end_date') ? { end_date: d('end_date')! } : {}), ...(tm('end_time') ? { end_time: tm('end_time')! } : {}) });
      }
    }
    return { text, actions: actions.length ? actions : null };
  } catch {
    return { text, actions: null };
  }
}

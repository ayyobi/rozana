/**
 * Calculs financiers de Rozana — fonctions pures, montants en CENTIMES ENTIERS.
 * Aucune arithmétique flottante sur des montants (seuls les pourcentages affichés
 * sont des nombres décimaux, jamais réinjectés dans un montant).
 */
import type { FinanceAccount, MonthlyBudget, RecurringTx, SavingsContribution, Transaction } from '../../types/models';
import { addDays, endOfMonth, diffDays, monthKey, startOfMonth, type DayStr } from '../utils/day';
import { recurringDueDates } from '../planning/calendar';

export function sumCents(values: number[]): number {
  let total = 0;
  for (const v of values) {
    if (!Number.isSafeInteger(v)) throw new TypeError('Montant non entier');
    total += v;
  }
  if (!Number.isSafeInteger(total)) throw new RangeError('Dépassement');
  return total;
}

const confirmed = (t: Transaction) => t.status === 'confirmed';
const signed = (t: Transaction) => (t.type === 'income' ? t.amount_cents : -t.amount_cents);

export function inPeriod(t: { date: string }, from: DayStr, to: DayStr): boolean {
  return t.date >= from && t.date <= to;
}

export interface PeriodTotals {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

/** Totaux des transactions CONFIRMÉES sur une période. */
export function periodTotals(txs: Transaction[], from: DayStr, to: DayStr): PeriodTotals {
  const list = txs.filter((t) => confirmed(t) && inPeriod(t, from, to));
  const incomeCents = sumCents(list.filter((t) => t.type === 'income').map((t) => t.amount_cents));
  const expenseCents = sumCents(list.filter((t) => t.type === 'expense').map((t) => t.amount_cents));
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

/** 1. Solde enregistré : soldes d'ouverture + transactions confirmées jusqu'à aujourd'hui. */
export function recordedBalance(accounts: FinanceAccount[], txs: Transaction[], today: DayStr, accountId?: string): number {
  const accs = accounts.filter((a) => !accountId || a.id === accountId);
  const ids = new Set(accs.map((a) => a.id));
  const opening = sumCents(accs.map((a) => a.opening_balance_cents || 0));
  const moves = sumCents(txs.filter((t) => confirmed(t) && t.date <= today && (!accountId ? true : ids.has(t.account))).map(signed));
  return opening + moves;
}

/** Dépenses confirmées par catégorie sur une période. */
export function spendByCategory(txs: Transaction[], from: DayStr, to: DayStr): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (!confirmed(t) || t.type !== 'expense' || !inPeriod(t, from, to)) continue;
    m.set(t.category || '', (m.get(t.category || '') ?? 0) + t.amount_cents);
  }
  return m;
}

export interface BudgetLine {
  category: string;
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  /** Pourcentage consommé (affichage uniquement). */
  pct: number;
  state: 'ok' | 'warning' | 'over';
}

/** 2. Reste du budget mensuel, ligne par ligne. */
export function budgetStatus(budgets: MonthlyBudget[], txs: Transaction[], month: string, alertPct = 80): { lines: BudgetLine[]; totalBudget: number; totalSpent: number; remaining: number } {
  const from = `${month}-01`;
  const to = endOfMonth(from);
  const spent = spendByCategory(txs, from, to);
  const lines = budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const s = spent.get(b.category) ?? 0;
      const pct = b.amount_cents > 0 ? (s / b.amount_cents) * 100 : s > 0 ? 100 : 0;
      return {
        category: b.category,
        budgetCents: b.amount_cents,
        spentCents: s,
        remainingCents: b.amount_cents - s,
        pct,
        state: (s > b.amount_cents ? 'over' : pct >= alertPct ? 'warning' : 'ok') as BudgetLine['state'],
      };
    });
  const totalBudget = sumCents(lines.map((l) => l.budgetCents));
  const totalSpent = sumCents(lines.map((l) => l.spentCents));
  return { lines, totalBudget, totalSpent, remaining: totalBudget - totalSpent };
}

export interface Upcoming {
  key: string;
  label: string;
  date: DayStr;
  amountCents: number;
  type: 'expense' | 'income';
  recurringId?: string;
  transactionId?: string;
}

/** Échéances à venir (récurrences non confirmées + transactions prévues) jusqu'à `until`. */
export function upcomingDues(recurring: RecurringTx[], txs: Transaction[], from: DayStr, until: DayStr): Upcoming[] {
  const settled = new Set(txs.filter((t) => t.recurring && t.due_key && t.status === 'confirmed').map((t) => `${t.recurring}|${t.due_key}`));
  const plannedRec = new Map(txs.filter((t) => t.recurring && t.due_key && t.status === 'planned').map((t) => [`${t.recurring}|${t.due_key}`, t]));
  const out: Upcoming[] = [];
  for (const r of recurring) {
    for (const d of recurringDueDates(r, from, until)) {
      const k = `${r.id}|${d}`;
      if (settled.has(k)) continue;
      const planned = plannedRec.get(k);
      out.push({ key: k, label: r.label, date: d, amountCents: planned?.amount_cents ?? r.amount_cents, type: r.type, recurringId: r.id, ...(planned ? { transactionId: planned.id } : {}) });
    }
  }
  for (const t of txs) {
    if (t.status !== 'planned' || t.recurring || t.date < from || t.date > until) continue;
    out.push({ key: `tx|${t.id}`, label: t.description, date: t.date, amountCents: t.amount_cents, type: t.type, transactionId: t.id });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Échéances passées non confirmées (en attente de confirmation par l'utilisatrice). */
export function overdueDues(recurring: RecurringTx[], txs: Transaction[], today: DayStr, lookbackDays = 60): Upcoming[] {
  return upcomingDues(recurring, txs, addDays(today, -lookbackDays), addDays(today, -1));
}

/** 3. Solde prévisionnel en fin de mois : enregistré + échéances à venir du mois. */
export function forecastBalance(recorded: number, upcoming: Upcoming[]): number {
  return recorded + sumCents(upcoming.map((u) => (u.type === 'income' ? u.amountCents : -u.amountCents)));
}

export function savingsTotal(contribs: SavingsContribution[], goalId?: string): number {
  return sumCents(contribs.filter((c) => !goalId || c.goal === goalId).map((c) => c.amount_cents));
}

export interface GoalProjection {
  savedCents: number;
  remainingCents: number;
  pct: number;
  /** Épargne mensuelle recommandée pour atteindre la date cible (arrondie au centime supérieur). */
  monthlyNeededCents: number | null;
  /** Date estimée d'atteinte, d'après la moyenne des 3 derniers mois. */
  estimatedDate: DayStr | null;
}

export function goalProjection(targetCents: number, targetDate: string, contribs: SavingsContribution[], today: DayStr): GoalProjection {
  const savedCents = savingsTotal(contribs);
  const remainingCents = Math.max(0, targetCents - savedCents);
  const pct = targetCents > 0 ? Math.min(100, (savedCents / targetCents) * 100) : 0;
  let monthlyNeededCents: number | null = null;
  if (targetDate && remainingCents > 0) {
    const months = Math.max(1, Math.ceil(diffDays(targetDate, today) / 30.4375));
    monthlyNeededCents = Math.ceil(remainingCents / months);
  }
  let estimatedDate: DayStr | null = null;
  const since = addDays(today, -90);
  const recent = sumCents(contribs.filter((c) => c.date >= since && c.date <= today).map((c) => c.amount_cents));
  if (remainingCents === 0) estimatedDate = today;
  else if (recent > 0) {
    const perDay = recent / 90;
    estimatedDate = addDays(today, Math.ceil(remainingCents / perDay));
  }
  return { savedCents, remainingCents, pct, monthlyNeededCents, estimatedDate };
}

/**
 * Suggestion de budget mensuel (mode mixte).
 * Répartit le revenu attendu : d'abord les dépenses obligatoires (essentielles),
 * basées sur la moyenne des 3 derniers mois ; ensuite l'épargne visée ;
 * le reste est réparti sur les autres catégories au prorata de leur historique.
 */
export function suggestBudgets(input: {
  expectedIncomeCents: number;
  categories: Array<{ id: string; essential: boolean }>;
  txs: Transaction[];
  month: string;
  savingsRatePct?: number;
}): Map<string, number> {
  const { expectedIncomeCents, categories, txs, month } = input;
  const savingsRate = input.savingsRatePct ?? 10;
  const start = `${month}-01`;
  const histFrom = addDays(start, -92);
  const histTo = addDays(start, -1);
  const hist = spendByCategory(txs, histFrom, histTo);
  const avg = (id: string) => Math.round((hist.get(id) ?? 0) / 3);

  const result = new Map<string, number>();
  let available = expectedIncomeCents;
  const essentials = categories.filter((c) => c.essential);
  const others = categories.filter((c) => !c.essential);

  // 1. Essentiel : moyenne historique (plafonnée au disponible).
  const essentialNeed = sumCents(essentials.map((c) => avg(c.id)));
  const essentialScale = essentialNeed > available && essentialNeed > 0 ? available / essentialNeed : 1;
  for (const c of essentials) {
    const v = Math.floor(avg(c.id) * essentialScale);
    result.set(c.id, v);
    available -= v;
  }
  // 2. Épargne visée.
  const savings = Math.max(0, Math.floor((expectedIncomeCents * savingsRate) / 100));
  available = Math.max(0, available - savings);
  // 3. Reste au prorata de l'historique (ou à parts égales sans historique).
  const otherHist = sumCents(others.map((c) => avg(c.id)));
  let distributed = 0;
  others.forEach((c, i) => {
    const share = otherHist > 0 ? Math.floor((available * avg(c.id)) / otherHist) : Math.floor(available / Math.max(1, others.length));
    const v = i === others.length - 1 ? Math.max(0, available - distributed) : share;
    distributed += v;
    result.set(c.id, v);
  });
  return result;
}

/** Totaux par mois (AAAA-MM) pour les graphiques. */
export function monthlySeries(txs: Transaction[], months: string[]): Array<{ month: string; incomeCents: number; expenseCents: number }> {
  return months.map((m) => {
    const from = `${m}-01`;
    const tot = periodTotals(txs, from, endOfMonth(from));
    return { month: m, incomeCents: tot.incomeCents, expenseCents: tot.expenseCents };
  });
}

export function lastMonths(today: DayStr, n: number): string[] {
  const out: string[] = [];
  let d = startOfMonth(today);
  for (let i = 0; i < n; i++) {
    out.unshift(monthKey(d));
    d = startOfMonth(addDays(d, -1));
  }
  return out;
}

/** Montant saisi (« 12,50 » ou « 12.5 ») → centimes, sans flottant. */
export function parseAmountToCents(input: string): number | null {
  const s = input.replace(/\s| /g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(',', '.');
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const units = Number(m[1]);
  const cents = Number((m[2] ?? '').padEnd(2, '0'));
  return units * 100 + cents;
}

/** Centimes → chaîne éditable « 12.50 ». */
export function centsToInput(cents: number): string {
  if (!cents) return '';
  return `${Math.trunc(cents / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;
}

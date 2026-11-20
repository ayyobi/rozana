import { describe, expect, it } from 'vitest';
import {
  budgetStatus, forecastBalance, goalProjection, parseAmountToCents, periodTotals, recordedBalance, suggestBudgets, sumCents, upcomingDues, centsToInput,
} from '@/lib/finance/compute';
import { formatCents } from '@/lib/finance/money';
import type { FinanceAccount, MonthlyBudget, RecurringTx, SavingsContribution, Transaction } from '@/types/models';

const base = { owner: 'u', created: '', updated: '' };
const tx = (o: Partial<Transaction>): Transaction => ({
  ...base, id: Math.random().toString(36).slice(2), account: 'a1', type: 'expense', amount_cents: 0, currency: 'EUR', category: '', date: '2026-11-10',
  payment_method: '', description: '', status: 'confirmed', recurring: '', due_key: '', transfer: '', ...o,
});
const acc: FinanceAccount = { ...base, id: 'a1', name: 'Courant', type: 'checking', currency: 'EUR', opening_balance_cents: 10000, archived: false };

describe('montants en centimes', () => {
  it('additionne sans erreur flottante (0,10 + 0,20 = 0,30)', () => {
    expect(sumCents([10, 20])).toBe(30);
    expect(sumCents(Array(1000).fill(1))).toBe(1000);
  });
  it('refuse un montant non entier', () => {
    expect(() => sumCents([12.5])).toThrow();
  });
  it('convertit la saisie en centimes', () => {
    expect(parseAmountToCents('12,5')).toBe(1250);
    expect(parseAmountToCents('0.07')).toBe(7);
    expect(parseAmountToCents('1 234,56')).toBe(123456);
    expect(parseAmountToCents('۱۲,۵۰')).toBe(1250);
    expect(parseAmountToCents('12,345')).toBeNull();
    expect(parseAmountToCents('-3')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(centsToInput(1250)).toBe('12.50');
  });
  it('formate pour l’affichage', () => {
    expect(formatCents(123456, 'EUR', 'fr').replace(/\s/g, ' ')).toBe('1 234,56 €');
    expect(formatCents(-5, 'EUR', 'fr').replace(/\s/g, ' ')).toBe('-0,05 €');
  });
});

describe('totaux et soldes', () => {
  const txs = [
    tx({ type: 'income', amount_cents: 150000, date: '2026-11-01' }),
    tx({ type: 'expense', amount_cents: 48000, date: '2026-11-02', category: 'logement' }),
    tx({ type: 'expense', amount_cents: 2399, date: '2026-11-05', category: 'alim' }),
    tx({ type: 'expense', amount_cents: 9999, date: '2026-11-20', status: 'planned' }),
    tx({ type: 'expense', amount_cents: 1000, date: '2026-10-31' }),
  ];
  it('ne compte que les transactions confirmées de la période', () => {
    expect(periodTotals(txs, '2026-11-01', '2026-11-30')).toEqual({ incomeCents: 150000, expenseCents: 50399, netCents: 99601 });
  });
  it('solde enregistré = ouverture + confirmées jusqu’à aujourd’hui', () => {
    expect(recordedBalance([acc], txs, '2026-11-16')).toBe(10000 + 150000 - 48000 - 2399 - 1000);
  });
  it('budget restant et alertes', () => {
    const budgets: MonthlyBudget[] = [
      { ...base, id: 'b1', month: '2026-11', category: 'logement', amount_cents: 50000, source: 'manual' },
      { ...base, id: 'b2', month: '2026-11', category: 'alim', amount_cents: 2000, source: 'manual' },
    ];
    const s = budgetStatus(budgets, txs, '2026-11', 80);
    expect(s.totalBudget).toBe(52000);
    expect(s.totalSpent).toBe(50399);
    expect(s.remaining).toBe(1601);
    expect(s.lines.find((l) => l.category === 'logement')?.state).toBe('warning'); // 96 %
    expect(s.lines.find((l) => l.category === 'alim')?.state).toBe('over');
  });
});

describe('récurrences', () => {
  const loyer: RecurringTx = { ...base, id: 'r1', label: 'Loyer', type: 'expense', amount_cents: 48000, currency: 'EUR', account: 'a1', category: '', frequency: 'monthly', interval: 1, start_date: '2026-01-05', end_date: '', reminder_days: 3, active: true };
  it('liste les échéances non confirmées sans doublon', () => {
    const paid = tx({ recurring: 'r1', due_key: '2026-11-05', amount_cents: 48000 });
    const up = upcomingDues([loyer], [paid], '2026-11-01', '2026-12-31');
    expect(up.map((u) => u.date)).toEqual(['2026-12-05']);
  });
  it('une échéance n’est jamais considérée comme payée automatiquement', () => {
    const up = upcomingDues([loyer], [], '2026-11-01', '2026-11-30');
    expect(up).toHaveLength(1);
    expect(forecastBalance(100000, up)).toBe(52000);
  });
  it('gère le 31 du mois', () => {
    const r = { ...loyer, start_date: '2026-01-31' };
    const up = upcomingDues([r], [], '2026-02-01', '2026-04-30');
    expect(up.map((u) => u.date)).toEqual(['2026-03-31']);
  });
});

describe('épargne', () => {
  it('projette un objectif', () => {
    const c: SavingsContribution[] = [
      { ...base, id: 'c1', goal: 'g', amount_cents: 30000, date: '2026-10-01', note: '' },
      { ...base, id: 'c2', goal: 'g', amount_cents: 30000, date: '2026-11-01', note: '' },
    ];
    const p = goalProjection(120000, '2027-05-16', c, '2026-11-16');
    expect(p.savedCents).toBe(60000);
    expect(p.remainingCents).toBe(60000);
    expect(p.pct).toBe(50);
    expect(p.monthlyNeededCents).toBe(10000);
    expect(p.estimatedDate).not.toBeNull();
  });
});

describe('suggestion de budget', () => {
  it('priorise l’essentiel et ne dépasse jamais le revenu', () => {
    const txs = [
      tx({ category: 'logement', amount_cents: 150000, date: '2026-10-05' }),
      tx({ category: 'loisirs', amount_cents: 30000, date: '2026-10-10' }),
    ];
    const s = suggestBudgets({ expectedIncomeCents: 150000, month: '2026-11', txs, categories: [{ id: 'logement', essential: true }, { id: 'loisirs', essential: false }] });
    const total = [...s.values()].reduce((a, b) => a + b, 0);
    expect(s.get('logement')).toBe(50000);
    expect(total).toBeLessThanOrEqual(150000);
    expect([...s.values()].every(Number.isInteger)).toBe(true);
  });
});

/**
 * ⚠️ DONNÉES D'APERÇU — PHASE 1 UNIQUEMENT
 * Utilisées seulement avec /dashboard?apercu=1, avec un bandeau visible
 * « Aperçu du design ». Elles ne sont jamais enregistrées ni mélangées aux vraies
 * données. Ce fichier sera supprimé en phase 3 quand le dashboard lira PocketBase.
 */
import type { DashboardData } from '@/types/dashboard';

const school = { name: 'École', color: 'var(--color-apricot)' };
const work = { name: 'Travail', color: 'var(--color-peach)' };
const perso = { name: 'Personnel', color: 'var(--color-coral-soft)' };

export function previewDashboard(todayIso: string): DashboardData {
  const [y, m] = todayIso.split('-');
  const d = (day: number) => `${y}-${m}-${String(day).padStart(2, '0')}`;
  return {
    priorities: [
      { id: 'p1', title: 'Rendre le dossier de SAE', category: school, priority: 'urgent', due: '14:00', done: false },
      { id: 'p2', title: 'Préparer la réunion d’équipe', category: work, priority: 'high', due: '17:30', done: false },
      { id: 'p3', title: 'Appeler la banque', category: perso, priority: 'normal', due: null, done: true },
    ],
    agenda: [
      { id: 'e1', title: 'Cours de base de données', kind: 'event', start: '09:00', end: '11:00', allDay: false, category: school },
      { id: 'e2', title: 'Rendre le dossier de SAE', kind: 'task', start: '14:00', end: null, allDay: false, category: school },
      { id: 'e3', title: 'Service au travail', kind: 'event', start: '18:00', end: '22:00', allDay: false, category: work },
    ],
    projects: [
      { id: 'pr1', name: 'SAE 3.01', color: 'var(--color-apricot)', done: 7, total: 10, deadline: '28 nov.' },
      { id: 'pr2', name: 'Portfolio', color: 'var(--color-coral)', done: 2, total: 8, deadline: null },
    ],
    habits: [
      { id: 'h1', name: 'Lire 20 min', emoji: '📖', color: 'var(--color-peach-soft)', done: true },
      { id: 'h2', name: 'Boire de l’eau', emoji: '💧', color: 'var(--color-apricot-soft)', done: false },
      { id: 'h3', name: 'Marcher', emoji: '🌿', color: '#e6ece1', done: false },
    ],
    finance: {
      currency: 'EUR',
      incomeCents: 145000,
      expenseCents: 62340,
      budgetLeftCents: 41660,
      savingsCents: 32000,
      nextDue: { label: 'Loyer', date: '1 déc.', amountCents: 48000 },
    },
    calendarDots: {
      [d(4)]: ['var(--color-apricot)'],
      [d(9)]: ['var(--color-coral)', 'var(--color-peach)'],
      [d(18)]: ['var(--color-apricot)'],
      [d(22)]: ['var(--color-peach)'],
      [d(28)]: ['var(--color-coral)'],
    },
  };
}

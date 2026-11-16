/** Formes de données attendues par les widgets du dashboard.
 *  En phase 3/4, des services PocketBase fourniront ces objets. */

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface CategoryRef {
  name: string;
  /** Couleur de fond pastel (CSS). */
  color: string;
}

export interface PriorityTask {
  id: string;
  title: string;
  category: CategoryRef | null;
  priority: Priority;
  /** Heure locale « HH:mm » ou date lisible déjà formatée. */
  due: string | null;
  done: boolean;
}

export interface AgendaItem {
  id: string;
  title: string;
  kind: 'event' | 'task';
  start: string; // « HH:mm »
  end: string | null;
  allDay: boolean;
  category: CategoryRef | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  color: string;
  done: number;
  total: number;
  deadline: string | null;
}

export interface HabitToday {
  id: string;
  name: string;
  emoji: string;
  color: string;
  done: boolean;
}

/** Montants en centimes (entiers). */
export interface FinanceSummary {
  currency: string;
  incomeCents: number;
  expenseCents: number;
  budgetLeftCents: number | null;
  savingsCents: number;
  nextDue: { label: string; date: string; amountCents: number } | null;
}

export interface DashboardData {
  priorities: PriorityTask[];
  agenda: AgendaItem[];
  projects: ProjectSummary[];
  habits: HabitToday[];
  finance: FinanceSummary | null;
  /** Jours (AAAA-MM-JJ) portant des éléments, avec leurs couleurs. */
  calendarDots: Record<string, string[]>;
}

export const EMPTY_DASHBOARD: DashboardData = {
  priorities: [],
  agenda: [],
  projects: [],
  habits: [],
  finance: null,
  calendarDots: {},
};

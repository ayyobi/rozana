/** Types des enregistrements PocketBase de Rozana (voir pb_migrations/1763310000_rozana_schema.js). */

export interface BaseRecord {
  id: string;
  owner: string;
  created: string;
  updated: string;
}

export type Locale = 'fr' | 'fa';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type ProjectStatus = 'todo' | 'in_progress' | 'done' | 'archived';

/** Règle de récurrence simple (planning). */
export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  /** Jours de la semaine (0 = lundi … 6 = dimanche) pour freq = weekly. */
  byweekday?: number[];
  until?: string; // AAAA-MM-JJ
  count?: number;
}

export interface Link {
  label: string;
  url: string;
}

export interface UserSettings extends BaseRecord {
  locale: Locale;
  timezone: string;
  currency: string;
  calendar: 'gregory' | 'persian' | '';
  ai_enabled: boolean;
  ai_consent_at: string;
  ai_finance_consent: boolean;
  budget_alert_pct: number;
  notify_tasks: boolean;
  notify_events: boolean;
  notify_habits: boolean;
  notify_finance: boolean;
  daily_summary: boolean;
  daily_summary_time: string;
  weekly_summary: boolean;
}

export interface Category extends BaseRecord {
  name: string;
  color: string;
  icon: string;
  sort: number;
}

export interface Task extends BaseRecord {
  title: string;
  description: string;
  category: string;
  project: string;
  section: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  estimate_min: number;
  reminder_min: number;
  recurrence: Recurrence | null;
  links: Link[] | null;
  notes: string;
  completed_at: string;
  sort: number;
}

export interface Subtask extends BaseRecord {
  task: string;
  title: string;
  done: boolean;
  sort: number;
}

export interface CalEvent extends BaseRecord {
  title: string;
  description: string;
  category: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  all_day: boolean;
  recurrence: Recurrence | null;
  exdates: string[] | null;
  reminder_min: number;
  color: string;
}

export interface Project extends BaseRecord {
  name: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  start_date: string;
  deadline: string;
  status: ProjectStatus;
  notes: string;
  links: Link[] | null;
}

export interface ProjectSection extends BaseRecord {
  project: string;
  name: string;
  sort: number;
}

export interface Habit extends BaseRecord {
  name: string;
  icon: string;
  color: string;
  description: string;
  frequency: 'daily' | 'days';
  days: number[] | null;
  reminder_time: string;
  target_qty: number;
  target_unit: string;
  archived: boolean;
  sort: number;
}

export interface HabitLog extends BaseRecord {
  habit: string;
  date: string;
  qty: number;
}

export type TxType = 'expense' | 'income';

export interface FinanceAccount extends BaseRecord {
  name: string;
  type: 'checking' | 'savings' | 'cash' | 'other';
  currency: string;
  opening_balance_cents: number;
  archived: boolean;
}

export interface FinanceCategory extends BaseRecord {
  name: string;
  kind: TxType;
  color: string;
  icon: string;
  essential: boolean;
  sort: number;
}

export interface Transaction extends BaseRecord {
  account: string;
  type: TxType;
  amount_cents: number;
  currency: string;
  category: string;
  date: string;
  payment_method: '' | 'card' | 'cash' | 'transfer' | 'direct_debit' | 'check' | 'other';
  description: string;
  status: 'confirmed' | 'planned';
  recurring: string;
  due_key: string;
  transfer: string;
}

export interface MonthlyBudget extends BaseRecord {
  month: string;
  category: string;
  amount_cents: number;
  source: '' | 'manual' | 'suggested';
}

export interface RecurringTx extends BaseRecord {
  label: string;
  type: TxType;
  amount_cents: number;
  currency: string;
  account: string;
  category: string;
  frequency: 'weekly' | 'monthly' | 'yearly' | 'days';
  interval: number;
  start_date: string;
  end_date: string;
  reminder_days: number;
  active: boolean;
}

export interface SavingsGoal extends BaseRecord {
  name: string;
  target_cents: number;
  currency: string;
  target_date: string;
  notes: string;
  color: string;
  archived: boolean;
}

export interface SavingsContribution extends BaseRecord {
  goal: string;
  amount_cents: number;
  date: string;
  note: string;
}

export interface MoneyTransfer extends BaseRecord {
  recipient: string;
  amount_cents: number;
  currency: string;
  fee_cents: number;
  rate: string;
  received_cents: number;
  received_currency: string;
  date: string;
  status: 'planned' | 'sent' | 'received' | 'cancelled';
  notes: string;
  transaction: string;
}

export interface DashboardWidget extends BaseRecord {
  widget: string;
  visible: boolean;
  order: number;
  size: 'sm' | 'md' | 'lg' | 'full';
}

export interface AiConversation extends BaseRecord {
  title: string;
  archived: boolean;
}

export interface AiMessage extends BaseRecord {
  conversation: string;
  role: 'user' | 'assistant';
  content: string;
  actions: AiAction[] | null;
  tokens_in: number;
  tokens_out: number;
}

/** Action proposée par l'assistant, exécutée seulement après confirmation. */
export type AiAction =
  | { type: 'create_task'; title: string; start_date?: string; start_time?: string; deadline?: string; priority?: Priority; status?: 'pending' | 'done' | 'rejected' }
  | { type: 'create_event'; title: string; start_date: string; start_time?: string; end_date?: string; end_time?: string; status?: 'pending' | 'done' | 'rejected' };

export interface CollectionMap {
  user_settings: UserSettings;
  categories: Category;
  tasks: Task;
  subtasks: Subtask;
  events: CalEvent;
  projects: Project;
  project_sections: ProjectSection;
  habits: Habit;
  habit_logs: HabitLog;
  finance_accounts: FinanceAccount;
  finance_categories: FinanceCategory;
  transactions: Transaction;
  monthly_budgets: MonthlyBudget;
  recurring_transactions: RecurringTx;
  savings_goals: SavingsGoal;
  savings_contributions: SavingsContribution;
  money_transfers: MoneyTransfer;
  dashboard_widgets: DashboardWidget;
  ai_conversations: AiConversation;
  ai_messages: AiMessage;
}
export type CollectionName = keyof CollectionMap;

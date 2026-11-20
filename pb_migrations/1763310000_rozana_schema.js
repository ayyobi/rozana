/// <reference path="../pb_data/types.d.ts" />
/**
 * Rozana — schéma complet des données.
 *
 * Conventions :
 *  - chaque collection privée a un champ `owner` (relation users, cascade) ;
 *  - règles : seule la propriétaire lit/modifie ses enregistrements, et ne peut
 *    ni créer pour quelqu'un d'autre ni changer de propriétaire ;
 *  - montants en centimes entiers ; dates locales « AAAA-MM-JJ » et heures « HH:mm »
 *    (interprétées dans le fuseau de user_settings).
 */

const DATE_RE = '^\\d{4}-\\d{2}-\\d{2}$';
const TIME_RE = '^([01]\\d|2[0-3]):[0-5]\\d$';
const MONTH_RE = '^\\d{4}-\\d{2}$';
const COLOR_RE = '^(#[0-9a-fA-F]{6}|var\\(--[a-z0-9-]+\\))$';

const OWN = 'owner = @request.auth.id';
const CREATE = '@request.auth.id != "" && @request.body.owner = @request.auth.id';
const UPDATE = OWN + ' && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)';

/** Règle : une relation facultative doit appartenir à la même propriétaire. */
function ownedRel(field) {
  return ` && (@request.body.${field}:isset = false || @request.body.${field} = "" || @request.body.${field}.owner = @request.auth.id)`;
}

const f = {
  text: (name, o = {}) => ({ name, type: 'text', required: !!o.required, max: o.max ?? 500, min: o.min ?? 0, pattern: o.pattern ?? '' }),
  long: (name, o = {}) => ({ name, type: 'text', required: !!o.required, max: o.max ?? 20000 }),
  date: (name, o = {}) => ({ name, type: 'text', required: !!o.required, max: 10, pattern: DATE_RE }),
  time: (name) => ({ name, type: 'text', max: 5, pattern: TIME_RE }),
  month: (name, o = {}) => ({ name, type: 'text', required: !!o.required, max: 7, pattern: MONTH_RE }),
  color: (name) => ({ name, type: 'text', max: 40, pattern: COLOR_RE }),
  int: (name, o = {}) => ({ name, type: 'number', required: !!o.required, onlyInt: true, min: o.min ?? null, max: o.max ?? null }),
  bool: (name) => ({ name, type: 'bool' }),
  select: (name, values, o = {}) => ({ name, type: 'select', required: !!o.required, maxSelect: 1, values }),
  json: (name) => ({ name, type: 'json', maxSize: o_json }),
  datetime: (name, o = {}) => ({ name, type: 'date', required: !!o.required }),
  rel: (name, collectionId, o = {}) => ({
    name,
    type: 'relation',
    required: !!o.required,
    collectionId,
    cascadeDelete: !!o.cascade,
    maxSelect: 1,
    minSelect: 0,
  }),
};
const o_json = 200000;

function autodates() {
  return [
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ];
}

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;

    /** Crée une collection privée avec owner + règles standard. */
    function make(name, fields, opts = {}) {
      const rels = opts.ownedRels ?? [];
      const relRule = rels.map(ownedRel).join('');
      const col = new Collection({
        type: 'base',
        name,
        listRule: OWN,
        viewRule: OWN,
        createRule: CREATE + relRule,
        updateRule: UPDATE + relRule,
        deleteRule: OWN,
        fields: [f.rel('owner', usersId, { required: true, cascade: true }), ...fields, ...autodates()],
        indexes: [`CREATE INDEX idx_${name}_owner ON ${name} (owner)`, ...(opts.indexes ?? [])],
      });
      app.save(col);
      return col.id;
    }

    // ── Réglages ─────────────────────────────────────────
    make(
      'user_settings',
      [
        f.select('locale', ['fr', 'fa'], { required: true }),
        f.text('timezone', { required: true, max: 64 }),
        f.text('currency', { required: true, max: 3, min: 3, pattern: '^[A-Z]{3}$' }),
        f.select('calendar', ['gregory', 'persian']),
        f.bool('ai_enabled'),
        f.datetime('ai_consent_at'),
        f.bool('ai_finance_consent'),
        f.int('budget_alert_pct', { min: 1, max: 100 }),
        f.bool('notify_tasks'),
        f.bool('notify_events'),
        f.bool('notify_habits'),
        f.bool('notify_finance'),
        f.bool('daily_summary'),
        f.time('daily_summary_time'),
        f.bool('weekly_summary'),
      ],
      { indexes: ['CREATE UNIQUE INDEX idx_user_settings_owner_u ON user_settings (owner)'] },
    );

    // ── Planning ─────────────────────────────────────────
    const categories = make(
      'categories',
      [
        f.text('name', { required: true, max: 60 }),
        f.color('color'),
        f.text('icon', { max: 40 }),
        f.int('sort'),
      ],
    );

    const projects = make(
      'projects',
      [
        f.text('name', { required: true, max: 120 }),
        f.long('description'),
        f.rel('category', categories),
        f.color('color'),
        f.text('icon', { max: 16 }),
        f.date('start_date'),
        f.date('deadline'),
        f.select('status', ['todo', 'in_progress', 'done', 'archived'], { required: true }),
        f.long('notes'),
        f.json('links'),
      ],
      { ownedRels: ['category'], indexes: ['CREATE INDEX idx_projects_status ON projects (owner, status)'] },
    );

    const sections = make(
      'project_sections',
      [f.rel('project', projects, { required: true, cascade: true }), f.text('name', { required: true, max: 80 }), f.int('sort')],
      { ownedRels: ['project'], indexes: ['CREATE INDEX idx_sections_project ON project_sections (project)'] },
    );

    const tasks = make(
      'tasks',
      [
        f.text('title', { required: true, max: 200 }),
        f.long('description'),
        f.rel('category', categories),
        f.rel('project', projects),
        f.rel('section', sections),
        f.date('start_date'),
        f.time('start_time'),
        f.date('end_date'),
        f.time('end_time'),
        f.date('deadline'),
        f.select('priority', ['low', 'normal', 'high', 'urgent'], { required: true }),
        f.select('status', ['todo', 'in_progress', 'done', 'cancelled'], { required: true }),
        f.int('estimate_min', { min: 0, max: 100000 }),
        f.int('reminder_min', { min: 0, max: 100000 }),
        f.json('recurrence'),
        f.json('links'),
        f.long('notes'),
        f.datetime('completed_at'),
        f.int('sort'),
      ],
      {
        ownedRels: ['category', 'project', 'section'],
        indexes: [
          'CREATE INDEX idx_tasks_status ON tasks (owner, status)',
          'CREATE INDEX idx_tasks_deadline ON tasks (owner, deadline)',
          'CREATE INDEX idx_tasks_project ON tasks (project)',
        ],
      },
    );

    make(
      'subtasks',
      [f.rel('task', tasks, { required: true, cascade: true }), f.text('title', { required: true, max: 200 }), f.bool('done'), f.int('sort')],
      { ownedRels: ['task'], indexes: ['CREATE INDEX idx_subtasks_task ON subtasks (task)'] },
    );

    make(
      'events',
      [
        f.text('title', { required: true, max: 200 }),
        f.long('description'),
        f.rel('category', categories),
        f.date('start_date', { required: true }),
        f.time('start_time'),
        f.date('end_date', { required: true }),
        f.time('end_time'),
        f.bool('all_day'),
        f.json('recurrence'),
        f.json('exdates'),
        f.int('reminder_min', { min: 0, max: 100000 }),
        f.color('color'),
      ],
      { ownedRels: ['category'], indexes: ['CREATE INDEX idx_events_start ON events (owner, start_date)'] },
    );

    // ── Habitudes ────────────────────────────────────────
    const habits = make('habits', [
      f.text('name', { required: true, max: 80 }),
      f.text('icon', { max: 16 }),
      f.color('color'),
      f.long('description'),
      f.select('frequency', ['daily', 'days'], { required: true }),
      f.json('days'),
      f.time('reminder_time'),
      f.int('target_qty', { min: 0, max: 100000 }),
      f.text('target_unit', { max: 20 }),
      f.bool('archived'),
      f.int('sort'),
    ]);

    make(
      'habit_logs',
      [f.rel('habit', habits, { required: true, cascade: true }), f.date('date', { required: true }), f.int('qty', { min: 0, max: 100000 })],
      { ownedRels: ['habit'], indexes: ['CREATE UNIQUE INDEX idx_habit_logs_u ON habit_logs (habit, date)'] },
    );

    // ── Finances ─────────────────────────────────────────
    const accounts = make('finance_accounts', [
      f.text('name', { required: true, max: 60 }),
      f.select('type', ['checking', 'savings', 'cash', 'other'], { required: true }),
      f.text('currency', { required: true, max: 3, pattern: '^[A-Z]{3}$' }),
      f.int('opening_balance_cents'),
      f.bool('archived'),
    ]);

    const fcats = make('finance_categories', [
      f.text('name', { required: true, max: 60 }),
      f.select('kind', ['expense', 'income'], { required: true }),
      f.color('color'),
      f.text('icon', { max: 16 }),
      f.bool('essential'),
      f.int('sort'),
    ]);

    const recurring = make(
      'recurring_transactions',
      [
        f.text('label', { required: true, max: 120 }),
        f.select('type', ['expense', 'income'], { required: true }),
        f.int('amount_cents', { required: true, min: 1 }),
        f.text('currency', { required: true, max: 3, pattern: '^[A-Z]{3}$' }),
        f.rel('account', accounts),
        f.rel('category', fcats),
        f.select('frequency', ['weekly', 'monthly', 'yearly', 'days'], { required: true }),
        f.int('interval', { min: 1, max: 365 }),
        f.date('start_date', { required: true }),
        f.date('end_date'),
        f.int('reminder_days', { min: 0, max: 60 }),
        f.bool('active'),
      ],
      { ownedRels: ['account', 'category'] },
    );

    const transactions = make(
      'transactions',
      [
        f.rel('account', accounts),
        f.select('type', ['expense', 'income'], { required: true }),
        f.int('amount_cents', { required: true, min: 1 }),
        f.text('currency', { required: true, max: 3, pattern: '^[A-Z]{3}$' }),
        f.rel('category', fcats),
        f.date('date', { required: true }),
        f.select('payment_method', ['card', 'cash', 'transfer', 'direct_debit', 'check', 'other']),
        f.text('description', { max: 300 }),
        f.select('status', ['confirmed', 'planned'], { required: true }),
        f.rel('recurring', recurring),
        f.date('due_key'),
        f.text('transfer', { max: 15 }),
      ],
      {
        ownedRels: ['account', 'category', 'recurring'],
        indexes: [
          'CREATE INDEX idx_tx_date ON transactions (owner, date)',
          "CREATE UNIQUE INDEX idx_tx_recurring_due ON transactions (recurring, due_key) WHERE recurring != '' AND due_key != ''",
        ],
      },
    );

    make(
      'monthly_budgets',
      [
        f.month('month', { required: true }),
        f.rel('category', fcats, { required: true, cascade: true }),
        f.int('amount_cents', { required: true, min: 0 }),
        f.select('source', ['manual', 'suggested']),
      ],
      { ownedRels: ['category'], indexes: ['CREATE UNIQUE INDEX idx_budget_u ON monthly_budgets (owner, month, category)'] },
    );

    const goals = make('savings_goals', [
      f.text('name', { required: true, max: 80 }),
      f.int('target_cents', { required: true, min: 1 }),
      f.text('currency', { required: true, max: 3, pattern: '^[A-Z]{3}$' }),
      f.date('target_date'),
      f.long('notes'),
      f.color('color'),
      f.bool('archived'),
    ]);

    make(
      'savings_contributions',
      [
        f.rel('goal', goals, { required: true, cascade: true }),
        f.int('amount_cents', { required: true }),
        f.date('date', { required: true }),
        f.text('note', { max: 200 }),
      ],
      { ownedRels: ['goal'], indexes: ['CREATE INDEX idx_contrib_goal ON savings_contributions (goal, date)'] },
    );

    make(
      'money_transfers',
      [
        f.text('recipient', { required: true, max: 120 }),
        f.int('amount_cents', { required: true, min: 1 }),
        f.text('currency', { required: true, max: 3, pattern: '^[A-Z]{3}$' }),
        f.int('fee_cents', { min: 0 }),
        f.text('rate', { max: 20, pattern: '^\\d+(\\.\\d+)?$' }),
        f.int('received_cents', { min: 0 }),
        f.text('received_currency', { max: 3, pattern: '^([A-Z]{3})?$' }),
        f.date('date', { required: true }),
        f.select('status', ['planned', 'sent', 'received', 'cancelled'], { required: true }),
        f.long('notes'),
        f.rel('transaction', transactions),
      ],
      { ownedRels: ['transaction'], indexes: ['CREATE INDEX idx_transfers_date ON money_transfers (owner, date)'] },
    );

    // ── Notifications ────────────────────────────────────
    make(
      'reminders',
      [
        f.text('dedupe_key', { required: true, max: 200 }),
        f.text('target_type', { max: 30 }),
        f.text('target_id', { max: 30 }),
        f.text('title', { max: 200 }),
        f.datetime('sent_at'),
        f.select('status', ['sent', 'failed']),
      ],
      { indexes: ['CREATE UNIQUE INDEX idx_reminders_dedupe ON reminders (owner, dedupe_key)'] },
    );

    make(
      'push_subscriptions',
      [
        f.text('endpoint', { required: true, max: 1000 }),
        f.text('p256dh', { required: true, max: 300 }),
        f.text('auth', { required: true, max: 100 }),
        f.text('user_agent', { max: 300 }),
        f.int('failures', { min: 0 }),
        f.datetime('last_success_at'),
      ],
      { indexes: ['CREATE UNIQUE INDEX idx_push_endpoint ON push_subscriptions (endpoint)'] },
    );

    // ── Dashboard ────────────────────────────────────────
    make(
      'dashboard_widgets',
      [
        f.text('widget', { required: true, max: 30 }),
        f.bool('visible'),
        f.int('order'),
        f.select('size', ['sm', 'md', 'lg', 'full']),
      ],
      { indexes: ['CREATE UNIQUE INDEX idx_widgets_u ON dashboard_widgets (owner, widget)'] },
    );

    // ── Assistant IA ─────────────────────────────────────
    const convs = make('ai_conversations', [f.text('title', { max: 120 }), f.bool('archived')]);
    make(
      'ai_messages',
      [
        f.rel('conversation', convs, { required: true, cascade: true }),
        f.select('role', ['user', 'assistant'], { required: true }),
        f.long('content', { max: 50000 }),
        f.json('actions'),
        f.int('tokens_in', { min: 0 }),
        f.int('tokens_out', { min: 0 }),
      ],
      { ownedRels: ['conversation'], indexes: ['CREATE INDEX idx_ai_msgs_conv ON ai_messages (conversation)'] },
    );
  },
  (app) => {
    const names = [
      'ai_messages', 'ai_conversations', 'dashboard_widgets', 'push_subscriptions', 'reminders',
      'money_transfers', 'savings_contributions', 'savings_goals', 'monthly_budgets', 'transactions',
      'recurring_transactions', 'finance_categories', 'finance_accounts', 'habit_logs', 'habits',
      'events', 'subtasks', 'tasks', 'project_sections', 'projects', 'categories', 'user_settings',
    ];
    for (const n of names) {
      try {
        app.delete(app.findCollectionByNameOrId(n));
      } catch (_) {}
    }
  },
);

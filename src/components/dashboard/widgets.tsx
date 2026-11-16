import { useState, type ReactNode } from 'react';
import { ArrowRight, CalendarClock, Clock, Flag, FolderHeart, Leaf, Wallet } from 'lucide-react';
import { Badge, Card, EmptyState, Progress, RoundCheckbox } from '@/components/ui/primitives';
import { Coins, Cup, Folder, Sprout, Sunrise } from '@/components/ui/illustrations';
import { useTranslations, type Locale } from '@/i18n';
import { formatCents } from '@/lib/finance/money';
import { cn } from '@/lib/utils/cn';
import type {
  AgendaItem,
  FinanceSummary,
  HabitToday,
  Priority,
  PriorityTask,
  ProjectSummary,
} from '@/types/dashboard';

type T = ReturnType<typeof useTranslations>;

/* ── Cadre commun ─────────────────────────────── */
export function WidgetFrame({
  title,
  icon,
  href,
  t,
  tone = 'surface',
  className,
  children,
}: {
  title: string;
  icon: ReactNode;
  href?: string;
  t: T;
  tone?: 'surface' | 'peach' | 'apricot' | 'coral' | 'sage';
  className?: string;
  children: ReactNode;
}) {
  const id = `w-${title.replace(/\s+/g, '-')}`;
  return (
    <Card tone={tone} className={cn('flex animate-fade-up flex-col p-5', className)} aria-labelledby={id}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-xl bg-white/60" aria-hidden>
            {icon}
          </span>
          {title}
        </h2>
        {href && (
          <a href={href} className="inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-sm font-medium text-coral-strong hover:bg-white/50">
            {t('widgets.seeAll')}
            <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
          </a>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

const priorityTone: Record<Priority, 'neutral' | 'sage' | 'apricot' | 'danger'> = {
  low: 'sage',
  normal: 'neutral',
  high: 'apricot',
  urgent: 'danger',
};

/* ── Mes priorités ────────────────────────────── */
export function PrioritiesWidget({ items, t, interactive }: { items: PriorityTask[]; t: T; interactive: boolean }) {
  const [state, setState] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.done])));
  return (
    <WidgetFrame title={t('widgets.priorities.title')} icon={<Flag className="size-4" />} href="/taches" t={t} className="h-full">
      {items.length === 0 ? (
        <EmptyState compact illustration={<Sunrise />} title={t('widgets.priorities.empty')} hint={t('widgets.priorities.emptyHint')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.slice(0, 3).map((task) => {
            const done = state[task.id] ?? task.done;
            return (
              <li key={task.id} className="flex items-center gap-3 rounded-2xl bg-white/55 px-3.5 py-3">
                <RoundCheckbox
                  checked={done}
                  disabled={!interactive}
                  label={task.title}
                  onChange={(v) => setState((s) => ({ ...s, [task.id]: v }))}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate font-medium transition-colors', done && 'text-ink-2 line-through decoration-coral-strong/60')}>{task.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {task.category && (
                      <Badge style={{ background: task.category.color }}>{task.category.name}</Badge>
                    )}
                    <Badge tone={priorityTone[task.priority]}>{t(`priority.${task.priority}`)}</Badge>
                  </div>
                </div>
                {task.due && (
                  <span className="flex shrink-0 items-center gap-1 text-sm text-ink-2">
                    <Clock className="size-3.5" aria-hidden />
                    <time>{task.due}</time>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
}

/* ── Mon planning ─────────────────────────────── */
export function AgendaWidget({ items, t }: { items: AgendaItem[]; t: T }) {
  return (
    <WidgetFrame title={t('widgets.planning.title')} icon={<CalendarClock className="size-4" />} href="/planning/jour" t={t} tone="apricot" className="h-full">
      {items.length === 0 ? (
        <EmptyState compact illustration={<Cup />} title={t('widgets.planning.empty')} hint={t('widgets.planning.emptyHint')} />
      ) : (
        <ol className="relative flex flex-col gap-3 ps-4 before:absolute before:inset-y-2 before:start-[5px] before:w-px before:bg-ink/15">
          {items.map((it) => (
            <li key={it.id} className="relative">
              <span
                className={cn(
                  'absolute -start-4 top-1.5 size-2.5 rounded-full ring-4 ring-apricot-soft',
                  it.kind === 'task' ? 'rounded-[3px] bg-coral-strong' : 'bg-ink',
                )}
                aria-hidden
              />
              <p className="text-sm text-ink-2">
                <time>{it.allDay ? t('agenda.allDay') : it.end ? `${it.start} – ${it.end}` : it.start}</time>
                <span className="sr-only"> · {t(it.kind === 'task' ? 'agenda.task' : 'agenda.event')}</span>
              </p>
              <p className="flex items-center gap-2 font-medium">
                {it.title}
                {it.kind === 'task' && <Badge tone="coral">{t('agenda.task')}</Badge>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </WidgetFrame>
  );
}

/* ── Mes projets ──────────────────────────────── */
export function ProjectsWidget({ items, t }: { items: ProjectSummary[]; t: T }) {
  return (
    <WidgetFrame title={t('widgets.projects.title')} icon={<FolderHeart className="size-4" />} href="/projets" t={t} className="h-full">
      {items.length === 0 ? (
        <EmptyState compact illustration={<Folder />} title={t('widgets.projects.empty')} hint={t('widgets.projects.emptyHint')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((p) => {
            const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <li key={p.id} className="rounded-2xl bg-white/55 p-3.5">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
                    {p.name}
                  </p>
                  <span className="text-sm font-semibold tabular-nums">{pct}%</span>
                </div>
                <Progress value={pct} label={p.name} />
                <p className="mt-2 text-xs text-ink-2">
                  {t('widgets.projects.count', { done: p.done, total: p.total })}
                  {p.deadline && ` · ${t('widgets.projects.deadline', { date: p.deadline })}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
}

/* ── Mes habitudes ────────────────────────────── */
export function HabitsWidget({ items, t, interactive }: { items: HabitToday[]; t: T; interactive: boolean }) {
  const [state, setState] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.done])));
  return (
    <WidgetFrame title={t('widgets.habits.title')} icon={<Leaf className="size-4" />} href="/habitudes" t={t} tone="sage" className="h-full">
      {items.length === 0 ? (
        <EmptyState compact illustration={<Sprout />} title={t('widgets.habits.empty')} hint={t('widgets.habits.emptyHint')} />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {items.map((h) => {
            const done = state[h.id] ?? h.done;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  disabled={!interactive}
                  onClick={() => setState((s) => ({ ...s, [h.id]: !done }))}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-start transition-all duration-200 ease-soft',
                    done ? 'border-sage-strong/40 bg-white/80' : 'border-transparent bg-white/50 hover:bg-white/70',
                  )}
                >
                  <span className="grid size-9 place-items-center rounded-xl text-lg" style={{ background: h.color }} aria-hidden>
                    {h.emoji}
                  </span>
                  <span className="flex-1 text-sm font-medium">{h.name}</span>
                  <span
                    className={cn('size-5 rounded-full border-2 transition-colors', done ? 'border-sage-strong bg-sage-strong' : 'border-ink-2/40')}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
}

/* ── Mes finances ─────────────────────────────── */
export function FinanceWidget({ data, t, locale }: { data: FinanceSummary | null; t: T; locale: Locale }) {
  const fmt = (c: number) => (data ? formatCents(c, data.currency, locale) : t('widgets.finances.noData'));
  const rows: Array<{ label: string; value: string; tone?: string }> = [
    { label: t('widgets.finances.income'), value: data ? fmt(data.incomeCents) : '—', tone: 'text-sage-strong' },
    { label: t('widgets.finances.expenses'), value: data ? fmt(data.expenseCents) : '—' },
    { label: t('widgets.finances.budgetLeft'), value: data && data.budgetLeftCents !== null ? fmt(data.budgetLeftCents) : '—' },
    { label: t('widgets.finances.savings'), value: data ? fmt(data.savingsCents) : '—' },
  ];
  return (
    <WidgetFrame title={t('widgets.finances.title')} icon={<Wallet className="size-4" />} href="/finances" t={t} tone="peach" className="h-full">
      <dl className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-2xl bg-white/55 p-3">
            <dt className="text-xs text-ink-2">{r.label}</dt>
            <dd className={cn('mt-0.5 font-display text-lg font-semibold tabular-nums', r.tone)}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {data?.nextDue ? (
        <p className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/40 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="text-ink-2">{t('widgets.finances.nextDue')} · </span>
            <span className="font-medium">{data.nextDue.label}</span> <span className="text-ink-2">({data.nextDue.date})</span>
          </span>
          <span className="font-semibold tabular-nums">{fmt(data.nextDue.amountCents)}</span>
        </p>
      ) : (
        !data && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/40 px-3 py-2">
            <span className="w-10 shrink-0 text-coral-strong/80" aria-hidden>
              <Coins />
            </span>
            <p className="text-sm text-ink-2">{t('widgets.finances.emptyHint')}</p>
          </div>
        )
      )}
    </WidgetFrame>
  );
}


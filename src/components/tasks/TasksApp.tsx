import { useMemo, useState } from 'react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { Sunrise } from '@/components/ui/illustrations';
import { PageHeader, Segmented, Select } from '@/components/ui/forms';
import { Button } from '@/components/ui/Button';
import { TaskItem } from './TaskItem';
import { useTaskActions } from './useTaskActions';
import { type Locale, type TranslationKey } from '@/i18n';
import { useList } from '@/hooks/useList';
import { usePlanningRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord } from '@/lib/pocketbase/client';
import { PRIORITY_RANK, isOverdue, isToday, isUpcoming, smartCompare } from '@/lib/planning/tasks';
import type { Task } from '@/types/models';

type Tab = 'today' | 'upcoming' | 'overdue' | 'all' | 'done';
type Sort = 'smart' | 'deadline' | 'priority' | 'created' | 'title';

export default function TasksApp({ locale, today, initialTab = 'today' }: { locale: Locale; today: string; initialTab?: Tab }) {
  const actions = useTaskActions(locale, today);
  const { t } = actions;
  const run = useAction(t);
  const refs = usePlanningRefs();
  const tasks = useList('tasks', { sort: '-created' });
  const subtasks = useList('subtasks', {});
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [project, setProject] = useState('');
  const [sort, setSort] = useState<Sort>('smart');
  const [showFilters, setShowFilters] = useState(false);
  const [quick, setQuick] = useState('');

  const subCounts = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const s of subtasks.items) {
      const c = m.get(s.task) ?? { done: 0, total: 0 };
      c.total++;
      if (s.done) c.done++;
      m.set(s.task, c);
    }
    return m;
  }, [subtasks.items]);

  const counts = useMemo(() => {
    const all = tasks.items;
    return {
      today: all.filter((x) => isToday(x, today)).length,
      upcoming: all.filter((x) => isUpcoming(x, today)).length,
      overdue: all.filter((x) => isOverdue(x, today)).length,
      all: all.filter((x) => x.status === 'todo' || x.status === 'in_progress').length,
      done: all.filter((x) => x.status === 'done' || x.status === 'cancelled').length,
    };
  }, [tasks.items, today]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const byTab: Record<Tab, (x: Task) => boolean> = {
      today: (x) => isToday(x, today) || isOverdue(x, today),
      upcoming: (x) => isUpcoming(x, today),
      overdue: (x) => isOverdue(x, today),
      all: (x) => x.status === 'todo' || x.status === 'in_progress',
      done: (x) => x.status === 'done' || x.status === 'cancelled',
    };
    const list = tasks.items.filter(
      (x) =>
        byTab[tab](x) &&
        (!q || x.title.toLocaleLowerCase().includes(q) || x.description.toLocaleLowerCase().includes(q) || x.notes.toLocaleLowerCase().includes(q)) &&
        (!category || x.category === category) &&
        (!priority || x.priority === priority) &&
        (!project || (project === '-' ? !x.project : x.project === project)),
    );
    const cmp: Record<Sort, (a: Task, b: Task) => number> = {
      smart: smartCompare(today),
      deadline: (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'),
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      created: (a, b) => b.created.localeCompare(a.created),
      title: (a, b) => a.title.localeCompare(b.title, locale),
    };
    const sorter = tab === 'done' && sort === 'smart' ? (a: Task, b: Task) => (b.completed_at || b.updated).localeCompare(a.completed_at || a.updated) : cmp[sort];
    return list.sort(sorter);
  }, [tasks.items, tab, query, category, priority, project, sort, today, locale]);

  async function quickAdd() {
    const title = quick.trim();
    if (!title) return;
    setQuick('');
    await run(
      () => createRecord('tasks', { title, priority: 'normal', status: 'todo', start_date: tab === 'today' ? today : '' }),
      'feedback.created',
    );
  }

  const filtered = !!(query || category || priority || project);
  const tabs: Array<{ value: Tab; label: string }> = (['today', 'upcoming', 'overdue', 'all', 'done'] as const).map((v) => ({
    value: v,
    label: `${t(`tasks.tabs.${v}`)}${counts[v] ? ` · ${counts[v]}` : ''}`,
  }));

  return (
    <>
      <PageHeader
        title={t('tasks.title')}
        actions={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => actions.create({ start_date: tab === 'today' ? today : '' })}>
            {t('tasks.new')}
          </Button>
        }
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1">
        <Segmented label={t('tasks.title')} value={tab} onChange={setTab} options={tabs} />
      </div>

      <Card className="mb-4 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void quickAdd();
          }}
          className="flex gap-2"
        >
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder={t('tasks.quickPlaceholder')}
            aria-label={t('tasks.new')}
            maxLength={200}
            className="h-11 min-w-0 flex-1 rounded-field bg-white/70 px-4 outline-none focus:shadow-[0_0_0_3px_rgb(217_164_127/0.35)]"
          />
          <Button type="submit" size="icon" aria-label={t('actions.add')}>
            <Plus className="size-5" aria-hidden />
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('actions.search')}
              aria-label={t('actions.search')}
              className="h-10 w-full rounded-pill bg-white/60 ps-9 pe-4 text-sm outline-none focus:shadow-[0_0_0_3px_rgb(217_164_127/0.35)]"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-white/60 px-4 text-sm font-medium hover:bg-white"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {t('actions.filter')}
            {filtered && <span className="size-2 rounded-full bg-coral-strong" aria-hidden />}
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Select label={t('fields.category')} value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: t('actions.all') }, ...refs.categories.map((c) => ({ value: c.id, label: c.name }))]} />
            <Select
              label={t('fields.priority')}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[{ value: '', label: t('actions.all') }, ...(['urgent', 'high', 'normal', 'low'] as const).map((p) => ({ value: p, label: t(`priority.${p}`) }))]}
            />
            <Select
              label={t('fields.project')}
              value={project}
              onChange={(e) => setProject(e.target.value)}
              options={[{ value: '', label: t('actions.all') }, { value: '-', label: t('fields.noProject') }, ...refs.projects.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Select
              label={t('actions.sort')}
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              options={(['smart', 'deadline', 'priority', 'created', 'title'] as const).map((s) => ({ value: s, label: t(`tasks.sort.${s}`) }))}
            />
          </div>
        )}
      </Card>

      {tasks.loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            illustration={<Sunrise />}
            title={filtered ? t('tasks.empty.filtered') : t(`tasks.empty.${tab}` as TranslationKey)}
            hint={filtered ? undefined : t('tasks.empty.hint')}
          />
        </Card>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-2" aria-live="polite">
            {t('tasks.count', { n: visible.length })}
          </p>
          <ul className="flex flex-col gap-2">
            {visible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                today={today}
                locale={locale}
                t={t}
                category={refs.catById.get(task.category)}
                project={refs.projectById.get(task.project)}
                subCount={subCounts.get(task.id)}
                onToggle={(d) => void actions.toggle(task, d)}
                onEdit={() => actions.edit(task)}
                onDuplicate={() => void actions.duplicate(task)}
                onPostpone={(m) => actions.postpone(task, m)}
                onDelete={() => actions.remove(task)}
              />
            ))}
          </ul>
        </>
      )}
      {actions.elements}
    </>
  );
}

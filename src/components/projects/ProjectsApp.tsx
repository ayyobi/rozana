import { useMemo, useState, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Card, EmptyState, Progress, Skeleton } from '@/components/ui/primitives';
import { Folder } from '@/components/ui/illustrations';
import { PageHeader, Segmented, Toggle } from '@/components/ui/forms';
import { ProjectForm } from '@/components/forms/ProjectForm';
import { useTranslations, type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { useAction } from '@/hooks/useAction';
import { updateRecord } from '@/lib/pocketbase/client';
import { fmtDay } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Project, ProjectStatus, Task } from '@/types/models';

type View = 'cards' | 'list' | 'kanban';

export function projectProgress(tasks: Task[]) {
  const relevant = tasks.filter((t) => t.status !== 'cancelled');
  const done = relevant.filter((t) => t.status === 'done').length;
  return { done, total: relevant.length, pct: relevant.length ? Math.round((done / relevant.length) * 100) : 0 };
}

export default function ProjectsApp({ locale, today }: { locale: Locale; today: string }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const projects = useList('projects', { sort: 'deadline,name' });
  const tasks = useList('tasks', { filter: 'project != ""' });
  const [view, setView] = useState<View>(() => (typeof localStorage !== 'undefined' ? ((localStorage.getItem('rozana:projectsView') as View) || 'cards') : 'cards'));
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const byProject = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const tk of tasks.items) m.set(tk.project, [...(m.get(tk.project) ?? []), tk]);
    return m;
  }, [tasks.items]);

  const list = projects.items.filter((p) => showArchived || p.status !== 'archived');
  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem('rozana:projectsView', v); } catch { /* stockage indisponible */ }
  };

  const onDrop = (status: ProjectStatus) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const p = projects.items.find((x) => x.id === id);
    if (p && p.status !== status) void run(() => updateRecord('projects', id, { status }), 'feedback.moved');
  };

  const card = (p: Project, compact = false) => {
    const prog = projectProgress(byProject.get(p.id) ?? []);
    const late = p.deadline && p.deadline < today && p.status !== 'done';
    return (
      <a
        key={p.id}
        href={`/projets/${p.id}`}
        draggable={view === 'kanban'}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
        className={cn('block rounded-card border border-line/70 bg-surface p-4 shadow-soft transition-transform duration-200 hover:-translate-y-0.5', compact && 'p-3')}
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: p.color || '#EAD3BF' }} aria-hidden>
            {p.icon || '📁'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{p.name}</p>
            <p className="text-xs text-ink-2">{t(`projectStatus.${p.status}`)}</p>
          </div>
          <span className="text-sm font-semibold tabular-nums">{prog.pct}%</span>
        </div>
        <Progress value={prog.pct} label={p.name} color={p.color || undefined} />
        <p className={cn('mt-2 text-xs text-ink-2', late && 'font-semibold text-danger')}>
          {prog.total ? t('projects.tasksCount', prog) : t('projects.noTasks')}
          {p.deadline && ` · ${late ? t('projects.overdue') : t('projects.deadline', { date: fmtDay(p.deadline, locale, 'short') })}`}
        </p>
      </a>
    );
  };

  return (
    <>
      <PageHeader title={t('projects.title')} actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>{t('projects.new')}</Button>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label={t('projects.title')} value={view} onChange={changeView} options={(['cards', 'list', 'kanban'] as const).map((v) => ({ value: v, label: t(`projects.views.${v}`) }))} />
        <div className="w-60"><Toggle label={t('projects.showArchived')} checked={showArchived} onChange={setShowArchived} /></div>
      </div>

      {projects.loading ? (
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : list.length === 0 ? (
        <Card className="p-4">
          <EmptyState illustration={<Folder />} title={t('projects.empty')} hint={t('projects.emptyHint')} action={<Button onClick={() => setCreating(true)}>{t('projects.new')}</Button>} />
        </Card>
      ) : view === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map((p) => card(p))}</div>
      ) : view === 'list' ? (
        <Card className="divide-y divide-line/60 p-0">
          {list.map((p) => {
            const prog = projectProgress(byProject.get(p.id) ?? []);
            return (
              <a key={p.id} href={`/projets/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-white/50">
                <span className="grid size-9 place-items-center rounded-xl" style={{ background: p.color || '#EAD3BF' }} aria-hidden>{p.icon || '📁'}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="hidden w-32 sm:block"><Progress value={prog.pct} label={p.name} color={p.color || undefined} /></span>
                <span className="w-12 text-end text-sm tabular-nums">{prog.pct}%</span>
                <span className="hidden w-24 text-end text-sm text-ink-2 md:block">{p.deadline ? fmtDay(p.deadline, locale, 'short') : '—'}</span>
              </a>
            );
          })}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(['todo', 'in_progress', 'done'] as const).map((s) => (
            <section key={s} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(s)} className="flex min-h-40 flex-col gap-3 rounded-card bg-surface/50 p-3" aria-label={t(`projectStatus.${s}`)}>
              <h2 className="px-1 font-display text-lg font-semibold">
                {t(`projectStatus.${s}`)} <span className="text-sm text-ink-2">({list.filter((p) => p.status === s).length})</span>
              </h2>
              {list.filter((p) => p.status === s).map((p) => card(p, true))}
            </section>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title={t('projects.new')} closeLabel={t('actions.close')}>
        {creating && <ProjectForm locale={locale} onDone={(p) => { setCreating(false); if (p?.id) window.location.assign(`/projets/${p.id}`); }} />}
      </Modal>
    </>
  );
}

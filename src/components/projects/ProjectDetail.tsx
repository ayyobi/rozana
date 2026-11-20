import { useMemo, useState, type DragEvent } from 'react';
import { ArrowLeft, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Card, EmptyState, Progress, Skeleton } from '@/components/ui/primitives';
import { Folder } from '@/components/ui/illustrations';
import { ConfirmDialog, Segmented } from '@/components/ui/forms';
import { ProjectForm } from '@/components/forms/ProjectForm';
import { TaskItem } from '@/components/tasks/TaskItem';
import { useTaskActions } from '@/components/tasks/useTaskActions';
import { projectProgress } from './ProjectsApp';
import { type Locale } from '@/i18n';
import { useList } from '@/hooks/useList';
import { usePlanningRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, pb, updateRecord } from '@/lib/pocketbase/client';
import { isOpen, smartCompare } from '@/lib/planning/tasks';
import { fmtDay } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Task, TaskStatus } from '@/types/models';

export default function ProjectDetail({ locale, today, projectId }: { locale: Locale; today: string; projectId: string }) {
  const actions = useTaskActions(locale, today);
  const { t } = actions;
  const run = useAction(t);
  const refs = usePlanningRefs();
  const projectList = useList('projects', { filter: pb().filter('id = {:id}', { id: projectId }) });
  const project = projectList.items[0];
  const tasks = useList('tasks', { filter: pb().filter('project = {:id}', { id: projectId }) });
  const sections = useList('project_sections', { filter: pb().filter('project = {:id}', { id: projectId }), sort: 'sort,created' });
  const [view, setView] = useState<'sections' | 'kanban'>('sections');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newSection, setNewSection] = useState('');

  const prog = projectProgress(tasks.items);
  const nextSteps = useMemo(() => tasks.items.filter(isOpen).sort(smartCompare(today)).slice(0, 3), [tasks.items, today]);

  if (projectList.loading) return <Skeleton className="h-64" />;
  if (!project)
    return (
      <Card className="p-6">
        <EmptyState illustration={<Folder />} title={t('projects.notFound')} action={<a href="/projets" className="font-medium text-coral-strong">{t('projects.back')}</a>} />
      </Card>
    );

  const item = (task: Task) => (
    <TaskItem
      key={task.id}
      task={task}
      today={today}
      locale={locale}
      t={t}
      category={refs.catById.get(task.category)}
      onToggle={(d) => void actions.toggle(task, d)}
      onEdit={() => actions.edit(task)}
      onDuplicate={() => void actions.duplicate(task)}
      onPostpone={(m) => actions.postpone(task, m)}
      onDelete={() => actions.remove(task)}
    />
  );

  const dropStatus = (status: TaskStatus) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const tk = tasks.items.find((x) => x.id === id);
    if (tk && tk.status !== status)
      void run(() => updateRecord('tasks', id, { status, completed_at: status === 'done' ? new Date().toISOString() : '' }), 'feedback.moved');
  };

  const groups = [...sections.items.map((s) => ({ id: s.id, name: s.name })), { id: '', name: t('projects.noSection') }];

  return (
    <>
      <a href="/projets" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('projects.back')}
      </a>
      <Card className="mb-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-14 place-items-center rounded-2xl text-2xl" style={{ background: project.color || '#EAD3BF' }} aria-hidden>{project.icon || '📁'}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold">{project.name}</h1>
            <p className="text-sm text-ink-2">
              {t(`projectStatus.${project.status}`)}
              {project.deadline && ` · ${t('projects.deadline', { date: fmtDay(project.deadline, locale, 'medium') })}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>{t('actions.edit')}</Button>
            <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDeleting(true)} aria-label={t('actions.delete')} />
          </div>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium">{t('projects.progress')}</span>
              <span className="tabular-nums">{prog.pct}% · {t('projects.tasksCount', prog)}</span>
            </div>
            <Progress value={prog.pct} label={t('projects.progress')} color={project.color || undefined} />
            {project.description && <p className="mt-4 whitespace-pre-wrap text-ink">{project.description}</p>}
            {project.links && project.links.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {project.links.map((l, i) => (
                  <li key={i}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-pill bg-white/60 px-3 py-1 text-sm hover:bg-white">
                      {l.label}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {project.notes && <p className="mt-3 rounded-2xl bg-white/50 p-3 text-sm whitespace-pre-wrap">{project.notes}</p>}
          </div>
          <div className="rounded-2xl bg-white/50 p-4">
            <h2 className="mb-2 font-display text-base font-semibold">{t('projects.nextSteps')}</h2>
            {nextSteps.length === 0 ? (
              <p className="text-sm text-ink-2">{t('projects.noNextSteps')}</p>
            ) : (
              <ol className="flex flex-col gap-1.5 text-sm">
                {nextSteps.map((s, i) => (
                  <li key={s.id} className="flex gap-2">
                    <span className="text-ink-2 tabular-nums">{i + 1}.</span>
                    <span className="flex-1">{s.title}</span>
                    {s.deadline && <span className="text-ink-2">{fmtDay(s.deadline, locale, 'short')}</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label={t('projects.sections')} value={view} onChange={setView} options={[{ value: 'sections', label: t('projects.taskViews.sections') }, { value: 'kanban', label: t('projects.taskViews.kanban') }]} />
        <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => actions.create({ project: projectId })}>{t('projects.addTask')}</Button>
      </div>

      {tasks.loading ? (
        <Skeleton className="h-40" />
      ) : view === 'sections' ? (
        <div className="flex flex-col gap-5">
          {groups.map((g) => {
            const list = tasks.items.filter((x) => (g.id ? x.section === g.id : !sections.items.some((s) => s.id === x.section))).sort(smartCompare(today));
            if (!g.id && list.length === 0 && sections.items.length > 0) return null;
            return (
              <section key={g.id || 'none'} aria-label={g.name}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold">{g.name} <span className="text-sm text-ink-2">({list.length})</span></h2>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => actions.create({ project: projectId, section: g.id })} className="grid size-8 place-items-center rounded-full hover:bg-surface" aria-label={`${t('projects.addTask')} · ${g.name}`}>
                      <Plus className="size-4" aria-hidden />
                    </button>
                    {g.id && (
                      <button type="button" onClick={() => void run(() => deleteRecord('project_sections', g.id), 'feedback.deleted')} className="grid size-8 place-items-center rounded-full hover:bg-surface" aria-label={`${t('projects.deleteSection')} · ${g.name}`}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
                {list.length ? <ul className="flex flex-col gap-2">{list.map(item)}</ul> : <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink-2">{t('projects.noTasks')}</p>}
              </section>
            );
          })}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const name = newSection.trim();
              if (!name) return;
              setNewSection('');
              await run(() => createRecord('project_sections', { project: projectId, name, sort: sections.items.length }), 'feedback.created');
            }}
            className="flex gap-2"
          >
            <input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder={t('projects.sectionPlaceholder')} aria-label={t('projects.newSection')} maxLength={80} className="h-11 flex-1 rounded-field border border-dashed border-line bg-transparent px-4 outline-none focus:border-coral-strong" />
            <Button type="submit" variant="secondary">{t('projects.newSection')}</Button>
          </form>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(['todo', 'in_progress', 'done'] as const).map((s) => (
            <section key={s} onDragOver={(e) => e.preventDefault()} onDrop={dropStatus(s)} className="flex min-h-40 flex-col gap-2 rounded-card bg-surface/50 p-3" aria-label={t(`status.${s}`)}>
              <h2 className="px-1 font-display text-lg font-semibold">{t(`status.${s}`)}</h2>
              {tasks.items.filter((x) => x.status === s).map((x) => (
                <div key={x.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', x.id)} className={cn('cursor-grab rounded-2xl bg-white/80 p-3 text-sm shadow-soft', s === 'done' && 'text-ink-2 line-through')}>
                  <button type="button" onClick={() => actions.edit(x)} className="w-full text-start font-medium">{x.title}</button>
                  {x.deadline && <p className="mt-1 text-xs text-ink-2">{fmtDay(x.deadline, locale, 'short')}</p>}
                  <label className="mt-2 block text-xs text-ink-2 md:hidden">
                    <span className="sr-only">{t('fields.status')}</span>
                    <select value={x.status} onChange={(e) => void run(() => updateRecord('tasks', x.id, { status: e.target.value as TaskStatus }), 'feedback.moved')} className="rounded-lg bg-bg/50 px-2 py-1">
                      {(['todo', 'in_progress', 'done'] as const).map((o) => <option key={o} value={o}>{t(`status.${o}`)}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title={t('projects.edit')} closeLabel={t('actions.close')}>
        {editing && <ProjectForm locale={locale} project={project} onDone={() => setEditing(false)} />}
      </Modal>
      <ConfirmDialog
        open={deleting}
        title={t('confirmDelete.title')}
        message={`${t('confirmDelete.message', { name: project.name })} ${t('confirmDelete.projectTasks')}`}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        closeLabel={t('actions.close')}
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          const ok = await run(async () => { await deleteRecord('projects', project.id); return true; }, 'feedback.deleted');
          if (ok) window.location.assign('/projets');
        }}
      />
      {actions.elements}
    </>
  );
}

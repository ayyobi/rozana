import { useState, type SubmitEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Disclosure, Input, Select, TextArea } from '@/components/ui/forms';
import { RoundCheckbox } from '@/components/ui/primitives';
import { LinksEditor, RecurrenceEditor, cleanLinks, reminderOptions } from './shared';
import { useTranslations, type Locale } from '@/i18n';
import { usePlanningRefs } from '@/hooks/useRefs';
import { useList } from '@/hooks/useList';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, pb, updateRecord } from '@/lib/pocketbase/client';
import type { Link, Priority, Recurrence, Task, TaskStatus } from '@/types/models';

export interface TaskFormProps {
  locale: Locale;
  task?: Task | null;
  defaults?: Partial<Task>;
  onDone: (saved?: Task) => void;
}

export function TaskForm({ locale, task, defaults, onDone }: TaskFormProps) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = usePlanningRefs();
  const init = { ...defaults, ...task };
  const [title, setTitle] = useState(init.title ?? '');
  const [category, setCategory] = useState(init.category ?? '');
  const [priority, setPriority] = useState<Priority>(init.priority ?? 'normal');
  const [startDate, setStartDate] = useState(init.start_date ?? '');
  const [deadline, setDeadline] = useState(init.deadline ?? '');
  const [description, setDescription] = useState(init.description ?? '');
  const [project, setProject] = useState(init.project ?? '');
  const [section, setSection] = useState(init.section ?? '');
  const [startTime, setStartTime] = useState(init.start_time ?? '');
  const [endDate, setEndDate] = useState(init.end_date ?? '');
  const [endTime, setEndTime] = useState(init.end_time ?? '');
  const [status, setStatus] = useState<TaskStatus>(init.status ?? 'todo');
  const [estimate, setEstimate] = useState(init.estimate_min ? String(init.estimate_min) : '');
  const [reminder, setReminder] = useState(String(init.reminder_min ?? 0));
  const [recurrence, setRecurrence] = useState<Recurrence | null>(init.recurrence ?? null);
  const [links, setLinks] = useState<Link[]>(init.links ?? []);
  const [notes, setNotes] = useState(init.notes ?? '');
  const [newSubs, setNewSubs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const projectSections = refs.sections.filter((s) => s.project === project);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return setError(t('errors.validation'));
    if (endDate && startDate && endDate < startDate) return setError(t('errors.validation'));
    setBusy(true);
    const data = {
      title: title.trim(),
      category,
      priority,
      start_date: startDate,
      deadline,
      description,
      project,
      section: projectSections.some((s) => s.id === section) ? section : '',
      start_time: startDate ? startTime : '',
      end_date: endDate,
      end_time: endDate ? endTime : '',
      status,
      estimate_min: Math.max(0, Math.round(Number(estimate) || 0)),
      reminder_min: Number(reminder) || 0,
      recurrence,
      links: cleanLinks(links),
      notes,
      completed_at: status === 'done' ? task?.completed_at || new Date().toISOString() : '',
    };
    const saved = await run(async () => {
      const rec = task ? await updateRecord('tasks', task.id, data, task.updated) : await createRecord('tasks', data);
      for (const [i, s] of newSubs.filter((x) => x.trim()).entries()) {
        await createRecord('subtasks', { task: rec.id, title: s.trim(), done: false, sort: i });
      }
      return rec;
    }, task ? 'feedback.saved' : 'feedback.created');
    setBusy(false);
    if (saved) onDone(saved);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input label={t('fields.title')} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus error={error || undefined} />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label={t('fields.category')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[{ value: '', label: t('fields.noCategory') }, ...refs.categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <Select
          label={t('fields.priority')}
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          options={(['low', 'normal', 'high', 'urgent'] as const).map((p) => ({ value: p, label: t(`priority.${p}`) }))}
        />
        <Input label={t('fields.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label={t('fields.deadline')} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>

      <Disclosure title={t('actions.advanced')} defaultOpen={!!task}>
        <TextArea label={t('fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t('fields.project')}
            value={project}
            onChange={(e) => setProject(e.target.value)}
            options={[{ value: '', label: t('fields.noProject') }, ...refs.projects.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <Select
            label={t('fields.section')}
            value={section}
            disabled={!projectSections.length}
            onChange={(e) => setSection(e.target.value)}
            options={[{ value: '', label: t('fields.noSection') }, ...projectSections.map((s) => ({ value: s.id, label: s.name }))]}
          />
          <Input label={t('fields.startTime')} type="time" value={startTime} disabled={!startDate} onChange={(e) => setStartTime(e.target.value)} />
          <Input label={t('fields.endDate')} type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          <Input label={t('fields.endTime')} type="time" value={endTime} disabled={!endDate} onChange={(e) => setEndTime(e.target.value)} />
          <Select
            label={t('fields.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            options={(['todo', 'in_progress', 'done', 'cancelled'] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))}
          />
          <Input label={t('fields.estimate')} type="number" min={0} inputMode="numeric" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          <Select label={t('fields.reminder')} value={reminder} onChange={(e) => setReminder(e.target.value)} options={reminderOptions(t)} />
        </div>
        <RecurrenceEditor value={recurrence} onChange={setRecurrence} t={t} locale={locale} />
        {task ? <SubtasksEditor taskId={task.id} locale={locale} /> : <NewSubtasks value={newSubs} onChange={setNewSubs} t={t} />}
        <LinksEditor value={links} onChange={setLinks} t={t} />
        <TextArea label={t('fields.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Disclosure>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={() => onDone()}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" loading={busy}>
          {task ? t('actions.save') : t('actions.create')}
        </Button>
      </div>
    </form>
  );
}

function NewSubtasks({ value, onChange, t }: { value: string[]; onChange: (v: string[]) => void; t: ReturnType<typeof useTranslations> }) {
  const [draft, setDraft] = useState('');
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{t('fields.subtasks')}</legend>
      {value.map((s, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl bg-bg/40 px-3 py-2 text-sm">
          <span className="flex-1">{s}</span>
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={t('actions.delete')} className="grid size-7 place-items-center rounded-full hover:bg-ink/5">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
      <input
        className="h-10 rounded-xl border border-dashed border-line bg-transparent px-3 text-sm outline-none focus:border-coral-strong"
        placeholder={t('fields.subtaskPlaceholder')}
        aria-label={t('fields.addSubtask')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (draft.trim()) onChange([...value, draft.trim()]);
            setDraft('');
          }
        }}
      />
    </fieldset>
  );
}

/** Édition directe des sous-tâches d'une tâche existante. */
export function SubtasksEditor({ taskId, locale }: { taskId: string; locale: Locale }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const subs = useList('subtasks', { filter: pb().filter('task = {:id}', { id: taskId }), sort: 'sort,created' });
  const [draft, setDraft] = useState('');
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium">{t('fields.subtasks')}</legend>
      {subs.items.map((s) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl bg-bg/40 px-3 py-2">
          <RoundCheckbox checked={s.done} label={s.title} onChange={(v) => void run(() => updateRecord('subtasks', s.id, { done: v }))} />
          <span className={s.done ? 'flex-1 text-sm text-ink-2 line-through' : 'flex-1 text-sm'}>{s.title}</span>
          <button type="button" onClick={() => void run(() => deleteRecord('subtasks', s.id))} aria-label={t('actions.delete')} className="grid size-7 place-items-center rounded-full hover:bg-ink/5">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
      <input
        className="h-10 rounded-xl border border-dashed border-line bg-transparent px-3 text-sm outline-none focus:border-coral-strong"
        placeholder={t('fields.subtaskPlaceholder')}
        aria-label={t('fields.addSubtask')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const title = draft.trim();
            if (!title) return;
            setDraft('');
            await run(() => createRecord('subtasks', { task: taskId, title, done: false, sort: subs.items.length }));
          }
        }}
      />
    </fieldset>
  );
}

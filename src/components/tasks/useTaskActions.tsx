import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, Input } from '@/components/ui/forms';
import { Button } from '@/components/ui/Button';
import { TaskForm } from '@/components/forms/TaskForm';
import { useTranslations, type Locale } from '@/i18n';
import { useAction } from '@/hooks/useAction';
import { createRecord, deleteRecord, updateRecord } from '@/lib/pocketbase/client';
import { duplicateData, nextOccurrence, refDay, shiftTaskDates } from '@/lib/planning/tasks';
import { addDays, diffDays } from '@/lib/utils/day';
import type { Task } from '@/types/models';

/** Actions communes sur les tâches (liste, calendrier, projets, dashboard). */
export function useTaskActions(locale: Locale, today: string) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<Partial<Task> | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [postponing, setPostponing] = useState<Task | null>(null);
  const [pickDate, setPickDate] = useState('');

  async function toggle(task: Task, done: boolean) {
    await run(async () => {
      await updateRecord('tasks', task.id, { status: done ? 'done' : 'todo', completed_at: done ? new Date().toISOString() : '' });
      // Tâche récurrente : la prochaine occurrence est créée à la complétion.
      if (done) {
        const next = nextOccurrence(task);
        if (next) await createRecord('tasks', next);
      }
    }, done ? 'feedback.completed' : 'feedback.reopened');
  }

  async function postponeTo(task: Task, target: string) {
    const base = refDay(task) || today;
    const delta = diffDays(target, base);
    const data = refDay(task) ? shiftTaskDates(task, delta) : { start_date: target };
    await run(() => updateRecord('tasks', task.id, data), 'feedback.postponed');
  }

  function postpone(task: Task, mode: 'tomorrow' | 'nextWeek' | 'pick') {
    const base = refDay(task) && refDay(task) > today ? refDay(task) : today;
    if (mode === 'tomorrow') return void postponeTo(task, addDays(base, 1));
    if (mode === 'nextWeek') return void postponeTo(task, addDays(base, 7));
    setPickDate(addDays(today, 1));
    setPostponing(task);
  }

  const duplicate = (task: Task) => run(() => createRecord('tasks', duplicateData(task, locale === 'fa' ? '(کپی)' : '(copie)')), 'feedback.duplicated');

  const elements = (
    <>
      <Modal open={!!editing || !!creating} onClose={() => { setEditing(null); setCreating(null); }} title={editing ? t('tasks.edit') : t('tasks.new')} closeLabel={t('actions.close')}>
        {(editing || creating) && (
          <TaskForm key={editing?.id ?? 'new'} locale={locale} task={editing} defaults={creating ?? undefined} onDone={() => { setEditing(null); setCreating(null); }} />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        title={t('confirmDelete.title')}
        message={deleting ? `${t('confirmDelete.message', { name: deleting.title })} ${t('confirmDelete.taskSubs')}` : ''}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        closeLabel={t('actions.close')}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await run(() => deleteRecord('tasks', deleting.id), 'feedback.deleted');
          setDeleting(null);
        }}
      />
      <Modal open={!!postponing} onClose={() => setPostponing(null)} title={t('actions.postpone')} closeLabel={t('actions.close')}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (postponing && pickDate) await postponeTo(postponing, pickDate);
            setPostponing(null);
          }}
        >
          <Input label={t('fields.date')} type="date" value={pickDate} onChange={(e) => setPickDate(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPostponing(null)}>{t('actions.cancel')}</Button>
            <Button type="submit">{t('actions.confirm')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );

  return {
    t,
    toggle,
    postpone,
    postponeTo,
    duplicate,
    edit: setEditing,
    create: (defaults: Partial<Task> = {}) => setCreating(defaults),
    remove: setDeleting,
    elements,
  };
}

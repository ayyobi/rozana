import { useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ColorPicker, Disclosure, Input, Select, TextArea } from '@/components/ui/forms';
import { LinksEditor, cleanLinks } from './shared';
import { useTranslations, type Locale } from '@/i18n';
import { usePlanningRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord, updateRecord } from '@/lib/pocketbase/client';
import type { Link, Project, ProjectStatus } from '@/types/models';

const ICONS = ['📁', '🎓', '💼', '🏡', '✈️', '🎨', '💡', '📚', '🛠️', '🌱'];

export function ProjectForm({ locale, project, onDone }: { locale: Locale; project?: Project | null; onDone: (p?: Project) => void }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = usePlanningRefs();
  const [name, setName] = useState(project?.name ?? '');
  const [deadline, setDeadline] = useState(project?.deadline ?? '');
  const [color, setColor] = useState(project?.color || '#D9A47F');
  const [icon, setIcon] = useState(project?.icon || '📁');
  const [description, setDescription] = useState(project?.description ?? '');
  const [category, setCategory] = useState(project?.category ?? '');
  const [startDate, setStartDate] = useState(project?.start_date ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'in_progress');
  const [notes, setNotes] = useState(project?.notes ?? '');
  const [links, setLinks] = useState<Link[]>(project?.links ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return setError(t('errors.validation'));
    setBusy(true);
    const data = { name: name.trim(), deadline, color, icon, description, category, start_date: startDate, status, notes, links: cleanLinks(links) };
    const saved = await run(() => (project ? updateRecord('projects', project.id, data) : createRecord('projects', data)), project ? 'feedback.saved' : 'feedback.created');
    setBusy(false);
    if (saved) onDone(saved);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input label={t('fields.name')} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus error={error || undefined} />
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('fields.deadline')} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <Select
          label={t('fields.status')}
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          options={(['todo', 'in_progress', 'done', 'archived'] as const).map((s) => ({ value: s, label: t(`projectStatus.${s}`) }))}
        />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t('fields.icon')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button key={i} type="button" aria-pressed={icon === i} onClick={() => setIcon(i)} className={`grid size-10 place-items-center rounded-xl text-lg ${icon === i ? 'bg-coral' : 'bg-bg/50 hover:bg-bg'}`}>
              {i}
            </button>
          ))}
        </div>
      </fieldset>
      <ColorPicker label={t('fields.color')} value={color} onChange={setColor} />
      <Disclosure title={t('actions.advanced')} defaultOpen={!!project}>
        <TextArea label={t('fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('fields.category')} value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: t('fields.noCategory') }, ...refs.categories.map((c) => ({ value: c.id, label: c.name }))]} />
          <Input label={t('fields.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <LinksEditor value={links} onChange={setLinks} t={t} />
        <TextArea label={t('fields.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Disclosure>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onDone()}>{t('actions.cancel')}</Button>
        <Button type="submit" loading={busy}>{project ? t('actions.save') : t('actions.create')}</Button>
      </div>
    </form>
  );
}

import { useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ColorPicker, Disclosure, Input, Select, TextArea, Toggle } from '@/components/ui/forms';
import { RecurrenceEditor, reminderOptions } from './shared';
import { useTranslations, type Locale } from '@/i18n';
import { usePlanningRefs } from '@/hooks/useRefs';
import { useAction } from '@/hooks/useAction';
import { createRecord, updateRecord } from '@/lib/pocketbase/client';
import type { CalEvent, Recurrence } from '@/types/models';

export function EventForm({ locale, event, defaults, onDone }: { locale: Locale; event?: CalEvent | null; defaults?: Partial<CalEvent>; onDone: () => void }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const refs = usePlanningRefs();
  const init = { ...defaults, ...event };
  const [title, setTitle] = useState(init.title ?? '');
  const [category, setCategory] = useState(init.category ?? '');
  const [allDay, setAllDay] = useState(init.all_day ?? false);
  const [startDate, setStartDate] = useState(init.start_date ?? '');
  const [startTime, setStartTime] = useState(init.start_time || '09:00');
  const [endDate, setEndDate] = useState(init.end_date || init.start_date || '');
  const [endTime, setEndTime] = useState(init.end_time || '10:00');
  const [description, setDescription] = useState(init.description ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence | null>(init.recurrence ?? null);
  const [reminder, setReminder] = useState(String(init.reminder_min ?? 0));
  const [color, setColor] = useState(init.color ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const end = endDate || startDate;
    if (!title.trim() || !startDate) return setError(t('errors.validation'));
    if (end < startDate || (!allDay && end === startDate && endTime <= startTime)) return setError(t('events.endBeforeStart'));
    setBusy(true);
    const data = {
      title: title.trim(),
      category,
      all_day: allDay,
      start_date: startDate,
      start_time: allDay ? '' : startTime,
      end_date: end,
      end_time: allDay ? '' : endTime,
      description,
      recurrence,
      reminder_min: Number(reminder) || 0,
      color,
    };
    const ok = await run(() => (event ? updateRecord('events', event.id, data, event.updated) : createRecord('events', data)), event ? 'feedback.saved' : 'feedback.created');
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input label={t('fields.title')} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
      <Toggle label={t('fields.allDay')} checked={allDay} onChange={setAllDay} />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('fields.startDate')}
          type="date"
          value={startDate}
          required
          onChange={(e) => {
            const v = e.target.value;
            if (!endDate || endDate < v) setEndDate(v);
            setStartDate(v);
          }}
        />
        {!allDay && <Input label={t('fields.startTime')} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
        <Input label={t('fields.endDate')} type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
        {!allDay && <Input label={t('fields.endTime')} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
      </div>
      <Select
        label={t('fields.category')}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        options={[{ value: '', label: t('fields.noCategory') }, ...refs.categories.map((c) => ({ value: c.id, label: c.name }))]}
      />
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <Disclosure title={t('actions.advanced')} defaultOpen={!!event && (!!event.recurrence || !!event.description)}>
        <TextArea label={t('fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
        <RecurrenceEditor value={recurrence} onChange={setRecurrence} t={t} locale={locale} />
        <Select label={t('fields.reminder')} value={reminder} onChange={(e) => setReminder(e.target.value)} options={reminderOptions(t)} />
        <ColorPicker label={t('fields.color')} value={color} onChange={setColor} />
      </Disclosure>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('actions.cancel')}</Button>
        <Button type="submit" loading={busy}>{event ? t('actions.save') : t('actions.create')}</Button>
      </div>
    </form>
  );
}

import { useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ColorPicker, Disclosure, Input, Segmented, TextArea } from '@/components/ui/forms';
import { useTranslations, type Locale } from '@/i18n';
import { useAction } from '@/hooks/useAction';
import { createRecord, updateRecord } from '@/lib/pocketbase/client';
import { weekdayShort } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Habit } from '@/types/models';

const ICONS = ['📖', '🏃', '📚', '💧', '☕', '😴', '🧘', '🥗', '✍️', '🎵', '🌿', '💊'];
const COLORS_DEFAULT = '#C6D3BD';

export function HabitForm({ locale, habit, onDone }: { locale: Locale; habit?: Habit | null; onDone: () => void }) {
  const t = useTranslations(locale);
  const run = useAction(t);
  const [name, setName] = useState(habit?.name ?? '');
  const [icon, setIcon] = useState(habit?.icon || '🌿');
  const [color, setColor] = useState(habit?.color || COLORS_DEFAULT);
  const [frequency, setFrequency] = useState<Habit['frequency']>(habit?.frequency ?? 'daily');
  const [days, setDays] = useState<number[]>(habit?.days ?? [0, 1, 2, 3, 4]);
  const [reminder, setReminder] = useState(habit?.reminder_time ?? '');
  const [target, setTarget] = useState(habit?.target_qty ? String(habit.target_qty) : '');
  const [unit, setUnit] = useState(habit?.target_unit ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || (frequency === 'days' && !days.length)) return setError(t('errors.validation'));
    setBusy(true);
    const data = {
      name: name.trim(),
      icon,
      color,
      frequency,
      days: frequency === 'days' ? [...days].sort() : null,
      reminder_time: reminder,
      target_qty: Math.max(0, Math.round(Number(target) || 0)),
      target_unit: unit.trim(),
      description,
      archived: habit?.archived ?? false,
    };
    const ok = await run(() => (habit ? updateRecord('habits', habit.id, data) : createRecord('habits', data)), habit ? 'feedback.saved' : 'feedback.created');
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input label={t('fields.name')} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus hint={habit ? undefined : t('habits.examples')} error={error || undefined} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t('fields.icon')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button key={i} type="button" aria-pressed={icon === i} onClick={() => setIcon(i)} className={cn('grid size-10 place-items-center rounded-xl text-lg', icon === i ? 'bg-coral' : 'bg-bg/50 hover:bg-bg')}>{i}</button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('habits.frequency')}</span>
        <Segmented label={t('habits.frequency')} value={frequency} onChange={setFrequency} options={[{ value: 'daily', label: t('habits.daily') }, { value: 'days', label: t('habits.days') }]} />
        {frequency === 'days' && (
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])} className={cn('h-9 min-w-11 rounded-pill px-2 text-sm font-medium', days.includes(d) ? 'bg-coral' : 'bg-bg/60')}>
                {weekdayShort(d, locale)}
              </button>
            ))}
          </div>
        )}
      </div>
      <Input label={t('habits.reminderTime')} optional={t('fields.optional')} type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />
      <Disclosure title={t('actions.advanced')} defaultOpen={!!habit && (!!habit.target_qty || !!habit.description)}>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('habits.target')} type="number" min={0} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
          <Input label={t('habits.targetUnit')} value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <ColorPicker label={t('fields.color')} value={color} onChange={setColor} />
        <TextArea label={t('fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Disclosure>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('actions.cancel')}</Button>
        <Button type="submit" loading={busy}>{habit ? t('actions.save') : t('actions.create')}</Button>
      </div>
    </form>
  );
}

import { Plus, X } from 'lucide-react';
import { Input, Select } from '@/components/ui/forms';
import { useTranslations, type Locale, type TranslationKey } from '@/i18n';
import type { Link, Recurrence } from '@/types/models';
import { weekdayShort } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

type T = ReturnType<typeof useTranslations>;

export function RecurrenceEditor({ value, onChange, t, locale }: { value: Recurrence | null; onChange: (r: Recurrence | null) => void; t: T; locale: Locale }) {
  const freq = value?.freq ?? 'none';
  return (
    <div className="flex flex-col gap-3">
      <Select
        label={t('fields.recurrence')}
        value={freq}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === 'none' ? null : { freq: v as Recurrence['freq'], interval: value?.interval || 1, ...(value?.until ? { until: value.until } : {}) });
        }}
        options={[
          { value: 'none', label: t('recurrence.none') },
          { value: 'daily', label: t('recurrence.freqDaily') },
          { value: 'weekly', label: t('recurrence.freqWeekly') },
          { value: 'monthly', label: t('recurrence.freqMonthly') },
          { value: 'yearly', label: t('recurrence.freqYearly') },
        ]}
      />
      {value && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('recurrence.interval')}
            type="number"
            min={1}
            max={365}
            value={value.interval || 1}
            onChange={(e) => onChange({ ...value, interval: Math.max(1, Number(e.target.value) || 1) })}
            hint={t(`recurrence.${value.freq}` as TranslationKey, { n: value.interval || 1 })}
          />
          <Input
            label={t('recurrence.until')}
            optional={t('fields.optional')}
            type="date"
            value={value.until ?? ''}
            onChange={(e) => {
              const { until: _u, ...rest } = value;
              onChange(e.target.value ? { ...rest, until: e.target.value } : rest);
            }}
          />
          {value.freq === 'weekly' && (
            <fieldset className="col-span-2">
              <legend className="mb-1.5 text-sm font-medium">{t('recurrence.days')}</legend>
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const on = value.byweekday?.includes(d) ?? false;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const set = new Set(value.byweekday ?? []);
                        if (on) set.delete(d);
                        else set.add(d);
                        const arr = [...set].sort();
                        const { byweekday: _b, ...rest } = value;
                        onChange(arr.length ? { ...rest, byweekday: arr } : rest);
                      }}
                      className={cn('h-9 min-w-11 rounded-pill px-2 text-sm font-medium', on ? 'bg-coral' : 'bg-bg/60 hover:bg-bg')}
                    >
                      {weekdayShort(d, locale)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}

export function LinksEditor({ value, onChange, t }: { value: Link[]; onChange: (l: Link[]) => void; t: T }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{t('fields.links')}</legend>
      {value.map((l, i) => (
        <div key={i} className="flex items-end gap-2">
          <Input className="flex-1" label={t('fields.linkLabel')} value={l.label} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <Input
            className="flex-[2]"
            label={t('fields.linkUrl')}
            type="url"
            dir="ltr"
            value={l.url}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
          />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="mb-1 grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={t('actions.delete')}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { label: '', url: '' }])} className="inline-flex items-center gap-1.5 self-start rounded-pill px-3 py-1.5 text-sm font-medium text-coral-strong hover:bg-coral-soft">
        <Plus className="size-4" aria-hidden />
        {t('fields.addLink')}
      </button>
    </fieldset>
  );
}

/** Nettoie les liens : retire les vides, n'accepte que http(s). */
export function cleanLinks(links: Link[]): Link[] {
  return links
    .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
    .filter((l) => /^https?:\/\/\S+$/i.test(l.url))
    .map((l) => ({ label: l.label || l.url, url: l.url }));
}

export function reminderOptions(t: T) {
  return [
    { value: '0', label: t('reminderOptions.none') },
    ...(['5', '15', '30', '60', '1440'] as const).map((v) => ({ value: v, label: t(`reminderOptions.${v}`) })),
  ];
}

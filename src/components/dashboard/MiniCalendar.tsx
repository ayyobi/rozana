import { useMemo, useState } from 'react';
import { addMonths, format } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { WidgetFrame } from './widgets';
import { useTranslations, type Locale } from '@/i18n';
import { formatDayNumber, formatMonthYear, monthGrid, weekdayInitials } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

export function MiniCalendar({
  locale,
  todayIso,
  timeZone,
  dots,
}: {
  locale: Locale;
  todayIso: string; // AAAA-MM-JJ dans le fuseau de l'utilisatrice
  timeZone: string;
  dots: Record<string, string[]>;
}) {
  const t = useTranslations(locale);
  // Date « murale » locale construite à partir de l'ISO du serveur : pas de décalage de fuseau.
  const today = useMemo(() => {
    const [y, m, d] = todayIso.split('-').map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  }, [todayIso]);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const cells = useMemo(() => monthGrid(month, today), [month, today]);
  const initials = useMemo(() => weekdayInitials(locale), [locale]);
  const isCurrentMonth = month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();

  return (
    <WidgetFrame title={t('widgets.calendar.title')} icon={<CalendarDays className="size-4" />} href="/planning/mois" t={t} className="h-full">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display text-base font-semibold first-letter:uppercase" aria-live="polite">
          {formatMonthYear(month, locale)}
        </p>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="h-8 rounded-pill px-2.5 text-xs font-medium hover:bg-ink/5"
            >
              {t('header.today')}
            </button>
          )}
          <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={t('widgets.calendar.prev')}>
            <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          </button>
          <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={t('widgets.calendar.next')}>
            <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
      </div>
      <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-center text-sm" role="grid">
        <thead>
          <tr>
            {initials.map((d, i) => (
              <th key={i} scope="col" className="pb-1 text-xs font-medium text-ink-2">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, w) => (
            <tr key={w}>
              {cells.slice(w * 7, w * 7 + 7).map((c) => {
                const key = format(c.date, 'yyyy-MM-dd');
                const colors = dots[key] ?? [];
                return (
                  <td key={key} className="p-0">
                    <a
                      href={`/planning/jour?date=${key}`}
                      aria-current={c.isToday ? 'date' : undefined}
                      aria-label={new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'fr-FR', { dateStyle: 'full', timeZone: 'UTC' }).format(
                        new Date(Date.UTC(c.date.getFullYear(), c.date.getMonth(), c.date.getDate(), 12)),
                      )}
                      className={cn(
                        'mx-auto flex size-9 flex-col items-center justify-center rounded-xl tabular-nums transition-colors',
                        c.isToday ? 'bg-coral font-semibold text-ink' : 'hover:bg-bg/60',
                        !c.inMonth && 'text-ink-2/60',
                      )}
                    >
                      <span className="leading-none">{formatDayNumber(c.date, locale)}</span>
                      <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
                        {colors.slice(0, 3).map((col, i) => (
                          <span key={i} className="size-1.5 rounded-full" style={{ background: col }} />
                        ))}
                      </span>
                    </a>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only">{timeZone}</p>
    </WidgetFrame>
  );
}

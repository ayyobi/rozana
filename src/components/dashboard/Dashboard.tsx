import type { ReactNode } from 'react';
import { useTranslations, type Locale } from '@/i18n';
import type { DashboardData } from '@/types/dashboard';
import { AgendaWidget, FinanceWidget, HabitsWidget, PrioritiesWidget, ProjectsWidget } from './widgets';
import { MiniCalendar } from './MiniCalendar';
import { DEFAULT_LAYOUT, type WidgetId, type WidgetLayout } from './registry';
import { cn } from '@/lib/utils/cn';

const SPAN: Record<WidgetLayout['size'], string> = {
  sm: 'lg:col-span-4',
  md: 'lg:col-span-6',
  lg: 'lg:col-span-8',
  full: 'lg:col-span-12',
};

export default function Dashboard({
  locale,
  data,
  todayIso,
  timeZone,
  preview,
  layout = DEFAULT_LAYOUT,
}: {
  locale: Locale;
  data: DashboardData;
  todayIso: string;
  timeZone: string;
  preview: boolean;
  layout?: WidgetLayout[];
}) {
  const t = useTranslations(locale);
  const render: Record<WidgetId, () => ReactNode> = {
    priorities: () => <PrioritiesWidget items={data.priorities} t={t} interactive={preview} />,
    planning: () => <AgendaWidget items={data.agenda} t={t} />,
    calendar: () => <MiniCalendar locale={locale} todayIso={todayIso} timeZone={timeZone} dots={data.calendarDots} />,
    projects: () => <ProjectsWidget items={data.projects} t={t} />,
    habits: () => <HabitsWidget items={data.habits} t={t} interactive={preview} />,
    finances: () => <FinanceWidget data={data.finance} t={t} locale={locale} />,
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
      {layout
        .filter((w) => w.visible)
        .sort((a, b) => a.order - b.order)
        .map((w, i) => (
          <div
            key={w.id}
            className={cn(SPAN[w.size], w.size === 'full' && 'md:col-span-2')}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {render[w.id]()}
          </div>
        ))}
    </div>
  );
}

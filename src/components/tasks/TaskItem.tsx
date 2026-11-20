import { useEffect, useRef, useState } from 'react';
import { CalendarClock, CalendarDays, Clock, Copy, Ellipsis, FolderHeart, ListChecks, Pencil, Repeat, Trash2, TriangleAlert } from 'lucide-react';
import { Badge, RoundCheckbox } from '@/components/ui/primitives';
import { useTranslations, type Locale } from '@/i18n';
import { fmtDay, fmtTime } from '@/lib/utils/format';
import { isOverdue } from '@/lib/planning/tasks';
import { cn } from '@/lib/utils/cn';
import type { Category, Project, Task } from '@/types/models';

type T = ReturnType<typeof useTranslations>;

const PRIO_TONE = { low: 'sage', normal: 'neutral', high: 'apricot', urgent: 'danger' } as const;

export function TaskItem({
  task,
  today,
  locale,
  t,
  category,
  project,
  subCount,
  onToggle,
  onEdit,
  onDuplicate,
  onPostpone,
  onDelete,
}: {
  task: Task;
  today: string;
  locale: Locale;
  t: T;
  category?: Category | undefined;
  project?: Project | undefined;
  subCount?: { done: number; total: number } | undefined;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onPostpone: (mode: 'tomorrow' | 'nextWeek' | 'pick') => void;
  onDelete: () => void;
}) {
  const done = task.status === 'done';
  const cancelled = task.status === 'cancelled';
  const overdue = isOverdue(task, today);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);

  return (
    <li className={cn('group flex items-start gap-3 rounded-2xl bg-white/60 px-3.5 py-3 transition-colors hover:bg-white/85', overdue && 'ring-1 ring-danger/30')}>
      <div className="pt-0.5">
        <RoundCheckbox checked={done} label={task.title} onChange={onToggle} disabled={cancelled} />
      </div>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-start">
        <p className={cn('font-medium break-words', (done || cancelled) && 'text-ink-2 line-through decoration-coral-strong/60')}>{task.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
          {category && <Badge style={{ background: category.color || undefined }}>{category.name}</Badge>}
          <Badge tone={PRIO_TONE[task.priority]}>{t(`priority.${task.priority}`)}</Badge>
          {task.status === 'in_progress' && <Badge tone="peach">{t('status.in_progress')}</Badge>}
          {cancelled && <Badge>{t('status.cancelled')}</Badge>}
          {project && (
            <span className="inline-flex items-center gap-1">
              <FolderHeart className="size-3.5" aria-hidden />
              {project.name}
            </span>
          )}
          {task.start_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {fmtDay(task.start_date, locale, 'short')}
              {task.start_time && ` · ${fmtTime(task.start_time, locale)}`}
            </span>
          )}
          {task.deadline && (
            <span className={cn('inline-flex items-center gap-1', overdue && 'font-semibold text-danger')}>
              {overdue ? <TriangleAlert className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
              {t('tasks.due', { date: fmtDay(task.deadline, locale, 'short') })}
            </span>
          )}
          {subCount && subCount.total > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3.5" aria-hidden />
              {t('tasks.subtaskCount', subCount)}
            </span>
          )}
          {task.recurrence && <Repeat className="size-3.5" aria-label={t('fields.recurrence')} />}
          {done && task.completed_at && <span>{t('tasks.completedOn', { date: fmtDay(task.completed_at.slice(0, 10), locale, 'short') })}</span>}
        </div>
      </button>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenu(!menu)}
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label={t('actions.more')}
          className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-ink/5"
        >
          <Ellipsis className="size-5" aria-hidden />
        </button>
        {menu && (
          <div role="menu" className="absolute end-0 top-10 z-30 w-56 animate-pop rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
            <MenuItem icon={Pencil} label={t('actions.edit')} onClick={() => { setMenu(false); onEdit(); }} />
            <MenuItem icon={Copy} label={t('actions.duplicate')} onClick={() => { setMenu(false); onDuplicate(); }} />
            {!done && (
              <>
                <p className="px-3 pt-2 pb-1 text-xs font-medium text-ink-2">{t('actions.postpone')}</p>
                <MenuItem icon={CalendarClock} label={t('actions.tomorrow')} onClick={() => { setMenu(false); onPostpone('tomorrow'); }} />
                <MenuItem icon={CalendarClock} label={t('actions.nextWeek')} onClick={() => { setMenu(false); onPostpone('nextWeek'); }} />
                <MenuItem icon={CalendarDays} label={t('actions.pickDate')} onClick={() => { setMenu(false); onPostpone('pick'); }} />
              </>
            )}
            <div className="my-1 h-px bg-line" />
            <MenuItem icon={Trash2} label={t('actions.delete')} danger onClick={() => { setMenu(false); onDelete(); }} />
          </div>
        )}
      </div>
    </li>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm hover:bg-bg/60', danger && 'text-danger')}>
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

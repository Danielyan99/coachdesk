import { DAY_NAMES, type ClientDayDto } from '@coachdesk/shared';
import { useState } from 'react';
import { cx, EmptyState, ErrorState, FormError, Skeleton } from '../../components/ui';
import { useCheckOff, useWeek } from '../../lib/clientQueries';
import { plural, shortDate } from '../../lib/format';
import { Checklist, doneCount, itemCount } from './Checklist';

/** Monday to Sunday. Today and yesterday can still be ticked; other days are view-only. */
export function WeekPage() {
  const week = useWeek();
  const checkOff = useCheckOff();
  const [open, setOpen] = useState<string | null>(null);

  if (week.isPending) {
    return (
      <div role="status" aria-label="Loading week" className="flex flex-col gap-3 pt-4">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }
  if (week.isError) return <ErrorState error={week.error} onRetry={() => void week.refetch()} />;

  const { days, today, editableDates, planName } = week.data;
  const expanded = open ?? today;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">This week</h1>
        {planName && <p className="text-sm text-ink-muted">{planName}</p>}
      </div>
      <FormError message={checkOff.error ? `Couldn't save that: ${checkOff.error.message}` : null} />
      {days.length === 0 ? (
        <EmptyState title="No plan yet" text="Your trainer hasn't set up your weekly plan yet." />
      ) : (
        <ol className="flex flex-col gap-2">
          {days.map((day) => (
            <DayRow
              key={day.date}
              day={day}
              isToday={day.date === today}
              isPast={day.date < today}
              editable={editableDates.includes(day.date) && !day.beforeStart}
              expanded={expanded === day.date}
              onToggleOpen={() => setOpen(expanded === day.date ? '' : day.date)}
              onCheck={(itemId, done) => checkOff.mutate({ date: day.date, itemId, done })}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function DayRow({
  day,
  isToday,
  isPast,
  editable,
  expanded,
  onToggleOpen,
  onCheck,
}: {
  day: ClientDayDto;
  isToday: boolean;
  isPast: boolean;
  editable: boolean;
  expanded: boolean;
  onToggleOpen: () => void;
  onCheck: (itemId: string, done: boolean) => void;
}) {
  const total = itemCount(day);
  const done = doneCount(day);
  const panelId = `day-${day.date}`;
  const summary = day.beforeStart
    ? 'Before your plan starts'
    : [day.workout ? day.workout.title : 'Rest day', plural(day.meals.length, 'meal')].join(' · ');

  return (
    <li className={cx('card overflow-hidden', isToday && 'border-accent/50 ring-1 ring-accent/30')}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggleOpen}
        className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left"
      >
        <span className="w-12 shrink-0">
          <span className="block text-sm font-semibold">{DAY_NAMES[day.weekday].slice(0, 3)}</span>
          <span className="block text-xs text-ink-muted">{shortDate(day.date).split(', ')[1]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {isToday && <span className="mr-1.5 text-accent">Today ·</span>}
            {summary}
          </span>
          {!day.beforeStart && (isPast || isToday) && total > 0 && (
            <span className="mt-1 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
                <span
                  className="block h-full rounded-full bg-on-track transition-[width]"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </span>
              <span className="text-xs tabular-nums text-ink-muted">
                {done}/{total}
              </span>
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className={cx('size-5 shrink-0 text-ink-muted transition', expanded && 'rotate-180')}
        >
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {expanded && (
        <div id={panelId} className="border-t border-line bg-page/60 px-3 py-4">
          {!editable && !day.beforeStart && (
            <p className="mb-3 px-1 text-xs text-ink-muted">
              {isPast ? 'Only today and yesterday can be changed.' : 'You can tick these off on the day.'}
            </p>
          )}
          <Checklist day={day} editable={editable} onToggle={onCheck} />
        </div>
      )}
    </li>
  );
}

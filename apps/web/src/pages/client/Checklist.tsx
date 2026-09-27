import type { ClientDayDto, Exercise, Meal } from '@coachdesk/shared';
import { cx } from '../../components/ui';
import { plural } from '../../lib/format';

export function itemCount(day: ClientDayDto): number {
  return (day.workout?.exercises.length ?? 0) + day.meals.length;
}

/** Done ids that are still on the plan (a trainer may have edited the day since). */
export function doneCount(day: ClientDayDto): number {
  const ids = new Set([...(day.workout?.exercises ?? []).map((e) => e.id), ...day.meals.map((m) => m.id)]);
  return day.done.filter((id) => ids.has(id)).length;
}

function exerciseDetail(e: Exercise): string {
  return [`${e.sets} × ${e.reps}`, e.restSec ? `${e.restSec} s rest` : null].filter(Boolean).join(' · ');
}

function mealDetail(m: Meal): string | null {
  return [m.time, m.kcal ? `${m.kcal} kcal` : null].filter(Boolean).join(' · ') || null;
}

/**
 * The workout and meals of one day as big checkboxes (easy to hit on a phone).
 * Real <input type="checkbox"> elements, so keyboard and screen readers work without extra code.
 */
export function Checklist({
  day,
  editable,
  onToggle,
}: {
  day: ClientDayDto;
  editable: boolean;
  onToggle: (itemId: string, done: boolean) => void;
}) {
  const done = new Set(day.done);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`workout-${day.date}`}>
        <h3 id={`workout-${day.date}`} className="mb-2 text-sm font-semibold tracking-wide text-ink-muted uppercase">
          {day.workout ? `Workout · ${day.workout.title}` : 'Workout'}
        </h3>
        {day.workout ? (
          <ul className="flex flex-col gap-2">
            {day.workout.exercises.map((e) => (
              <CheckRow
                key={e.id}
                checked={done.has(e.id)}
                disabled={!editable}
                title={e.name}
                detail={exerciseDetail(e)}
                note={e.notes}
                onChange={(checked) => onToggle(e.id, checked)}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-card px-4 py-4 text-sm text-ink-muted">
            Rest day. Recovery is part of the plan.
          </p>
        )}
      </section>

      <section aria-labelledby={`meals-${day.date}`}>
        <h3 id={`meals-${day.date}`} className="mb-2 text-sm font-semibold tracking-wide text-ink-muted uppercase">
          Meals
        </h3>
        {day.meals.length ? (
          <ul className="flex flex-col gap-2">
            {day.meals.map((m) => (
              <CheckRow
                key={m.id}
                checked={done.has(m.id)}
                disabled={!editable}
                title={m.name}
                detail={mealDetail(m)}
                note={m.description}
                onChange={(checked) => onToggle(m.id, checked)}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-card px-4 py-4 text-sm text-ink-muted">No meals planned.</p>
        )}
      </section>
    </div>
  );
}

function CheckRow({
  checked,
  disabled,
  title,
  detail,
  note,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  title: string;
  detail: string | null;
  note?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <li>
      <label
        className={cx(
          'flex min-h-16 items-start gap-4 rounded-2xl border bg-card px-4 py-3.5 transition',
          checked ? 'border-on-track/40 bg-on-track/[0.04]' : 'border-line',
          disabled ? 'cursor-default' : 'cursor-pointer active:scale-[0.99] hover:border-ink-faint',
        )}
      >
        <span className="relative mt-0.5 flex size-7 shrink-0">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="peer size-7 cursor-pointer appearance-none rounded-lg border-2 border-ink-faint bg-card transition checked:border-on-track checked:bg-on-track disabled:cursor-default"
          />
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden size-7 text-white peer-checked:block"
          >
            <path
              d="M6.5 12.5l3.5 3.5 7.5-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx('block font-medium', checked && 'text-ink-muted line-through decoration-ink-faint')}>
            {title}
          </span>
          {detail && <span className="mt-0.5 block text-sm text-ink-muted">{detail}</span>}
          {note && <span className="mt-1 block text-sm text-ink-muted">{note}</span>}
        </span>
      </label>
    </li>
  );
}

export function ProgressRing({ done, total }: { done: number; total: number }) {
  const ratio = total ? done / total : 0;
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const complete = total > 0 && done === total;
  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 72 72"
        className="size-20 shrink-0 -rotate-90"
        role="img"
        aria-label={`${done} of ${total} done`}
      >
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-ink/[0.08]" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="text-on-track transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div aria-live="polite">
        <p className="text-2xl font-bold tabular-nums">
          {done} of {total} done
        </p>
        <p className="text-sm text-ink-muted">
          {complete
            ? 'All done for today. Great work!'
            : total
              ? `${plural(total - done, 'item')} to go`
              : 'Nothing planned'}
        </p>
      </div>
    </div>
  );
}

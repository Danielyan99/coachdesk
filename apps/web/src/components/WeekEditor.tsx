import { DAY_NAMES, type Exercise, type Meal, type PlanDay } from '@coachdesk/shared';
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { newId } from '../lib/format';
import { Button, cx, Field, Input, Select, Textarea } from './ui';

/** Errors keyed by path inside the week, e.g. "2.workout.exercises.0.name". */
export type WeekErrors = Record<string, string>;

function blankExercise(): Exercise {
  return { id: newId(), name: '', sets: 3, reps: '10', restSec: null };
}

function blankMeal(): Meal {
  return { id: newId(), name: '', time: null, description: '', kcal: null };
}

/** A copy of a day with fresh item ids (every id must be unique in the week). */
function cloneDay(day: PlanDay): PlanDay {
  return {
    workout: day.workout
      ? { ...day.workout, exercises: day.workout.exercises.map((e) => ({ ...e, id: newId() })) }
      : null,
    meals: day.meals.map((m) => ({ ...m, id: newId() })),
  };
}

function toNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}

function numberValue(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '' : String(value);
}

export function WeekEditor({
  days,
  onChange,
  errors = {},
}: {
  days: PlanDay[];
  onChange: (days: PlanDay[]) => void;
  errors?: WeekErrors;
}) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const day = days[active];
  const err = (path: string) => errors[`${active}.${path}`];
  const dayHasError = (d: number) => Object.keys(errors).some((k) => k.startsWith(`${d}.`));

  const setDay = (next: PlanDay) => onChange(days.map((d, i) => (i === active ? next : d)));
  const setWorkout = (workout: PlanDay['workout']) => setDay({ ...day, workout });
  const setExercise = (index: number, patch: Partial<Exercise>) =>
    day.workout &&
    setWorkout({
      ...day.workout,
      exercises: day.workout.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    });
  const moveExercise = (index: number, by: -1 | 1) => {
    if (!day.workout) return;
    const exercises = [...day.workout.exercises];
    const [item] = exercises.splice(index, 1);
    exercises.splice(index + by, 0, item);
    setWorkout({ ...day.workout, exercises });
  };
  const setMeal = (index: number, patch: Partial<Meal>) =>
    setDay({ ...day, meals: day.meals.map((m, i) => (i === index ? { ...m, ...patch } : m)) });

  const copyTo = (target: number | 'all') => {
    onChange(days.map((d, i) => (i !== active && (target === 'all' || target === i) ? cloneDay(day) : d)));
  };

  /** Arrow keys move between day tabs (standard tab pattern). */
  const onTabKey = (e: KeyboardEvent) => {
    const move = { ArrowRight: 1, ArrowLeft: -1, Home: -active, End: 6 - active }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    const next = (active + move + 7) % 7;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Days of the week"
        onKeyDown={onTabKey}
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:px-0"
      >
        {days.map((d, i) => (
          <button
            key={DAY_NAMES[i]}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${baseId}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cx(
              'relative flex min-h-14 min-w-16 shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-sm transition',
              i === active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-card hover:border-ink-faint',
            )}
          >
            <span className="font-semibold">{DAY_NAMES[i].slice(0, 3)}</span>
            <span className={cx('text-xs', i === active ? 'text-accent' : 'text-ink-muted')}>
              {d.workout ? 'Workout' : 'Rest'} · {d.meals.length}
              <span className="sr-only"> meals</span>
            </span>
            {dayHasError(i) && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-behind">
                <span className="sr-only">(has errors)</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{DAY_NAMES[active]}</h3>
          <CopyDay active={active} onCopy={copyTo} />
        </div>

        {/* Workout */}
        <section aria-label={`${DAY_NAMES[active]} workout`} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">Workout</h4>
            {day.workout && (
              <Button variant="ghost" size="sm" onClick={() => setWorkout(null)}>
                Make it a rest day
              </Button>
            )}
          </div>
          {day.workout ? (
            <>
              <Field label="Workout title" error={err('workout.title')}>
                {(a) => (
                  <Input
                    {...a}
                    value={day.workout!.title}
                    placeholder="e.g. Upper body"
                    onChange={(e) => setWorkout({ ...day.workout!, title: e.target.value })}
                  />
                )}
              </Field>
              {err('workout.exercises') && (
                <p className="text-xs font-medium text-behind">{err('workout.exercises')}</p>
              )}
              <ol className="flex flex-col gap-3">
                {day.workout.exercises.map((ex, i) => (
                  <li key={ex.id} className="rounded-xl border border-line p-3">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-[1fr_5rem_6rem_6rem]">
                      <Field
                        label={`Exercise ${i + 1}`}
                        error={err(`workout.exercises.${i}.name`)}
                        className="col-span-3 sm:col-span-1"
                      >
                        {(a) => (
                          <Input
                            {...a}
                            value={ex.name}
                            placeholder="e.g. Goblet squat"
                            onChange={(e) => setExercise(i, { name: e.target.value })}
                          />
                        )}
                      </Field>
                      <Field label="Sets" error={err(`workout.exercises.${i}.sets`)}>
                        {(a) => (
                          <Input
                            {...a}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={20}
                            value={numberValue(ex.sets)}
                            onChange={(e) => setExercise(i, { sets: toNumber(e.target.value) ?? Number.NaN })}
                          />
                        )}
                      </Field>
                      <Field label="Reps" error={err(`workout.exercises.${i}.reps`)}>
                        {(a) => (
                          <Input
                            {...a}
                            value={ex.reps}
                            placeholder="8-12"
                            onChange={(e) => setExercise(i, { reps: e.target.value })}
                          />
                        )}
                      </Field>
                      <Field label="Rest (s)" error={err(`workout.exercises.${i}.restSec`)}>
                        {(a) => (
                          <Input
                            {...a}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={numberValue(ex.restSec)}
                            onChange={(e) => setExercise(i, { restSec: toNumber(e.target.value) })}
                          />
                        )}
                      </Field>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        aria-label={`Exercise ${i + 1} notes`}
                        value={ex.notes ?? ''}
                        placeholder="Notes (optional), e.g. slow on the way down"
                        className="min-w-0 flex-1"
                        onChange={(e) => setExercise(i, { notes: e.target.value })}
                      />
                      <div className="flex gap-1">
                        <IconButton
                          label={`Move exercise ${i + 1} up`}
                          disabled={i === 0}
                          onClick={() => moveExercise(i, -1)}
                        >
                          ↑
                        </IconButton>
                        <IconButton
                          label={`Move exercise ${i + 1} down`}
                          disabled={i === day.workout!.exercises.length - 1}
                          onClick={() => moveExercise(i, 1)}
                        >
                          ↓
                        </IconButton>
                        <IconButton
                          label={`Remove exercise ${i + 1}`}
                          onClick={() =>
                            setWorkout({ ...day.workout!, exercises: day.workout!.exercises.filter((_, j) => j !== i) })
                          }
                        >
                          ✕
                        </IconButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => setWorkout({ ...day.workout!, exercises: [...day.workout!.exercises, blankExercise()] })}
              >
                + Add exercise
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink/[0.03] px-4 py-3">
              <p className="text-sm text-ink-muted">Rest day: no workout.</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setWorkout({ title: '', exercises: [blankExercise()] })}
              >
                + Add a workout
              </Button>
            </div>
          )}
        </section>

        {/* Meals */}
        <section aria-label={`${DAY_NAMES[active]} meals`} className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">Meals</h4>
          {day.meals.length === 0 && <p className="text-sm text-ink-muted">No meals planned for this day.</p>}
          <ol className="flex flex-col gap-3">
            {day.meals.map((meal, i) => (
              <li key={meal.id} className="rounded-xl border border-line p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_6rem_auto] sm:items-end">
                  <Field label={`Meal ${i + 1}`} error={err(`meals.${i}.name`)} className="col-span-2 sm:col-span-1">
                    {(a) => (
                      <Input
                        {...a}
                        value={meal.name}
                        placeholder="e.g. Breakfast"
                        onChange={(e) => setMeal(i, { name: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Time" error={err(`meals.${i}.time`)}>
                    {(a) => (
                      <Input
                        {...a}
                        type="time"
                        value={meal.time ?? ''}
                        onChange={(e) => setMeal(i, { time: e.target.value || null })}
                      />
                    )}
                  </Field>
                  <Field label="kcal" error={err(`meals.${i}.kcal`)}>
                    {(a) => (
                      <Input
                        {...a}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={numberValue(meal.kcal)}
                        onChange={(e) => setMeal(i, { kcal: toNumber(e.target.value) })}
                      />
                    )}
                  </Field>
                  <div className="col-span-2 flex justify-end sm:col-span-1">
                    <IconButton
                      label={`Remove meal ${i + 1}`}
                      onClick={() => setDay({ ...day, meals: day.meals.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </IconButton>
                  </div>
                </div>
                <Textarea
                  aria-label={`Meal ${i + 1} description`}
                  className="mt-2"
                  rows={2}
                  value={meal.description}
                  placeholder="What to eat, e.g. oats with berries and yogurt"
                  onChange={(e) => setMeal(i, { description: e.target.value })}
                />
              </li>
            ))}
          </ol>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setDay({ ...day, meals: [...day.meals, blankMeal()] })}
          >
            + Add meal
          </Button>
        </section>
      </div>
    </div>
  );
}

function CopyDay({ active, onCopy }: { active: number; onCopy: (target: number | 'all') => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Copy this day to"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-auto min-w-40 py-2"
      >
        <option value="">Copy this day to…</option>
        <option value="all">All other days</option>
        {DAY_NAMES.map((name, i) =>
          i === active ? null : (
            <option key={name} value={i}>
              {name}
            </option>
          ),
        )}
      </Select>
      <Button
        variant="secondary"
        size="sm"
        disabled={!value}
        onClick={() => {
          onCopy(value === 'all' ? 'all' : Number(value));
          setValue('');
        }}
      >
        Copy
      </Button>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-lg text-ink-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

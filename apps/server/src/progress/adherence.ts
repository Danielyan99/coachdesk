import {
  ADHERENCE_THRESHOLDS,
  ADHERENCE_WINDOW_DAYS,
  type AdherenceDayDto,
  type AdherenceDto,
  type AdherenceStatus,
  type PlanDay,
} from '@coachdesk/shared';
import { datesEndingWith, weekdayOf } from './dates';

export interface AdherenceInput {
  /** The client's active plan, or null. */
  plan: { startDate: string; days: PlanDay[] } | null;
  /** Check-offs (any dates; only the window counts). */
  checkIns: { date: string; itemId: string }[];
  /** Today in the client's time zone. */
  today: string;
}

/** Exercise and meal ids scheduled on a plan day. */
export function itemIdsOf(day: PlanDay): string[] {
  return [...(day.workout?.exercises ?? []).map((e) => e.id), ...day.meals.map((m) => m.id)];
}

export function statusFor(ratio: number): AdherenceStatus {
  if (ratio >= ADHERENCE_THRESHOLDS.onTrack) return 'on-track';
  if (ratio >= ADHERENCE_THRESHOLDS.atRisk) return 'at-risk';
  return 'behind';
}

/**
 * The "on track" rule. Looks at the last 7 days ending today, only from the plan's start date on.
 * A past day counts all its scheduled items. Today counts only the items already done, so a client
 * is never "behind" at 9 am for items they still have the whole day to do.
 */
export function computeAdherence({ plan, checkIns, today }: AdherenceInput): AdherenceDto {
  const window = datesEndingWith(today, ADHERENCE_WINDOW_DAYS);
  const doneByDate = new Map<string, Set<string>>();
  for (const c of checkIns) {
    if (!doneByDate.has(c.date)) doneByDate.set(c.date, new Set());
    doneByDate.get(c.date)!.add(c.itemId);
  }

  const days: AdherenceDayDto[] = window.map((date) => {
    const isToday = date === today;
    const beforeStart = !plan || date < plan.startDate;
    if (beforeStart) return { date, scheduled: 0, done: 0, beforeStart: true, isToday };

    const items = itemIdsOf(plan.days[weekdayOf(date)]);
    const doneSet = doneByDate.get(date);
    // Only check-offs of items that are really on the plan that day count (not stale ids from an edited plan).
    const done = doneSet ? items.filter((id) => doneSet.has(id)).length : 0;
    return { date, scheduled: isToday ? done : items.length, done, beforeStart: false, isToday };
  });

  const scheduled = days.reduce((sum, d) => sum + d.scheduled, 0);
  const done = days.reduce((sum, d) => sum + d.done, 0);
  if (!plan) return { status: 'no-plan', done: 0, scheduled: 0, ratio: null, days };
  if (scheduled === 0) return { status: 'no-data', done, scheduled, ratio: null, days };
  const ratio = done / scheduled;
  return { status: statusFor(ratio), done, scheduled, ratio, days };
}

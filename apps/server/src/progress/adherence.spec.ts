import { emptyWeek, type PlanDay } from '@coachdesk/shared';
import { computeAdherence, statusFor } from './adherence';

/** Every day: one exercise and one meal, ids "ex-<weekday>" and "meal-<weekday>". */
function dailyWeek(): PlanDay[] {
  return emptyWeek().map((_, d) => ({
    workout: { title: 'Walk', exercises: [{ id: `ex-${d}`, name: 'Walk', sets: 1, reps: '30 min' }] },
    meals: [{ id: `meal-${d}`, name: 'Lunch', description: '' }],
  }));
}

// 2026-09-28 is a Monday. The 7-day window ending Sunday 2026-10-04 is exactly Mon..Sun.
const TODAY = '2026-10-04';
const WEEK = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];

/** Check off both items on the given dates (all inside WEEK, where index = weekday). */
function doneOn(dates: string[]) {
  return dates.flatMap((date) => {
    const d = WEEK.indexOf(date);
    return [
      { date, itemId: `ex-${d}` },
      { date, itemId: `meal-${d}` },
    ];
  });
}

describe('statusFor (thresholds)', () => {
  it.each([
    [1, 'on-track'],
    [0.8, 'on-track'],
    [0.79, 'at-risk'],
    [0.5, 'at-risk'],
    [0.49, 'behind'],
    [0, 'behind'],
  ])('%s is %s', (ratio, status) => {
    expect(statusFor(ratio)).toBe(status);
  });
});

describe('computeAdherence', () => {
  const plan = { startDate: '2026-09-01', days: dailyWeek() };

  it('is no-plan without a plan', () => {
    const result = computeAdherence({ plan: null, checkIns: [], today: TODAY });
    expect(result).toMatchObject({ status: 'no-plan', ratio: null });
    expect(result.days).toHaveLength(7);
  });

  it('counts 6 past days fully and today only for what is done', () => {
    // Past 6 days: 12 scheduled. All done, nothing yet today.
    const result = computeAdherence({ plan, checkIns: doneOn(WEEK.slice(0, 6)), today: TODAY });
    expect(result).toMatchObject({ status: 'on-track', done: 12, scheduled: 12, ratio: 1 });
    expect(result.days[6]).toEqual({ date: TODAY, scheduled: 0, done: 0, beforeStart: false, isToday: true });
  });

  it('today helps once done', () => {
    const result = computeAdherence({ plan, checkIns: doneOn(WEEK), today: TODAY });
    expect(result).toMatchObject({ done: 14, scheduled: 14 });
  });

  it('is at risk at 50-79% and behind below 50%', () => {
    // 4 of 6 past days done = 8 / 12 = 67%
    expect(computeAdherence({ plan, checkIns: doneOn(WEEK.slice(0, 4)), today: TODAY }).status).toBe('at-risk');
    // 2 of 6 = 33%
    expect(computeAdherence({ plan, checkIns: doneOn(WEEK.slice(0, 2)), today: TODAY }).status).toBe('behind');
  });

  it('ignores days before the plan started', () => {
    // Plan started Friday: only Fri, Sat (past) and Sun (today) count.
    const late = { ...plan, startDate: '2026-10-02' };
    const result = computeAdherence({ plan: late, checkIns: doneOn(['2026-10-02', '2026-10-03']), today: TODAY });
    expect(result).toMatchObject({ status: 'on-track', done: 4, scheduled: 4 });
    expect(result.days.filter((d) => d.beforeStart)).toHaveLength(4);
  });

  it('is no-data on the first day with nothing done yet, and for a week of rest days', () => {
    const startsToday = { ...plan, startDate: TODAY };
    expect(computeAdherence({ plan: startsToday, checkIns: [], today: TODAY }).status).toBe('no-data');
    const rest = { startDate: '2026-09-01', days: emptyWeek() };
    expect(computeAdherence({ plan: rest, checkIns: [], today: TODAY }).status).toBe('no-data');
  });

  it('ignores check-ins for items that are not on that day of the plan', () => {
    const stale = [
      { date: WEEK[0], itemId: 'deleted-item' },
      { date: WEEK[0], itemId: 'ex-3' }, // Thursday's item on a Monday
      { date: '2026-09-01', itemId: 'ex-1' }, // outside the window
    ];
    expect(computeAdherence({ plan, checkIns: stale, today: TODAY })).toMatchObject({ done: 0, status: 'behind' });
  });

  it('counts only scheduled days (rest days do not lower the score)', () => {
    const days = dailyWeek();
    days[5] = { workout: null, meals: [] }; // Saturday off
    const result = computeAdherence({ plan: { ...plan, days }, checkIns: doneOn(WEEK.slice(0, 5)), today: TODAY });
    expect(result).toMatchObject({ done: 10, scheduled: 10, status: 'on-track' });
  });
});

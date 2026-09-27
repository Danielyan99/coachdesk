import type { ClientStats, Exercise, Meal, PlanDay } from '@coachdesk/shared';
import { itemIdsOf } from '../progress/adherence';
import { addDays, todayIn, weekdayOf } from '../progress/dates';

// Pure data builder for the demo sandbox and `npm run seed`: a trainer with 8 clients whose adherence covers
// every status, 3 templates, and about 2.5 weeks of check-in history. No database code here, so it can be
// unit-tested; DemoService adds ids, owners and expiry, then inserts it.

let itemSeq = 0;
const id = (prefix: string) => `${prefix}-${(++itemSeq).toString(36)}`;

const ex = (name: string, sets: number, reps: string, restSec?: number, notes?: string): Exercise => ({
  id: id('ex'),
  name,
  sets,
  reps,
  restSec: restSec ?? null,
  ...(notes ? { notes } : {}),
});

const meal = (name: string, time: string, description: string, kcal: number): Meal => ({
  id: id('meal'),
  name,
  time,
  description,
  kcal,
});

const BREAKFASTS = [
  'Oats with berries, Greek yogurt and a spoon of peanut butter',
  'Two eggs, wholegrain toast and an apple',
  'Cottage cheese with banana and walnuts',
];
const LUNCHES = ['Chicken, rice and a big salad', 'Lentil soup with bread and feta', 'Tuna wrap with vegetables'];
const DINNERS = ['Salmon, potatoes and greens', 'Turkey chili with beans', 'Tofu stir-fry with noodles'];

function standardMeals(day: number, withSnack = false): Meal[] {
  return [
    meal('Breakfast', '08:00', BREAKFASTS[day % 3], 450),
    meal('Lunch', '13:00', LUNCHES[day % 3], 650),
    ...(withSnack ? [meal('Snack', '16:30', 'Protein shake or a handful of nuts', 200)] : []),
    meal('Dinner', '19:30', DINNERS[day % 3], 600),
  ];
}

/** Days are Monday..Sunday; `workouts` maps a weekday index to a workout builder. */
function week(workouts: Record<number, () => PlanDay['workout']>, withSnack = false): PlanDay[] {
  return Array.from({ length: 7 }, (_, d) => ({
    workout: workouts[d]?.() ?? null,
    meals: standardMeals(d, withSnack),
  }));
}

export interface DemoTemplate {
  key: 'strength' | 'fatLoss' | 'busy';
  name: string;
  description: string;
  days: () => PlanDay[];
}

export const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    key: 'strength',
    name: 'Beginner strength (3 days)',
    description: 'Full body, Monday / Wednesday / Friday. For clients new to the gym.',
    days: () => {
      const a = () => ({
        title: 'Full body A',
        exercises: [
          ex('Goblet squat', 3, '10', 90),
          ex('Push-up', 3, '8-12', 60),
          ex('Dumbbell row', 3, '10 each side', 60),
        ],
      });
      const b = () => ({
        title: 'Full body B',
        exercises: [ex('Romanian deadlift', 3, '10', 90), ex('Overhead press', 3, '8', 60), ex('Plank', 3, '30 s', 45)],
      });
      return week({ 0: a, 2: b, 4: a });
    },
  },
  {
    key: 'fatLoss',
    name: 'Fat loss: strength + cardio',
    description: 'Two strength days and two cardio days, with a daily snack to keep hunger low.',
    days: () =>
      week(
        {
          0: () => ({
            title: 'Lower body',
            exercises: [
              ex('Leg press', 4, '12', 90),
              ex('Walking lunge', 3, '10 each leg', 60),
              ex('Calf raise', 3, '15', 45),
            ],
          }),
          1: () => ({
            title: 'Cardio',
            exercises: [ex('Brisk walk or bike', 1, '35 min', undefined, 'You should still be able to talk')],
          }),
          3: () => ({
            title: 'Upper body',
            exercises: [
              ex('Lat pulldown', 4, '10', 90),
              ex('Incline push-up', 3, '12', 60),
              ex('Face pull', 3, '15', 45),
            ],
          }),
          5: () => ({ title: 'Long cardio', exercises: [ex('Hike, swim or bike', 1, '60 min')] }),
        },
        true,
      ),
  },
  {
    key: 'busy',
    name: 'Busy schedule: 20-minute workouts',
    description: 'Short home workouts on weekdays. No equipment needed.',
    days: () => {
      const circuit = (title: string) => () => ({
        title,
        exercises: [ex('Bodyweight squat', 3, '15', 30), ex('Push-up', 3, '10', 30), ex('Glute bridge', 3, '15', 30)],
      });
      return week({
        0: circuit('Circuit A'),
        1: circuit('Circuit B'),
        2: circuit('Circuit A'),
        3: circuit('Circuit B'),
        4: circuit('Circuit A'),
      });
    },
  },
];

export interface DemoClient {
  name: string;
  goals: string;
  notes: string;
  stats: ClientStats;
  timezone: string;
  /** Which template the plan is copied from (null = no plan). */
  template: DemoTemplate['key'] | null;
  /** Share of scheduled items done in the past. */
  ratio: number;
  /** No check-ins in the last N days (a client who stopped). */
  quietDays?: number;
  /** Plan start, days before today. */
  startedDaysAgo: number;
  /** This client gets a login: "Try as a client" logs in as them. */
  login?: boolean;
  /** An invite link is waiting for this client. */
  invited?: boolean;
  /** A trainer tweak on top of the template, to show that plans are per-client copies. */
  customize?: (days: PlanDay[]) => void;
  planName?: string;
}

export const DEMO_CLIENTS: DemoClient[] = [
  {
    name: 'Ana Petrosyan',
    goals: 'Get stronger and feel less tired at work',
    notes: 'Desk job. Prefers morning workouts.',
    stats: { weightKg: 64, heightCm: 168, bodyFatPct: 27 },
    timezone: 'Asia/Yerevan',
    template: 'strength',
    ratio: 0.95,
    startedDaysAgo: 18,
    login: true,
  },
  {
    name: 'Mark Chen',
    goals: 'Lose 6 kg before summer',
    notes: '',
    stats: { weightKg: 88, heightCm: 180 },
    timezone: 'Europe/London',
    template: 'fatLoss',
    ratio: 0.86,
    startedDaysAgo: 16,
    login: true,
  },
  {
    name: 'Sofia Rossi',
    goals: 'Run a half marathon in the spring',
    notes: 'Old knee injury: no jumping, no deep lunges.',
    stats: { weightKg: 58, heightCm: 165 },
    timezone: 'Europe/Rome',
    template: 'fatLoss',
    ratio: 0.66,
    startedDaysAgo: 17,
    login: true,
    planName: 'Fat loss (knee-friendly)',
    customize: (days) => {
      const lunge = days[0].workout?.exercises.find((e) => e.name === 'Walking lunge');
      if (lunge) Object.assign(lunge, { name: 'Step-up (low box)', notes: 'Instead of lunges, for the knee' });
    },
  },
  {
    name: 'James Walker',
    goals: 'Build muscle, 3 sessions a week',
    notes: 'Travels for work every other week.',
    stats: { weightKg: 76, heightCm: 183, bodyFatPct: 18 },
    timezone: 'America/New_York',
    template: 'strength',
    ratio: 0.55,
    startedDaysAgo: 14,
    login: true,
  },
  {
    name: 'Lena Müller',
    goals: 'Get back into a routine after the baby',
    notes: 'Short on time. Home workouts only.',
    stats: { weightKg: 71, heightCm: 170 },
    timezone: 'Europe/Berlin',
    template: 'busy',
    ratio: 0.45,
    quietDays: 4,
    startedDaysAgo: 18,
    login: true,
  },
  {
    name: 'Omar Haddad',
    goals: 'Lower blood pressure, eat better',
    notes: 'Doctor asked for moderate cardio only.',
    stats: { weightKg: 97, heightCm: 176 },
    timezone: 'Asia/Dubai',
    template: 'busy',
    ratio: 0.2,
    startedDaysAgo: 12,
    login: true,
  },
  {
    name: 'Nina Ivanova',
    goals: 'Tone up and learn good technique',
    notes: 'New client, first session done in person.',
    stats: { weightKg: 60, heightCm: 172 },
    timezone: 'Asia/Yerevan',
    template: 'strength',
    ratio: 0,
    startedDaysAgo: 0,
    invited: true,
  },
  {
    name: 'David Kim',
    goals: 'Consultation next week',
    notes: '',
    stats: {},
    timezone: 'Asia/Seoul',
    template: null,
    ratio: 0,
    startedDaysAgo: 0,
  },
];

export interface DemoCheckIn {
  date: string;
  itemId: string;
  itemType: 'exercise' | 'meal';
  completedAt: Date;
}

/**
 * Which items were done: a low-discrepancy sequence (golden ratio steps) spreads the misses evenly, so every
 * 7-day window lands close to `ratio` and the demo statuses are stable, not random.
 */
export function demoCheckIns(client: DemoClient, days: PlanDay[], now: Date): DemoCheckIn[] {
  const today = todayIn(client.timezone, now);
  const start = addDays(today, -client.startedDaysAgo);
  const result: DemoCheckIn[] = [];
  let k = 0;
  for (let date = start, daysAgo = client.startedDaysAgo; date <= today; date = addDays(date, 1), daysAgo--) {
    if (client.quietDays && daysAgo < client.quietDays) continue;
    const day = days[weekdayOf(date)];
    const isToday = date === today;
    for (const itemId of itemIdsOf(day)) {
      k += 1;
      if ((k * 0.618034) % 1 >= client.ratio) continue;
      // Today only the morning items are done so far.
      if (isToday && !day.meals.some((m) => m.id === itemId && m.time === '08:00')) continue;
      const itemType = day.meals.some((m) => m.id === itemId) ? 'meal' : 'exercise';
      // Noon UTC on that date is close enough for "last activity"; today's ticks were an hour ago.
      const completedAt = isToday ? new Date(now.getTime() - 3_600_000) : new Date(`${date}T12:00:00Z`);
      result.push({ date, itemId, itemType, completedAt });
    }
  }
  return result;
}

export function demoPlanStart(client: DemoClient, now: Date): string {
  return addDays(todayIn(client.timezone, now), -client.startedDaysAgo);
}

import { emptyWeek, type PlanDay } from '@coachdesk/shared';

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;

/** Monday, Wednesday, Friday workouts and two meals every day. Fresh item ids on every call. */
export function sampleWeek(): PlanDay[] {
  return emptyWeek().map((_, day) => ({
    workout:
      day % 2 === 0 && day < 6
        ? {
            title: `Full body ${day / 2 + 1}`,
            exercises: [
              { id: id('ex'), name: 'Squat', sets: 3, reps: '8-10', restSec: 90 },
              { id: id('ex'), name: 'Push-up', sets: 3, reps: '12' },
            ],
          }
        : null,
    meals: [
      { id: id('meal'), name: 'Breakfast', time: '08:00', description: 'Oats with berries', kcal: 450 },
      { id: id('meal'), name: 'Dinner', time: '19:00', description: 'Chicken, rice, salad', kcal: 700 },
    ],
  }));
}

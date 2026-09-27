import { z } from 'zod';

/** Index 0 is Monday, 6 is Sunday. A template and a client plan both have exactly 7 days. */
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** Item ids are made by the browser (crypto.randomUUID) and are what a check-in points to. */
export const itemIdSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[\w-]+$/, { error: 'Invalid id' });

export const exerciseSchema = z.object({
  id: itemIdSchema,
  name: z.string().trim().min(1, { error: 'Enter the exercise' }).max(80),
  sets: z.int({ error: 'Sets must be a whole number' }).min(1, { error: 'At least 1 set' }).max(20),
  /** Free text: "10", "8-12", "30 s", "max". */
  reps: z.string().trim().min(1, { error: 'Enter reps' }).max(20),
  restSec: z.int().min(0).max(600).nullable().optional(),
  notes: z.string().trim().max(300).optional(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Use HH:MM' });

export const mealSchema = z.object({
  id: itemIdSchema,
  name: z.string().trim().min(1, { error: 'Enter the meal' }).max(80),
  time: timeOfDay.nullable().optional(),
  description: z.string().trim().max(500).default(''),
  kcal: z.int().min(0).max(5000).nullable().optional(),
});
export type Meal = z.infer<typeof mealSchema>;

export const workoutSchema = z.object({
  title: z.string().trim().min(1, { error: 'Enter a title' }).max(80),
  exercises: z.array(exerciseSchema).min(1, { error: 'Add at least one exercise' }).max(30),
});
export type Workout = z.infer<typeof workoutSchema>;

export const planDaySchema = z.object({
  /** null = rest day. */
  workout: workoutSchema.nullable().default(null),
  meals: z.array(mealSchema).max(10).default([]),
});
export type PlanDay = z.infer<typeof planDaySchema>;

/** 7 days, and every exercise and meal id is unique in the week (a check-off belongs to one item). */
export const weekSchema = z
  .array(planDaySchema)
  .length(7, { error: 'A week has 7 days' })
  .superRefine((days, ctx) => {
    const seen = new Set<string>();
    days.forEach((day, d) => {
      const items = [
        ...(day.workout?.exercises ?? []).map((e, i) => ({ id: e.id, path: ['workout', 'exercises', i] })),
        ...day.meals.map((m, i) => ({ id: m.id, path: ['meals', i] })),
      ];
      for (const item of items) {
        if (seen.has(item.id))
          ctx.addIssue({ code: 'custom', message: 'Duplicate item id', path: [d, ...item.path, 'id'] });
        seen.add(item.id);
      }
    });
  });

/** A week with 7 rest days: the start for a new template. */
export function emptyWeek(): PlanDay[] {
  return DAY_NAMES.map(() => ({ workout: null, meals: [] }));
}

export const templateSchema = z.object({
  name: z.string().trim().min(1, { error: 'Enter a name' }).max(80),
  description: z.string().trim().max(500).default(''),
  days: weekSchema,
});
export type TemplateInput = z.infer<typeof templateSchema>;

export const updateTemplateSchema = templateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

/** "YYYY-MM-DD" that is a real calendar date. */
export const isoDateSchema = z.iso.date({ error: 'Use a date like 2026-09-28' });

export const assignTemplateSchema = z.object({
  clientId: z.string().regex(/^[a-f\d]{24}$/i, { error: 'Pick a client' }),
  startDate: isoDateSchema,
});
export type AssignTemplateInput = z.infer<typeof assignTemplateSchema>;

/** PUT /clients/:id/plan: the trainer edits this client's own copy. */
export const clientPlanSchema = z.object({
  name: z.string().trim().min(1, { error: 'Enter a name' }).max(80),
  startDate: isoDateSchema,
  days: weekSchema,
});
export type ClientPlanInput = z.infer<typeof clientPlanSchema>;

export interface TemplateDto {
  id: string;
  name: string;
  description: string;
  days: PlanDay[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientPlanDto {
  id: string;
  clientId: string;
  /** The template it was copied from (it may have changed or been deleted since). */
  sourceTemplateId: string | null;
  name: string;
  startDate: string;
  days: PlanDay[];
  updatedAt: string;
}

/** GET /clients/:id/plan */
export interface ClientPlanResponse {
  plan: ClientPlanDto | null;
}

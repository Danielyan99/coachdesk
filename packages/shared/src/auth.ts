import { z } from 'zod';
import { type Role, roleSchema } from './roles';
import type { Tier } from './tiers';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address' }).max(254));

export const passwordSchema = z
  .string()
  .min(8, { error: 'Use at least 8 characters' })
  .max(128, { error: 'Use at most 128 characters' });

export const signupSchema = z.object({
  name: z.string().trim().min(1, { error: 'Enter your name' }).max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // No length rules here: a wrong password should get "incorrect", not a validation hint.
  password: z.string().min(1, { error: 'Enter your password' }).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** The logged-in user as the API returns it from /auth/me. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Trainers only. */
  tier?: Tier;
  /** Clients only: their Client record. */
  clientId?: string;
  /** True for a demo sandbox account (auto-deleted after 24h). */
  demo: boolean;
}

/** Body of every 400 from the validation pipe: field name to messages. */
export interface ValidationErrorBody {
  statusCode: 400;
  message: string;
  fieldErrors: Record<string, string[]>;
}

/** POST /auth/demo: which side of the demo to open. */
export const demoSchema = z.object({ role: roleSchema });
export type DemoInput = z.infer<typeof demoSchema>;

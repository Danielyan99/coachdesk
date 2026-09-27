import type { ZodType } from 'zod';
import { ApiError } from './api';

export type FormErrors = Record<string, string>;

/** Validates with a shared zod schema; errors are keyed by dotted path, first message per field. */
export function validate<T>(
  schema: ZodType<T>,
  value: unknown,
): { data: T; errors: null } | { data: null; errors: FormErrors } {
  const result = schema.safeParse(value);
  if (result.success) return { data: result.data, errors: null };
  const errors: FormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_form';
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}

/** The same shape from a server 400, so client and server errors render the same way. */
export function serverErrors(error: unknown): FormErrors | null {
  if (!(error instanceof ApiError) || !Object.keys(error.fieldErrors).length) return null;
  return Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0]]));
}

/** Errors under "days." with the prefix removed, for the WeekEditor. */
export function dayErrors(errors: FormErrors): FormErrors {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([k]) => k.startsWith('days.'))
      .map(([k, v]) => [k.slice(5), v]),
  );
}

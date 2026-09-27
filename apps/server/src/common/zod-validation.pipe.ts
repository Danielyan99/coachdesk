import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ValidationErrorBody } from '@coachdesk/shared';
import type { ZodType } from 'zod';

/**
 * Validates a request part with a zod schema from @coachdesk/shared, the same schema the web form uses.
 * Returns the parsed value (trimmed, lowercased, defaults applied), so controllers never see raw input.
 * Usage: @Body(new ZodValidationPipe(signupSchema)) body: SignupInput
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    // Dotted paths ("days.0.meals.1.name") so nested form fields can show their own message.
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_form';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    const body: ValidationErrorBody = { statusCode: 400, message: 'Validation failed', fieldErrors };
    throw new BadRequestException(body);
  }
}

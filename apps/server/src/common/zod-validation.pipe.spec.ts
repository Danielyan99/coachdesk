import { BadRequestException } from '@nestjs/common';
import { signupSchema } from '@coachdesk/shared';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('returns the parsed value', () => {
    const pipe = new ZodValidationPipe(signupSchema);
    expect(pipe.transform({ name: ' Ann ', email: ' ANN@x.io', password: 'longenough' })).toEqual({
      name: 'Ann',
      email: 'ann@x.io',
      password: 'longenough',
    });
  });

  it('throws 400 with messages per dotted field path', () => {
    const pipe = new ZodValidationPipe(z.object({ days: z.array(z.object({ name: z.string().min(1, 'Required') })) }));
    try {
      pipe.transform({ days: [{ name: 'ok' }, { name: '' }] });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Validation failed',
        fieldErrors: { 'days.1.name': ['Required'] },
      });
    }
  });
});

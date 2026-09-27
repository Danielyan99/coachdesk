import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@coachdesk/shared';
import { ROLES_KEY } from './decorators';
import { RolesGuard } from './roles.guard';

function contextFor(role: Role | undefined, required: Role[] | undefined): ExecutionContext {
  const handler = () => undefined;
  if (required) Reflect.defineMetadata(ROLES_KEY, required, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without @Roles', () => {
    expect(guard.canActivate(contextFor('client', undefined))).toBe(true);
  });

  it('allows a matching role', () => {
    expect(guard.canActivate(contextFor('trainer', ['trainer']))).toBe(true);
  });

  it('forbids another role', () => {
    expect(() => guard.canActivate(contextFor('client', ['trainer']))).toThrow(ForbiddenException);
  });
});

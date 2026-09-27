import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@coachdesk/shared';
import { ROLES_KEY } from './decorators';
import type { RequestUser } from './request-user';

/** Global guard, runs after AuthGuard: checks @Roles(...) on the route or its controller. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (user && roles.includes(user.role)) return true;
    throw new ForbiddenException('You do not have access to this page');
  }
}

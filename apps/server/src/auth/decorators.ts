import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@coachdesk/shared';
import type { RequestUser } from './request-user';

export const IS_PUBLIC = 'isPublic';
/** Route works without a login. Every other route needs the session cookie (global AuthGuard). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'roles';
/** Only these roles may call the route (global RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const AUTH_RATE_LIMIT = 'authRateLimit';
/** Apply the strict per-IP limit for login, signup and similar routes (see the "auth" throttler). */
export const AuthRateLimit = () => SetMetadata(AUTH_RATE_LIMIT, true);

export const DEMO_RATE_LIMIT = 'demoRateLimit';
/** Per-IP hourly limit for creating demo sandboxes (each one inserts a few hundred documents). */
export const DemoRateLimit = () => SetMetadata(DEMO_RATE_LIMIT, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser => ctx.switchToHttp().getRequest().user,
);

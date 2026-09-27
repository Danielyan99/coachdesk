import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { isValidObjectId, Model } from 'mongoose';
import { User } from '../users/user.schema';
import { IS_PUBLIC } from './decorators';
import { toRequestUser } from './request-user';
import { SESSION_COOKIE } from './session-cookie';

/** Global guard: every route needs a valid session cookie unless it is marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string') throw new UnauthorizedException('Please log in');

    let sub: unknown;
    try {
      ({ sub } = await this.jwt.verifyAsync<{ sub: string }>(token));
    } catch {
      throw new UnauthorizedException('Your session has expired. Please log in again');
    }
    if (!isValidObjectId(sub)) throw new UnauthorizedException('Please log in');

    // Load the user on every request: role and tier changes apply at once, and a deleted
    // (or expired demo) account is logged out even though its token is still signed.
    const user = await this.users.findById(sub).lean();
    if (!user) throw new UnauthorizedException('Your session has expired. Please log in again');

    req.user = toRequestUser(user);
    return true;
  }
}

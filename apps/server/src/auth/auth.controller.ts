import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { type AuthUser, type LoginInput, loginSchema, type SignupInput, signupSchema } from '@coachdesk/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { AuthService } from './auth.service';
import { AuthRateLimit, CurrentUser, Public } from './decorators';
import { type RequestUser, toAuthUser } from './request-user';
import { clearSessionCookie, setSessionCookie } from './session-cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @AuthRateLimit()
  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    return this.startSession(await this.auth.signupTrainer(body), res);
  }

  @Public()
  @AuthRateLimit()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    return this.startSession(await this.auth.login(body), res);
  }

  /** Public: logging out must work even when the session already expired. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(res, this.config.secureCookies);
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser): AuthUser {
    return toAuthUser(user);
  }

  private async startSession(user: RequestUser, res: Response): Promise<AuthUser> {
    setSessionCookie(res, await this.auth.signToken(user), this.config.secureCookies);
    return toAuthUser(user);
  }
}

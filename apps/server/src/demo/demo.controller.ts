import { Body, Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { type AuthUser, type DemoInput, demoSchema } from '@coachdesk/shared';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AuthRateLimit, DemoRateLimit, Public } from '../auth/decorators';
import { toAuthUser } from '../auth/request-user';
import { setSessionCookie } from '../auth/session-cookie';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { DEMO_TTL_MS, DemoService } from './demo.service';

@Controller('auth/demo')
export class DemoController {
  constructor(
    private readonly demo: DemoService,
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * "Try as trainer" / "Try as client": builds a private sandbox for this visitor and logs them in.
   * Nobody else sees their changes, and MongoDB deletes it all after 24 hours (TTL indexes).
   */
  @Public()
  @AuthRateLimit()
  @DemoRateLimit()
  @Post()
  @HttpCode(200)
  async start(
    @Body(new ZodValidationPipe(demoSchema)) { role }: DemoInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const sandbox = await this.demo.createSandbox({ expiresAt: new Date(Date.now() + DEMO_TTL_MS) });
    const user = role === 'trainer' ? sandbox.trainer : sandbox.client;
    setSessionCookie(res, await this.auth.signToken(user), this.config.secureCookies, DEMO_TTL_MS);
    return toAuthUser(user);
  }
}

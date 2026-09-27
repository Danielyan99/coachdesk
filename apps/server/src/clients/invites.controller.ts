import { Body, Controller, Get, HttpCode, Inject, Param, Post, Res } from '@nestjs/common';
import { type AcceptInviteInput, acceptInviteSchema, type AuthUser, type InvitePreviewDto } from '@coachdesk/shared';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AuthRateLimit, Public } from '../auth/decorators';
import { toAuthUser } from '../auth/request-user';
import { setSessionCookie } from '../auth/session-cookie';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { ClientsService } from './clients.service';

/** Public: the client opens the link from their trainer before they have a login. */
@Public()
@Controller('auth/invite')
export class InvitesController {
  constructor(
    private readonly clients: ClientsService,
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @AuthRateLimit()
  @Get(':token')
  preview(@Param('token') token: string): Promise<InvitePreviewDto> {
    return this.clients.previewInvite(token);
  }

  @AuthRateLimit()
  @Post(':token/accept')
  @HttpCode(200)
  async accept(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: AcceptInviteInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const user = await this.clients.acceptInvite(token, body);
    setSessionCookie(res, await this.auth.signToken(user), this.config.secureCookies);
    return toAuthUser(user);
  }
}

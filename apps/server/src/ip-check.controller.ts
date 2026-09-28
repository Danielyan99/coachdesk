import { Controller, Get, Inject, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from './auth/decorators';
import { APP_CONFIG, type AppConfig } from './config/configuration';

// TEMPORARY: checks which IP the rate limiter sees behind Vercel + Render. Removed after the check.
@Public()
@Controller('ip-check')
export class IpCheckController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  check(@Req() req: Request) {
    return { ip: req.ip, trustProxyHops: this.config.trustProxyHops };
  }
}

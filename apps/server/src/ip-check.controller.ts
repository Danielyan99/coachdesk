import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from './auth/decorators';

// TEMPORARY: checks which IP the rate limiter sees behind Vercel + Render. Removed after the check.
@Public()
@Controller('ip-check')
export class IpCheckController {
  @Get()
  check(@Req() req: Request) {
    return { ip: req.ip, forwardedFor: req.headers['x-forwarded-for'] ?? null };
  }
}

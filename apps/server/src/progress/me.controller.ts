import { Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { isoDateSchema, itemIdSchema, type TodayDto, type WeekDto } from '@coachdesk/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestUser } from '../auth/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProgressService } from './progress.service';

const dateParam = new ZodValidationPipe(isoDateSchema);
const itemParam = new ZodValidationPipe(itemIdSchema);

/** The client's own screens. "Today" is always computed here, in the client's time zone. */
@Roles('client')
@Controller('me')
export class MeController {
  constructor(private readonly progress: ProgressService) {}

  @Get('today')
  today(@CurrentUser() user: RequestUser): Promise<TodayDto> {
    return this.progress.getToday(user);
  }

  @Get('week')
  week(@CurrentUser() user: RequestUser): Promise<WeekDto> {
    return this.progress.getWeek(user);
  }

  /** Idempotent: checking an item twice leaves one check-in. */
  @Put('checkins/:date/:itemId')
  @HttpCode(204)
  check(
    @CurrentUser() user: RequestUser,
    @Param('date', dateParam) date: string,
    @Param('itemId', itemParam) itemId: string,
  ): Promise<void> {
    return this.progress.check(user, date, itemId);
  }

  @Delete('checkins/:date/:itemId')
  @HttpCode(204)
  uncheck(
    @CurrentUser() user: RequestUser,
    @Param('date', dateParam) date: string,
    @Param('itemId', itemParam) itemId: string,
  ): Promise<void> {
    return this.progress.uncheck(user, date, itemId);
  }
}

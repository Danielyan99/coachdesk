import { Controller, Get, Param } from '@nestjs/common';
import type { AdherenceDto, DashboardDto } from '@coachdesk/shared';
import type { Types } from 'mongoose';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestUser } from '../auth/request-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { ProgressService } from './progress.service';

@Roles('trainer')
@Controller()
export class TrainerProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() trainer: RequestUser): Promise<DashboardDto> {
    return this.progress.dashboard(trainer);
  }

  @Get('clients/:id/adherence')
  adherence(
    @CurrentUser() trainer: RequestUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<AdherenceDto> {
    return this.progress.adherenceFor(trainer, id);
  }
}

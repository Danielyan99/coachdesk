import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { type ClientPlanDto, type ClientPlanInput, type ClientPlanResponse, clientPlanSchema } from '@coachdesk/shared';
import type { Types } from 'mongoose';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestUser } from '../auth/request-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PlansService } from './plans.service';

@Roles('trainer')
@Controller('clients/:clientId/plan')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  async get(
    @CurrentUser() trainer: RequestUser,
    @Param('clientId', ParseObjectIdPipe) clientId: Types.ObjectId,
  ): Promise<ClientPlanResponse> {
    return { plan: await this.plans.getForClient(trainer, clientId) };
  }

  @Put()
  save(
    @CurrentUser() trainer: RequestUser,
    @Param('clientId', ParseObjectIdPipe) clientId: Types.ObjectId,
    @Body(new ZodValidationPipe(clientPlanSchema)) body: ClientPlanInput,
  ): Promise<ClientPlanDto> {
    return this.plans.save(trainer, clientId, body);
  }
}

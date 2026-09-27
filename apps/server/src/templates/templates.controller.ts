import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type AssignTemplateInput,
  assignTemplateSchema,
  type ClientPlanDto,
  type TemplateDto,
  type TemplateInput,
  templateSchema,
  type UpdateTemplateInput,
  updateTemplateSchema,
} from '@coachdesk/shared';
import type { Types } from 'mongoose';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestUser } from '../auth/request-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TemplatesService } from './templates.service';

@Roles('trainer')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@CurrentUser() trainer: RequestUser): Promise<TemplateDto[]> {
    return this.templates.list(trainer);
  }

  @Post()
  create(
    @CurrentUser() trainer: RequestUser,
    @Body(new ZodValidationPipe(templateSchema)) body: TemplateInput,
  ): Promise<TemplateDto> {
    return this.templates.create(trainer, body);
  }

  @Get(':id')
  get(@CurrentUser() trainer: RequestUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId): Promise<TemplateDto> {
    return this.templates.get(trainer, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() trainer: RequestUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body(new ZodValidationPipe(updateTemplateSchema)) body: UpdateTemplateInput,
  ): Promise<TemplateDto> {
    return this.templates.update(trainer, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() trainer: RequestUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId): Promise<void> {
    return this.templates.remove(trainer, id);
  }

  @Post(':id/assign')
  assign(
    @CurrentUser() trainer: RequestUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body(new ZodValidationPipe(assignTemplateSchema)) body: AssignTemplateInput,
  ): Promise<ClientPlanDto> {
    return this.templates.assign(trainer, id, body);
  }
}

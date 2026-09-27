import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type ClientDto,
  type CreateClientInput,
  createClientSchema,
  type InviteLinkDto,
  type UpdateClientInput,
  updateClientSchema,
} from '@coachdesk/shared';
import type { Types } from 'mongoose';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestUser } from '../auth/request-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ClientsService, toClientDto } from './clients.service';

@Roles('trainer')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@CurrentUser() trainer: RequestUser): Promise<ClientDto[]> {
    return this.clients.list(trainer);
  }

  @Post()
  create(
    @CurrentUser() trainer: RequestUser,
    @Body(new ZodValidationPipe(createClientSchema)) body: CreateClientInput,
  ): Promise<ClientDto> {
    return this.clients.create(trainer, body);
  }

  @Get(':id')
  async get(@CurrentUser() trainer: RequestUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return toClientDto(await this.clients.findOwned(trainer, id));
  }

  @Patch(':id')
  update(
    @CurrentUser() trainer: RequestUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClientInput,
  ): Promise<ClientDto> {
    return this.clients.update(trainer, id, body);
  }

  /** Archives the client (see ClientsService.archive). */
  @Delete(':id')
  @HttpCode(204)
  archive(@CurrentUser() trainer: RequestUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId): Promise<void> {
    return this.clients.archive(trainer, id);
  }

  @Post(':id/invite')
  invite(
    @CurrentUser() trainer: RequestUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<InviteLinkDto> {
    return this.clients.createInvite(trainer, id);
  }
}

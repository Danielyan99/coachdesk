import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientPlanDto, ClientPlanInput, PlanDay } from '@coachdesk/shared';
import { Model, type Types } from 'mongoose';
import type { RequestUser } from '../auth/request-user';
import { ClientsService } from '../clients/clients.service';
import { ClientPlan } from './client-plan.schema';

type ClientPlanLean = ClientPlan & { _id: Types.ObjectId };

export function toClientPlanDto(plan: ClientPlanLean): ClientPlanDto {
  return {
    id: plan._id.toString(),
    clientId: plan.clientId.toString(),
    sourceTemplateId: plan.sourceTemplateId?.toString() ?? null,
    name: plan.name,
    startDate: plan.startDate,
    days: plan.days as PlanDay[],
    updatedAt: plan.updatedAt.toISOString(),
  };
}

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(ClientPlan.name) private readonly plans: Model<ClientPlan>,
    private readonly clients: ClientsService,
  ) {}

  findActive(clientId: Types.ObjectId): Promise<ClientPlanLean | null> {
    return this.plans.findOne({ clientId, active: true }).lean();
  }

  async getForClient(trainer: RequestUser, clientId: Types.ObjectId): Promise<ClientPlanDto | null> {
    await this.clients.findOwned(trainer, clientId); // 404 unless it is this trainer's client
    const plan = await this.findActive(clientId);
    return plan ? toClientPlanDto(plan) : null;
  }

  /**
   * Gives the client a new active plan. The previous one is kept but made inactive, so its
   * check-in history still points to a real plan.
   */
  async replace(
    trainer: RequestUser,
    clientId: Types.ObjectId,
    plan: { name: string; startDate: string; days: PlanDay[]; sourceTemplateId?: Types.ObjectId },
  ): Promise<ClientPlanDto> {
    const client = await this.clients.findOwned(trainer, clientId);
    if (client.archived) throw new ConflictException('This client is archived');

    await this.plans.updateMany({ clientId, active: true }, { $set: { active: false } });
    const created = await this.plans.create({
      ...plan,
      trainerId: trainer._id,
      clientId,
      active: true,
      ...(trainer.expiresAt ? { expiresAt: trainer.expiresAt } : {}),
    });
    return toClientPlanDto(created.toObject());
  }

  /** Edits the client's own copy in place, or creates a plan from scratch if there is none yet. */
  async save(trainer: RequestUser, clientId: Types.ObjectId, input: ClientPlanInput): Promise<ClientPlanDto> {
    const client = await this.clients.findOwned(trainer, clientId);
    if (client.archived) throw new ConflictException('This client is archived');

    const updated = await this.plans
      .findOneAndUpdate(
        { clientId, trainerId: trainer._id, active: true },
        { $set: { name: input.name, startDate: input.startDate, days: input.days } },
        { new: true },
      )
      .lean();
    if (updated) return toClientPlanDto(updated);
    return this.replace(trainer, clientId, input);
  }
}

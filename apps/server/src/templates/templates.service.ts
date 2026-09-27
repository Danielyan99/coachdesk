import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  AssignTemplateInput,
  ClientPlanDto,
  PlanDay,
  TemplateDto,
  TemplateInput,
  UpdateTemplateInput,
} from '@coachdesk/shared';
import { Model, Types } from 'mongoose';
import type { RequestUser } from '../auth/request-user';
import { PlansService } from '../plans/plans.service';
import { Template } from './template.schema';

type TemplateLean = Template & { _id: Types.ObjectId };

export function toTemplateDto(template: TemplateLean): TemplateDto {
  return {
    id: template._id.toString(),
    name: template.name,
    description: template.description,
    days: template.days as PlanDay[],
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel(Template.name) private readonly templates: Model<Template>,
    private readonly plans: PlansService,
  ) {}

  async list(trainer: RequestUser): Promise<TemplateDto[]> {
    const templates = await this.templates.find({ trainerId: trainer._id }).sort({ updatedAt: -1 }).lean();
    return templates.map(toTemplateDto);
  }

  async get(trainer: RequestUser, id: Types.ObjectId): Promise<TemplateDto> {
    return toTemplateDto(await this.findOwned(trainer, id));
  }

  async create(trainer: RequestUser, input: TemplateInput): Promise<TemplateDto> {
    const template = await this.templates.create({
      ...input,
      trainerId: trainer._id,
      ...(trainer.expiresAt ? { expiresAt: trainer.expiresAt } : {}),
    });
    return toTemplateDto(template.toObject());
  }

  async update(trainer: RequestUser, id: Types.ObjectId, input: UpdateTemplateInput): Promise<TemplateDto> {
    const template = await this.templates
      .findOneAndUpdate({ _id: id, trainerId: trainer._id }, { $set: input }, { new: true })
      .lean();
    if (!template) throw new NotFoundException('Template not found');
    return toTemplateDto(template);
  }

  /** A real delete is safe: client plans are copies and don't need the template. */
  async remove(trainer: RequestUser, id: Types.ObjectId): Promise<void> {
    const result = await this.templates.deleteOne({ _id: id, trainerId: trainer._id });
    if (result.deletedCount === 0) throw new NotFoundException('Template not found');
  }

  /** Copies the template into a new plan for the client (a snapshot, see ClientPlan). */
  async assign(trainer: RequestUser, id: Types.ObjectId, input: AssignTemplateInput): Promise<ClientPlanDto> {
    const template = await this.findOwned(trainer, id);
    return this.plans.replace(trainer, new Types.ObjectId(input.clientId), {
      name: template.name,
      startDate: input.startDate,
      days: structuredClone(template.days) as PlanDay[],
      sourceTemplateId: template._id,
    });
  }

  private async findOwned(trainer: RequestUser, id: Types.ObjectId): Promise<TemplateLean> {
    const template = await this.templates.findOne({ _id: id, trainerId: trainer._id }).lean();
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }
}

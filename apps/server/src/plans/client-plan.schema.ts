import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';
import { type PlanDayDoc, PlanDaySchema } from './plan-day.schema';

/**
 * A client's own copy of a week plan. Assigning a template copies its days here (a snapshot),
 * so editing this plan never changes the template or any other client's plan.
 */
@Schema({ timestamps: true })
export class ClientPlan {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  trainerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  sourceTemplateId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  /** "YYYY-MM-DD" in the client's time zone. Adherence only counts days from here on. */
  @Prop({ required: true })
  startDate: string;

  /** Monday to Sunday. */
  @Prop({ type: [PlanDaySchema], required: true })
  days: PlanDayDoc[];

  /** Old plans stay (inactive) so past check-ins still point to a real plan. */
  @Prop({ default: true })
  active: boolean;

  /** Demo sandbox data only (TTL index below). */
  @Prop()
  expiresAt?: Date;

  updatedAt: Date;
}

export type ClientPlanDocument = HydratedDocument<ClientPlan>;
export const ClientPlanSchema = SchemaFactory.createForClass(ClientPlan);
// At most one active plan per client, enforced by MongoDB.
ClientPlanSchema.index({ clientId: 1 }, { unique: true, partialFilterExpression: { active: true } });
ClientPlanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

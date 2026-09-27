import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';
import { type PlanDayDoc, PlanDaySchema } from '../plans/plan-day.schema';

@Schema({ timestamps: true })
export class Template {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  trainerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  /** Monday to Sunday. */
  @Prop({ type: [PlanDaySchema], required: true })
  days: PlanDayDoc[];

  /** Demo sandbox data only (TTL index below). */
  @Prop()
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type TemplateDocument = HydratedDocument<Template>;
export const TemplateSchema = SchemaFactory.createForClass(Template);
TemplateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

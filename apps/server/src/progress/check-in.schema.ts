import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { ItemType } from '@coachdesk/shared';
import { type HydratedDocument, Types } from 'mongoose';

/** One checked-off exercise or meal on one date. Unchecking deletes the document. */
@Schema()
export class CheckIn {
  @Prop({ type: Types.ObjectId, required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  planId: Types.ObjectId;

  /** "YYYY-MM-DD" in the client's time zone. */
  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  itemId: string;

  @Prop({ required: true, enum: ['exercise', 'meal'] })
  itemType: ItemType;

  @Prop({ required: true })
  completedAt: Date;

  /** Demo sandbox data only (TTL index below). */
  @Prop()
  expiresAt?: Date;
}

export type CheckInDocument = HydratedDocument<CheckIn>;
export const CheckInSchema = SchemaFactory.createForClass(CheckIn);
// One check-in per item per day: checking twice is a no-op (idempotent PUT). Also serves "check-ins in a date range".
CheckInSchema.index({ clientId: 1, date: 1, itemId: 1 }, { unique: true });
CheckInSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

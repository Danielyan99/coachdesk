import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { ClientStats } from '@coachdesk/shared';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Client {
  /** Owner. Every query filters on this, taken from the logged-in trainer, never from the request. */
  @Prop({ type: Types.ObjectId, required: true, index: true })
  trainerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  goals: string;

  @Prop(raw({ weightKg: Number, heightCm: Number, bodyFatPct: Number, _id: false }))
  stats: ClientStats;

  /** Restrictions, injuries, preferences. */
  @Prop({ default: '' })
  notes: string;

  /** IANA name, e.g. "Asia/Yerevan". "Today" for this client is computed in this zone. */
  @Prop({ required: true })
  timezone: string;

  /** Set when the client accepted an invite and has a login. */
  @Prop({ type: Types.ObjectId })
  userId?: Types.ObjectId;

  /** SHA-256 of the invite token. The token itself is only in the link, never stored. */
  @Prop({ index: { sparse: true } })
  inviteTokenHash?: string;

  @Prop()
  inviteExpiresAt?: Date;

  @Prop({ default: false })
  archived: boolean;

  /** Demo sandbox data only (TTL index below). */
  @Prop()
  expiresAt?: Date;

  createdAt: Date;
}

export type ClientDocument = HydratedDocument<Client>;
export const ClientSchema = SchemaFactory.createForClass(Client);
ClientSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

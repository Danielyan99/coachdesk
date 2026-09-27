import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ROLES, type Role, type Tier, TIERS } from '@coachdesk/shared';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ROLES })
  role: Role;

  @Prop({ required: true, trim: true })
  name: string;

  /** Clients only: the trainer who invited them. */
  @Prop({ type: Types.ObjectId })
  trainerId?: Types.ObjectId;

  /** Clients only: their Client record. */
  @Prop({ type: Types.ObjectId })
  clientId?: Types.ObjectId;

  /** Trainers only. */
  @Prop({ enum: Object.keys(TIERS) })
  tier?: Tier;

  /** Demo sandbox accounts only. MongoDB deletes the document at this time (TTL index below). */
  @Prop()
  expiresAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

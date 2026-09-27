import type { AuthUser } from '@coachdesk/shared';
import type { Types } from 'mongoose';
import type { User } from '../users/user.schema';

/** What the AuthGuard puts on req.user. The ObjectIds are for scoping queries. */
export interface RequestUser extends AuthUser {
  _id: Types.ObjectId;
  /** Clients only. */
  trainerObjectId?: Types.ObjectId;
  /** Clients only. */
  clientObjectId?: Types.ObjectId;
  /** Demo accounts only: data this user creates expires at the same time. */
  expiresAt?: Date;
}

export function toRequestUser(user: User & { _id: Types.ObjectId }): RequestUser {
  return {
    _id: user._id,
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.role === 'trainer' ? { tier: user.tier ?? 'starter' } : {}),
    ...(user.clientId ? { clientId: user.clientId.toString(), clientObjectId: user.clientId } : {}),
    ...(user.trainerId ? { trainerObjectId: user.trainerId } : {}),
    demo: Boolean(user.expiresAt),
    ...(user.expiresAt ? { expiresAt: user.expiresAt } : {}),
  };
}

/** The public shape for API responses (no ObjectIds). */
export function toAuthUser(user: RequestUser): AuthUser {
  const { id, email, name, role, tier, clientId, demo } = user;
  return { id, email, name, role, demo, ...(tier ? { tier } : {}), ...(clientId ? { clientId } : {}) };
}

import { z } from 'zod';
import { emailSchema, passwordSchema } from './auth';

/** True for an IANA time zone name the runtime knows, e.g. "Asia/Yerevan". */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z.string().trim().min(1).max(64).refine(isValidTimeZone, { error: 'Unknown time zone' });

/** Optional number field: the form sends null (or nothing) for "not known". */
const optionalNumber = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .min(min, { error: `${label} must be at least ${min}` })
    .max(max, { error: `${label} must be at most ${max}` })
    .nullable()
    .optional();

export const clientStatsSchema = z.object({
  weightKg: optionalNumber(20, 400, 'Weight'),
  heightCm: optionalNumber(80, 250, 'Height'),
  bodyFatPct: optionalNumber(2, 75, 'Body fat'),
});
export type ClientStats = z.infer<typeof clientStatsSchema>;

export const createClientSchema = z.object({
  name: z.string().trim().min(1, { error: 'Enter a name' }).max(80),
  goals: z.string().trim().max(500).default(''),
  stats: clientStatsSchema.default({}),
  /** Restrictions, injuries, preferences. */
  notes: z.string().trim().max(2000).default(''),
  timezone: timeZoneSchema,
});
export type CreateClientInput = z.input<typeof createClientSchema>;

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(1, { error: 'Enter a name' }).max(80),
    goals: z.string().trim().max(500),
    stats: clientStatsSchema,
    notes: z.string().trim().max(2000),
    timezone: timeZoneSchema,
  })
  .partial();
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export interface ClientDto {
  id: string;
  name: string;
  goals: string;
  stats: ClientStats;
  notes: string;
  timezone: string;
  archived: boolean;
  /** The client accepted an invite and can log in. */
  hasLogin: boolean;
  /** An unused invite link exists until this time (ISO). */
  inviteExpiresAt: string | null;
  createdAt: string;
}

export interface InviteLinkDto {
  url: string;
  expiresAt: string;
}

/** What the invite page shows before the client sets a password. */
export interface InvitePreviewDto {
  clientName: string;
  trainerName: string;
}

/** The client picks the email they will log in with, plus a password. */
export const acceptInviteSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/** Body of the 403 when a trainer is at the client limit of their tier. */
export interface ClientLimitErrorBody {
  statusCode: 403;
  code: 'CLIENT_LIMIT';
  message: string;
  limit: number;
}

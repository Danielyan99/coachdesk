import { z } from 'zod';

export const ROLES = ['trainer', 'client'] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

import { z } from 'zod';

/** Flat monthly pricing. Shown on the pricing page and enforced when a trainer adds a client. */
export const TIERS = {
  starter: { name: 'Starter', priceUsd: 9, maxClients: 10 },
  pro: { name: 'Pro', priceUsd: 19, maxClients: 30 },
  unlimited: { name: 'Unlimited', priceUsd: 29, maxClients: Infinity },
} as const;

export type Tier = keyof typeof TIERS;
export const TIER_IDS = Object.keys(TIERS) as Tier[];
export const tierSchema = z.enum(['starter', 'pro', 'unlimited']);

export const updateTierSchema = z.object({ tier: tierSchema });
export type UpdateTierInput = z.infer<typeof updateTierSchema>;

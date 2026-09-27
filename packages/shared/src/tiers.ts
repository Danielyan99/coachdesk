/** Flat monthly pricing. Shown on the pricing page and enforced when a trainer adds a client. */
export const TIERS = {
  starter: { name: 'Starter', priceUsd: 9, maxClients: 10 },
  pro: { name: 'Pro', priceUsd: 19, maxClients: 30 },
  unlimited: { name: 'Unlimited', priceUsd: 29, maxClients: Infinity },
} as const;

export type Tier = keyof typeof TIERS;

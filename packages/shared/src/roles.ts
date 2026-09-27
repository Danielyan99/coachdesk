export const ROLES = ['trainer', 'client'] as const;
export type Role = (typeof ROLES)[number];

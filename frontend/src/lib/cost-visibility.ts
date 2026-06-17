export const COST_VISIBLE_ROLES = ['SUPER_ADMIN', 'PURCHASE_CHECKER'] as const;

export function canViewCost(role?: string): boolean {
  return !!role && (COST_VISIBLE_ROLES as readonly string[]).includes(role);
}

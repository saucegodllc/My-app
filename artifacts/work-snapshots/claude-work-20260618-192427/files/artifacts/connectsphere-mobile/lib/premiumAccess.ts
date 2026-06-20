type PremiumAccessInput = {
  isPremium?: unknown;
  isActive?: unknown;
};

export function hasPremiumAccess(entitlement: PremiumAccessInput | null | undefined): boolean {
  return entitlement?.isPremium === true;
}

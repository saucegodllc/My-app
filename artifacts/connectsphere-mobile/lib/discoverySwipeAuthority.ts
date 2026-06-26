export function isDiscoverySwipeLimitError(error: unknown) {
  const candidate = error as { status?: number; data?: { code?: string } };
  return candidate?.data?.code === "SWIPE_LIMIT_REACHED" || candidate?.status === 429;
}

export function remainingSwipesFromDiscoveryResult(result: unknown) {
  const remaining = (result as { remainingSwipes?: unknown })?.remainingSwipes;
  return typeof remaining === "number" ? Math.max(0, remaining) : null;
}

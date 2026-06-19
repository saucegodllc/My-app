import { useAuth, useUser } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";

import { launchEnvironment, isProductionLaunch, shouldUseDemoSeeds } from "@/lib/launchConfig";
import { getPremiumEntitlement, getProfileCompletion, getSessionState } from "@/services/launchReadyApi";

export const e2eSmokeEnabled =
  !isProductionLaunch &&
  (process.env.EXPO_PUBLIC_E2E_SMOKE === "1" ||
    process.env.EXPO_PUBLIC_E2E_SMOKE === "true");

export function useSessionState() {
  const auth = useAuth();
  const { user } = useUser();
  const userId = e2eSmokeEnabled ? "e2e-smoke-user" : auth.userId ?? user?.id ?? null;
  const signedIn = e2eSmokeEnabled || (auth.isSignedIn === true && !!userId);

  const premium = useQuery({
    queryKey: ["session-state", userId, "premium"],
    queryFn: getPremiumEntitlement,
    enabled: signedIn && !e2eSmokeEnabled,
    staleTime: 60_000,
  });

  const serverSession = useQuery({
    queryKey: ["session-state", userId, "server"],
    queryFn: getSessionState,
    enabled: signedIn && !e2eSmokeEnabled,
    staleTime: 60_000,
  });

  const completion = useQuery({
    queryKey: ["session-state", userId, "profile-completion"],
    queryFn: getProfileCompletion,
    enabled: signedIn && !e2eSmokeEnabled,
    staleTime: 60_000,
  });

  return {
    userId,
    isLoaded: e2eSmokeEnabled || auth.isLoaded,
    isSignedIn: signedIn,
    user,
    onboardingComplete: e2eSmokeEnabled || user?.unsafeMetadata?.onboardingComplete === true,
    premium: premium.data ?? null,
    profileCompletion: completion.data ?? null,
    serverSession: serverSession.data ?? null,
    launchEnvironment,
    isProductionLaunch,
    demoSeedsEnabled: shouldUseDemoSeeds(),
    refreshSessionState: async () => {
      await Promise.allSettled([serverSession.refetch(), premium.refetch(), completion.refetch()]);
    },
  };
}

export function requireSessionUserId(userId: string | null | undefined) {
  if (!userId) throw new Error("Authentication required");
  return userId;
}

import { customFetch } from "@workspace/api-client-react";

export type PremiumEntitlement = {
  isPremium: boolean;
  source: "revenuecat" | "stripe" | "manual" | "none";
  tier: "plus" | "free";
  entitlementId: string;
  productId?: string;
  trialEligible?: boolean;
  renewalDate?: string;
  managementUrl?: string;
  restoreAvailable: boolean;
  gates: Record<string, boolean>;
};

export type ProfileCompletionStatus = {
  percent: number;
  isLaunchReady: boolean;
  photoCount: number;
  requiredPhotoCount: number;
  missingItems: Array<{ id: string; label: string; weight: number }>;
  blockingItems: Array<{ id: string; label: string; weight: number }>;
  softNudges: string[];
  completedSections: string[];
};

export type SessionState = {
  ok: boolean;
  state: "active" | "unauthenticated";
  userId: string | null;
  sessionId: string | null;
  environment: string;
  localDbFallbackEnabled?: boolean;
};

export function getSessionState() {
  return customFetch<SessionState>("/api/me/session-state");
}

export function getPremiumEntitlement() {
  return customFetch<PremiumEntitlement>("/api/subscriptions/entitlement");
}

export function syncRevenueCatEntitlement(input: {
  appUserId?: string;
  isPremium: boolean;
  entitlementId?: string;
  productId?: string;
  renewalDate?: string;
  managementUrl?: string;
  trialEligible?: boolean;
}) {
  return customFetch<PremiumEntitlement>("/api/subscriptions/revenuecat/sync", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getProfileCompletion() {
  return customFetch<ProfileCompletionStatus>("/api/profiles/me/completion");
}

export function patchProfilePhotos(input:
  | { action: "replace"; photos: string[] }
  | { action: "add" | "remove" | "set_main"; photoUrl: string }
  | { action: "reorder"; fromIndex: number; toIndex: number }
) {
  return customFetch<{ photos: string[]; completion: ProfileCompletionStatus }>("/api/profiles/me/photos", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function archiveChat(chatId: string, archived = true) {
  return customFetch<{ ok: boolean; archived: boolean }>(`/api/chats/${encodeURIComponent(chatId)}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived }),
  });
}

export function muteChat(chatId: string, muted = true) {
  return customFetch<{ ok: boolean; muted: boolean }>(`/api/chats/${encodeURIComponent(chatId)}/mute`, {
    method: "POST",
    body: JSON.stringify({ muted }),
  });
}

export function clearChat(chatId: string) {
  return customFetch<{ ok: boolean; clearedAt: string }>(`/api/chats/${encodeURIComponent(chatId)}/clear`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function unmatchChat(chatId: string, reason?: string) {
  return customFetch<{ ok: boolean; unmatched: boolean }>(`/api/chats/${encodeURIComponent(chatId)}/unmatch`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function markChatRead(chatId: string) {
  return customFetch<{ ok: boolean; readAt: string }>(`/api/chats/${encodeURIComponent(chatId)}/read`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function reportMessage(messageId: string | number, reason: string, details?: string) {
  return customFetch<{ ok: boolean }>(`/api/messages/${encodeURIComponent(String(messageId))}/report`, {
    method: "POST",
    body: JSON.stringify({ reason, details }),
  });
}

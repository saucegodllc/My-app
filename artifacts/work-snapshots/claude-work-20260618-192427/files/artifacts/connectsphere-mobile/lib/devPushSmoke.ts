export type DevPushSmokeKind = "message" | "match";

export type DevPushRegistrationStatus =
  | "idle"
  | "disabled"
  | "unsupported"
  | "permission-denied"
  | "missing-project-id"
  | "token-received"
  | "registering"
  | "registered"
  | "failed";

export type DevPushSmokeSnapshot = {
  token: string | null;
  registrationStatus: DevPushRegistrationStatus;
  registeredWithApi: boolean;
  registeredAt: string | null;
  lastError: string | null;
  lastMessage: string | null;
  updatedAt: string | null;
};

const initialSnapshot: DevPushSmokeSnapshot = {
  token: null,
  registrationStatus: "idle",
  registeredWithApi: false,
  registeredAt: null,
  lastError: null,
  lastMessage: null,
  updatedAt: null,
};

let snapshot: DevPushSmokeSnapshot = initialSnapshot;
const listeners = new Set<() => void>();

export function isDevPushSmokeEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.EXPO_PUBLIC_ENABLE_PUSH_SMOKE !== "false";
}

export function getDevPushSmokeSnapshot() {
  return snapshot;
}

export function subscribeDevPushSmoke(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateDevPushSmokeState(update: Partial<DevPushSmokeSnapshot>) {
  snapshot = {
    ...snapshot,
    ...update,
    updatedAt: update.updatedAt ?? new Date().toISOString(),
  };
  listeners.forEach((listener) => listener());
}

export function resetDevPushSmokeState() {
  snapshot = initialSnapshot;
  listeners.forEach((listener) => listener());
}

export function getMaskedExpoPushToken(token: string | null) {
  if (!token) return "No Expo token yet";

  const bracketStart = token.indexOf("[");
  const bracketEnd = token.lastIndexOf("]");
  if (bracketStart < 0 || bracketEnd <= bracketStart + 8) {
    return token.length > 18 ? `${token.slice(0, 10)}...${token.slice(-4)}` : token;
  }

  const prefix = token.slice(0, bracketStart + 1);
  const body = token.slice(bracketStart + 1, bracketEnd);
  return `${prefix}${body.slice(0, 4)}...${body.slice(-4)}]`;
}

export function buildDevPushSmokeRequest(kind: DevPushSmokeKind): RequestInit {
  const serverKind = kind === "match" ? "double_date_match" : "message";
  const chatId = kind === "match" ? "push-smoke-test-match" : "push-smoke-test-message";

  return {
    method: "POST",
    body: JSON.stringify({ kind: serverKind, chatId }),
  };
}

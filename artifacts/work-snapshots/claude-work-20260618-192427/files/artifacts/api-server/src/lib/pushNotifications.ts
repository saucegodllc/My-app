/**
 * Expo Push Notification helpers.
 * Uses the Expo push API, no native SDK needed on the server.
 */

import { isFeatureEnabled } from "./featureFlags";
import { captureApiError, logLaunchEvent } from "./monitoring";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushMessage = {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
};

export type PushSendResult = {
  attempted: number;
  accepted: boolean;
  status?: number;
  skippedReason?: "feature_disabled" | "invalid_token" | "expo_error" | "network_error";
};

function isExpoPushToken(token: unknown): token is string {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
  );
}

/**
 * Send one or more push notifications via Expo's Push API.
 * Returns delivery-attempt metadata but never throws, so product requests do
 * not fail just because a push provider request did.
 */
export async function sendPush(messages: PushMessage | PushMessage[]): Promise<PushSendResult> {
  try {
    if (!isFeatureEnabled("push")) return { attempted: 0, accepted: false, skippedReason: "feature_disabled" };
    const payload = Array.isArray(messages) ? messages : [messages];
    const valid = payload.filter((m) => {
      const tokens = Array.isArray(m.to) ? m.to : [m.to];
      return tokens.some(isExpoPushToken);
    });
    if (valid.length === 0) return { attempted: 0, accepted: false, skippedReason: "invalid_token" };

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(valid),
    });
    if (!response.ok) {
      logLaunchEvent("push_delivery_failed", { reason: `expo_status_${response.status}` });
      return { attempted: valid.length, accepted: false, status: response.status, skippedReason: "expo_error" };
    }
    return { attempted: valid.length, accepted: true, status: response.status };
  } catch (err) {
    captureApiError(err, { action: "push_delivery" });
    return { attempted: 0, accepted: false, skippedReason: "network_error" };
  }
}

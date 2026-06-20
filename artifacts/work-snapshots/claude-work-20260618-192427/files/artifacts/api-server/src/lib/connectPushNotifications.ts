import { sendPush, type PushMessage } from "./pushNotifications";

export type ConnectPushKind =
  | "message"
  | "friend_accept"
  | "plan_invite"
  | "plan_join"
  | "double_date_match";

export type ConnectThreadPushInput = {
  to: string;
  kind: ConnectPushKind;
  chatId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export function isExpoPushToken(token: unknown): token is string {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
  );
}

export function connectThreadUrl(chatId: string): string {
  return `/chat/${encodeURIComponent(chatId)}`;
}

export function buildConnectThreadPush(input: ConnectThreadPushInput): PushMessage {
  return {
    to: input.to,
    title: input.title,
    body: input.body,
    sound: "default",
    data: {
      ...(input.data ?? {}),
      type: input.kind,
      chatId: input.chatId,
      matchId: input.chatId,
      screen: "connect_thread",
      url: connectThreadUrl(input.chatId),
    },
  };
}

export async function sendConnectThreadPush(input: ConnectThreadPushInput): Promise<void> {
  await sendPush(buildConnectThreadPush(input));
}

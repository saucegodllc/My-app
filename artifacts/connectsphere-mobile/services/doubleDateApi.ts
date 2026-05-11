import { customFetch } from "@workspace/api-client-react";

export type DoubleDateUser = {
  id: string;
  name: string;
  city?: string;
  neighborhood?: string;
  age?: number;
  photoUrl?: string;
  interests?: string[];
  activityStyle?: string[];
  energy?: string;
  activeTonight?: boolean;
};

export type DoubleDatePair = {
  id: string;
  userIds: [string, string];
  createdBy: string;
  status: "active" | "paused";
  vibeTags: string[];
  createdAt: string;
  users: DoubleDateUser[];
  names: string[];
  location?: string;
  activeTonight?: boolean;
  sharedVibeTags?: string[];
  compatibilityHints?: string[];
  score?: number;
};

export type DoubleDateMatch = {
  id: string;
  pairIds: [string, string];
  userIds: [string, string, string, string];
  chatId: string;
  createdAt: string;
  pairs?: DoubleDatePair[];
  users?: DoubleDateUser[];
  lastMessage?: {
    id: string;
    text: string;
    createdAt: string;
    senderId?: string;
    senderUserId?: string;
    system?: boolean;
  };
};

export type DoubleDateChat = {
  id: string;
  type?: "double_date" | string;
  participantIds?: string[];
  title?: string;
  createdAt: string;
};

export type PairResponse = {
  pair: DoubleDatePair | null;
  connectedFriends: DoubleDateUser[];
};

export type FeedResponse = {
  pairs: DoubleDatePair[];
};

export type LikeResponse =
  | { matched: false }
  | {
      matched: true;
      match: DoubleDateMatch;
      chat: DoubleDateChat;
      otherPair: DoubleDatePair;
      allUsers: DoubleDateUser[];
    };

export type ConnectResponse = {
  requests: unknown[];
  connections: unknown[];
  datingMatches: unknown[];
  friendPlans: unknown[];
  opportunityChats: unknown[];
  doubleDateMatches: DoubleDateMatch[];
  chats: Array<DoubleDateChat & { lastMessage?: DoubleDateMatch["lastMessage"]; participants?: DoubleDateUser[] }>;
};

export type ChatResponse = {
  chat?: DoubleDateChat;
  participants?: DoubleDateUser[];
  messages: Array<{
    id: string;
    chatId: string;
    senderId?: string;
    senderUserId?: string;
    text: string;
    createdAt: string;
    system?: boolean;
  }>;
  quickActions?: string[];
};

export function getDoubleDatePair(userId: string) {
  return customFetch<PairResponse>(`/api/dating/double-date/pair/${userId}`);
}

export function createDoubleDatePair(userId: string, buddyUserId: string, vibeTags: string[]) {
  return customFetch<PairResponse>("/api/dating/double-date/pair/create", {
    method: "POST",
    body: JSON.stringify({ userId, buddyUserId, vibeTags }),
  });
}

export function pauseDoubleDatePair(pairId: string, userId: string) {
  return customFetch<{ pair: DoubleDatePair }>("/api/dating/double-date/pair/pause", {
    method: "POST",
    body: JSON.stringify({ pairId, userId }),
  });
}

export function getDoubleDateFeed(pairId: string) {
  return customFetch<FeedResponse>(`/api/dating/double-date/feed/${pairId}`);
}

export function passDoubleDatePair(fromPairId: string, toPairId: string) {
  return customFetch<{ success: true }>("/api/dating/double-date/pass", {
    method: "POST",
    body: JSON.stringify({ fromPairId, toPairId }),
  });
}

export function likeDoubleDatePair(fromPairId: string, toPairId: string, type: "like" | "spark") {
  return customFetch<LikeResponse>("/api/dating/double-date/like", {
    method: "POST",
    body: JSON.stringify({ fromPairId, toPairId, type }),
  });
}

export function getConnect(userId: string) {
  return customFetch<ConnectResponse>(`/api/connect/${userId}`);
}

export function getJsonChat(chatId: string) {
  return customFetch<ChatResponse>(`/api/chats/${chatId}`);
}

export function sendJsonChatMessage(chatId: string, senderUserId: string, text: string) {
  return customFetch<{ message: ChatResponse["messages"][number] }>("/api/messages/send", {
    method: "POST",
    body: JSON.stringify({ chatId, senderUserId, text }),
  });
}

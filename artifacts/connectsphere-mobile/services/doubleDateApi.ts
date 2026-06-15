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
  pairOneId?: string;
  pairTwoId?: string;
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

export type DoubleDateSwipe = {
  id: string;
  swiperPairId: string;
  targetPairId: string;
  direction: "like" | "pass";
  createdBy: string;
  createdAt: string;
};

export type SwipeDoubleDatePairInput = {
  currentPairId: string;
  targetPairId: string;
  direction: "like" | "pass";
  currentUserId: string;
};

export type SwipeResponse =
  | { matched: false; swipe: DoubleDateSwipe }
  | {
      matched: true;
      match: DoubleDateMatch;
      chat?: DoubleDateChat;
      otherPair?: DoubleDatePair;
      allUsers?: DoubleDateUser[];
      alreadyMatched?: boolean;
      swipe?: DoubleDateSwipe;
    };

export type LikeResponse = SwipeResponse;

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

export function createDoubleDatePair(userId: string, friendId: string, vibeTags: string[] = []) {
  return customFetch<PairResponse>("/api/dating/double-date/pair/create", {
    method: "POST",
    body: JSON.stringify({ userId, friendId, buddyUserId: friendId, vibeTags }),
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

export function swipeDoubleDatePair(input: SwipeDoubleDatePairInput) {
  return customFetch<SwipeResponse>("/api/dating/double-date/swipe", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function passDoubleDatePair(fromPairId: string, toPairId: string) {
  return swipeDoubleDatePair({
    currentPairId: fromPairId,
    targetPairId: toPairId,
    direction: "pass",
    currentUserId: "user_self",
  });
}

export function likeDoubleDatePair(fromPairId: string, toPairId: string, type: "like" | "spark") {
  return swipeDoubleDatePair({
    currentPairId: fromPairId,
    targetPairId: toPairId,
    direction: "like",
    currentUserId: "user_self",
  });
}

export function sendDoubleDateShot(fromPairId: string, toPairId: string, message: string) {
  return customFetch<LikeResponse>("/api/dating/double-date/shot", {
    method: "POST",
    body: JSON.stringify({ fromPairId, toPairId, message }),
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

/**
 * connectApi.ts
 * Client service for ConnectSphere Inbox v2:
 *   Primary · Requests · Reactions
 */
import { customFetch } from "@workspace/api-client-react";

// ── Types ─────────────────────────────────────────────────────────────────

export type CsReactionType =
  | "spark"
  | "like"
  | "shot_reaction"
  | "plan_like"
  | "vibe_reaction";

export type CsReactionStatus =
  | "pending"
  | "liked_back"
  | "ignored"
  | "expired"
  | "converted_to_match";

export type CsReactionSourceType = "profile" | "shot" | "plan";

export interface CsReaction {
  id: string;
  senderId: string;
  receiverId: string;
  type: CsReactionType;
  sourceType: CsReactionSourceType;
  sourceId?: string;
  status: CsReactionStatus;
  isBlurredForReceiver: boolean;
  createdAt: string;
  convertedConversationId?: string;
  senderName?: string;
  senderPhotoUrl?: string;
  senderAge?: number;
  senderNeighborhood?: string;
}

export type CsRequestType =
  | "plan_request"
  | "shot_request"
  | "chat_request"
  | "connect_request";

export type CsRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "converted_to_chat";

export type CsRequestSourceType = "shot" | "plan" | "profile";

export interface CsRequest {
  id: string;
  senderId: string;
  receiverId: string;
  type: CsRequestType;
  sourceType: CsRequestSourceType;
  sourceId?: string;
  message?: string;
  status: CsRequestStatus;
  createdAt: string;
  acceptedAt?: string;
  convertedConversationId?: string;
  senderName?: string;
  senderPhotoUrl?: string;
  senderAge?: number;
  senderNeighborhood?: string;
  planTitle?: string;
}

export type CsConversationType = "direct" | "plan" | "match" | "group";
export type CsConversationCategory = "primary" | "archived";

export interface CsConversation {
  id: string;
  participantIds: string[];
  type: CsConversationType;
  category: CsConversationCategory;
  status: "active" | "archived";
  sourceReactionId?: string;
  sourceRequestId?: string;
  hasMessages: boolean;
  createdAt: string;
  lastMessageAt?: string;
  lastMessageText?: string | null;
  lastMessageSenderId?: string;
  lastMessageIsMe?: boolean;
  peerId?: string;
  peerName?: string;
  peerPhotoUrl?: string;
  unreadCount?: number;
}

type ServerMatchThread = {
  id: string;
  chatId?: string;
  userId1: string;
  userId2: string;
  intent?: "dating" | "friends" | "friendship" | string;
  originAction?: string;
  matchedAt?: string;
  otherProfile?: {
    userId?: string;
    id?: string;
    displayName?: string;
    name?: string;
    photos?: string[];
    photoUrl?: string;
    intent?: string;
  };
  lastMessage?: {
    content?: string;
    text?: string;
    senderId?: string;
    createdAt?: string;
  } | null;
  unreadCount?: number;
};

export interface ReactionCounts {
  spark: number;
  like: number;
  shot_reaction: number;
  plan_like: number;
  vibe_reaction: number;
  total: number;
}

// ── Primary Inbox ─────────────────────────────────────────────────────────

export async function getPrimaryInbox(userId: string): Promise<{
  conversations: CsConversation[];
  isPremium: boolean;
}> {
  return customFetch(`/api/inbox/primary/${encodeURIComponent(userId)}`);
}

export async function getConnectConversations(userId: string) {
  return getMutualMatchChats(userId);
}

export async function getMutualMatchChats(userId: string): Promise<{
  conversations: CsConversation[];
}> {
  const result = await customFetch<{ matches: ServerMatchThread[] }>("/api/matches?page=1&limit=100");
  const conversations = (result.matches ?? []).map((match): CsConversation => {
    const other = match.otherProfile;
    const peerId = other?.userId ?? other?.id ?? (match.userId1 === userId ? match.userId2 : match.userId1);
    const lastMessageText = match.lastMessage?.content ?? match.lastMessage?.text ?? null;
    return {
      id: match.chatId ?? match.id,
      participantIds: [match.userId1, match.userId2],
      type: match.intent === "friends" || match.intent === "friendship" || other?.intent === "friendship" ? "direct" : "match",
      category: "primary",
      status: "active",
      hasMessages: Boolean(lastMessageText),
      createdAt: match.matchedAt ?? new Date().toISOString(),
      lastMessageAt: match.lastMessage?.createdAt ?? match.matchedAt,
      lastMessageText,
      lastMessageSenderId: match.lastMessage?.senderId,
      lastMessageIsMe: match.lastMessage?.senderId === userId,
      unreadCount: match.unreadCount ?? 0,
      peerId,
      peerName: other?.displayName ?? other?.name ?? "Match",
      peerPhotoUrl: other?.photos?.[0] ?? other?.photoUrl,
    };
  });
  return { conversations };
}

// ── Requests ──────────────────────────────────────────────────────────────

export async function getInboxRequests(userId: string): Promise<{
  requests: CsRequest[];
  count: number;
}> {
  return customFetch(`/api/inbox/requests/${encodeURIComponent(userId)}`);
}

export async function sendRequest(params: {
  senderId: string;
  receiverId: string;
  type: CsRequestType;
  sourceType?: CsRequestSourceType;
  sourceId?: string;
  message?: string;
  planTitle?: string;
}): Promise<{ ok: boolean; request: CsRequest; duplicate?: boolean }> {
  return customFetch("/api/inbox/requests/send", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function acceptRequest(requestId: string): Promise<{
  ok: boolean;
  request: CsRequest;
  match?: ServerMatchThread;
  chat?: { id: string; matchId: string };
  conversation: CsConversation;
}> {
  return customFetch(`/api/inbox/requests/accept/${requestId}`, {
    method: "POST",
  });
}

export async function declineRequest(requestId: string): Promise<{
  ok: boolean;
  request: CsRequest;
}> {
  return customFetch(`/api/inbox/requests/decline/${requestId}`, {
    method: "POST",
  });
}

// ── Reactions ─────────────────────────────────────────────────────────────

export async function getInboxReactions(userId: string): Promise<{
  reactions: CsReaction[];
  counts: ReactionCounts;
  isPremium: boolean;
}> {
  return customFetch(`/api/inbox/reactions/${encodeURIComponent(userId)}`);
}

export async function sendReaction(params: {
  senderId: string;
  receiverId: string;
  type: CsReactionType;
  sourceType?: CsReactionSourceType;
  sourceId?: string;
}): Promise<{ ok: boolean; reaction: CsReaction; duplicate?: boolean }> {
  return customFetch("/api/inbox/reactions/send", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function likeBackReaction(reactionId: string): Promise<{
  ok: boolean;
  reaction: CsReaction;
  match?: ServerMatchThread;
  chat?: { id: string; matchId: string };
  conversation: CsConversation;
}> {
  return customFetch(`/api/inbox/reactions/like-back/${reactionId}`, {
    method: "POST",
  });
}

export async function ignoreReaction(reactionId: string): Promise<{
  ok: boolean;
  reaction: CsReaction;
}> {
  return customFetch(`/api/inbox/reactions/ignore/${reactionId}`, {
    method: "POST",
  });
}

/**
 * Withdraw a reaction sent by the current user.
 * Called by Rewind to undo a vibe (like) or spark before the other person acts.
 * Safe to fire-and-forget; silently fails if the reaction was already matched.
 */
export async function withdrawReaction(params: {
  senderId: string;
  receiverId: string;
  type: "like" | "spark";
}): Promise<{ ok: boolean; withdrawn: boolean }> {
  return customFetch("/api/inbox/reactions/withdraw", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ── Messages ──────────────────────────────────────────────────────────────

export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<{ messages: Array<{ id: string; text: string; senderUserId: string; createdAt: string }>; conversation: CsConversation }> {
  return customFetch(
    `/api/inbox/messages/${conversationId}?userId=${encodeURIComponent(userId)}`
  );
}

export async function getConnectConversation(conversationId: string, userId: string) {
  return getConversationMessages(conversationId, userId);
}

export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  text: string;
}): Promise<{ ok: boolean; message: { id: string; text: string; senderUserId: string; createdAt: string } }> {
  return customFetch("/api/inbox/messages/send", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function sendMatchThreadMessage(params: {
  conversationId: string;
  text: string;
}): Promise<{ id: string; content: string; senderId: string; createdAt: string }> {
  return customFetch(`/api/messages/${encodeURIComponent(params.conversationId)}`, {
    method: "POST",
    body: JSON.stringify({ content: params.text }),
  });
}

export async function sendConnectConversationMessage(params: {
  conversationId: string;
  senderId: string;
  text: string;
}) {
  return sendMessage(params);
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Human-readable label for a request type */
export function requestLabel(type: CsRequestType, name: string, planTitle?: string): string {
  switch (type) {
    case "shot_request":
      return `${name} shot their shot`;
    case "plan_request":
      return planTitle ? `${name} wants to join "${planTitle}"` : `${name} wants to make plans`;
    case "chat_request":
      return `${name} wants to turn this into a chat`;
    case "connect_request":
    default:
      return `${name} asked to connect`;
  }
}

/** Icon name (Ionicons) for a reaction type */
export function reactionIcon(type: CsReactionType): string {
  switch (type) {
    case "spark":
      return "flash";
    case "like":
      return "heart";
    case "shot_reaction":
      return "basketball";
    case "plan_like":
      return "calendar";
    case "vibe_reaction":
      return "musical-notes";
    default:
      return "star";
  }
}

/** Tint colour for a reaction type */
export function reactionColor(type: CsReactionType): string {
  switch (type) {
    case "spark":
      return "#C084FC";
    case "like":
      return "#FF2DA8";
    case "shot_reaction":
      return "#FB923C";
    case "plan_like":
      return "#34D399";
    case "vibe_reaction":
      return "#60A5FA";
    default:
      return "#FF2DA8";
  }
}

/** Marketing headline for a reaction count */
export function reactionHeadline(counts: ReactionCounts): string {
  const { total, spark, shot_reaction } = counts;
  if (total === 0) return "New Sparks near you";
  if (shot_reaction > 0) return `${shot_reaction} ${shot_reaction === 1 ? "person" : "people"} shot their shot`;
  if (spark > 0) return `${spark} ${spark === 1 ? "person" : "people"} sparked your vibe`;
  return `${total} ${total === 1 ? "person likes" : "people like"} your energy`;
}

/**
 * buildLocalConvs.ts
 *
 * Pure helper extracted from the localConvs useMemo in matches.tsx.
 * Kept as a standalone function so it can be unit-tested without React.
 *
 * Converts local DatingMatchContext matches into the CsConversation-compatible
 * shape used by the Connect inbox.  The critical invariant:
 *
 *   isLocal: true  → match has a localChats entry → route to /chat/dating/[id]
 *   isLocal: false → server-sourced match or no local chat entry → route via openChat()
 *
 * Server-sourced matches appear when the user just performed a like-back/accept
 * and DatingMatchContext added the match with source:"server" before the API's
 * primaryConvs refresh completes.  Without the local chat they used to dead-end
 * at "Chat unavailable".  This helper flags them as isLocal: false so they
 * take the openChat() branch instead.
 */

export interface LocalMatch {
  id: string;
  chatId?: string;
  profile: {
    id: string;
    name: string;
    photos?: string[];
  };
  createdAt: string;
}

export interface LocalChat {
  id: string;
  messages: Array<{ senderId: string; text?: string; createdAt: string }>;
}

export interface LocalConv {
  id: string;
  peerId: string;
  peerName: string;
  peerPhotoUrl: string | undefined;
  lastMessageText: string | undefined;
  lastMessageAt: string;
  lastMessageIsMe: boolean;
  hasMessages: boolean;
  type: "match";
  createdAt: string;
  isLocal: boolean;
  localChatId: string | undefined;
}

export function buildLocalConvs(
  localMatches: LocalMatch[],
  localChats: LocalChat[],
  serverPeerIds: Set<string>,
  currentUserId: string | null | undefined,
): LocalConv[] {
  return localMatches
    .filter((match) => !serverPeerIds.has(match.profile.id))
    .map((match) => {
      const chat = localChats.find((c) => c.id === match.chatId);
      // Server-sourced matches have no local chat entry.  Route them via
      // openChat() so they don't dead-end at "Chat unavailable".
      const hasLocalChat = !!chat;
      const nonSystem = chat?.messages.filter((m) => m.senderId !== "system") ?? [];
      const last = nonSystem[nonSystem.length - 1];
      return {
        id: hasLocalChat ? match.id : (match.chatId ?? match.id),
        peerId: match.profile.id,
        peerName: match.profile.name,
        peerPhotoUrl: match.profile.photos?.[0],
        lastMessageText: last?.text,
        lastMessageAt: last?.createdAt ?? match.createdAt,
        lastMessageIsMe: last?.senderId === currentUserId,
        hasMessages: nonSystem.length > 0,
        type: "match" as const,
        createdAt: match.createdAt,
        isLocal: hasLocalChat,
        localChatId: match.chatId,
      };
    });
}

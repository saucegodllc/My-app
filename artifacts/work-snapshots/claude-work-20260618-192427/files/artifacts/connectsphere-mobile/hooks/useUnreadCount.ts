/**
 * useUnreadCount
 *
 * Returns the total number of unread conversations so the Connect tab badge
 * can show a live count. Polls every 30s when the app is foregrounded.
 *
 * Usage:
 *   const unreadCount = useUnreadCount();
 *   // → number (0 means no badge)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { getMutualMatchChats, type CsConversation } from "@/services/connectApi";
import { useSessionState } from "@/hooks/useSessionState";

const POLL_INTERVAL_MS = 30_000;

function countUnread(conversations: CsConversation[]): number {
  return conversations.filter((c) => {
    // A conversation is "unread" if the last message wasn't sent by the
    // current user AND its unreadCount > 0 (or we fall back to isRead flag).
    const unread = (c as any).unreadCount ?? ((c as any).isRead === false ? 1 : 0);
    return unread > 0;
  }).length;
}

export function useUnreadCount(): number {
  const { userId } = useSessionState();
  const [count, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    if (!userId) return;
    try {
      const inbox = await getMutualMatchChats(userId);
      const conversations: CsConversation[] = (inbox as any).conversations ?? [];
      if (mountedRef.current) {
        setCount(countUnread(conversations));
      }
    } catch {
      // Network error — keep previous count
    }
  }, [userId]);

  // Fetch on mount + start polling
  useEffect(() => {
    mountedRef.current = true;
    void fetchCount();
    timerRef.current = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCount]);

  // Refetch when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void fetchCount();
    });
    return () => sub.remove();
  }, [fetchCount]);

  return count;
}

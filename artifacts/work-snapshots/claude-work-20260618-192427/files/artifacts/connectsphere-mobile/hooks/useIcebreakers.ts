/**
 * useIcebreakers
 * ─────────────
 * Fetches 3 personalised conversation starters for a new match.
 * Results are cached in AsyncStorage so they only appear once
 * (disappear after the first real message is sent).
 *
 * Usage in chat screen:
 *   const { icebreakers, dismiss } = useIcebreakers(matchId, hasUserMessages);
 */
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiUrl } from "@/lib/apiBase";

const CACHE_PREFIX = "icebreakers_v1_";
const DISMISSED_PREFIX = "icebreakers_dismissed_v1_";

type UseIcebreakersResult = {
  icebreakers: string[];
  loading: boolean;
  dismiss: () => void;
};

export function useIcebreakers(
  matchId: string | undefined,
  hasMessages: boolean,
): UseIcebreakersResult {
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matchId || hasMessages) return;

    async function load() {
      const dismissKey = `${DISMISSED_PREFIX}${matchId}`;
      const cacheKey = `${CACHE_PREFIX}${matchId}`;

      // Don't show if already dismissed
      const dismissed = await AsyncStorage.getItem(dismissKey);
      if (dismissed === "1") return;

      // Return cached openers if available
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setIcebreakers(JSON.parse(cached));
        return;
      }

      // Fetch from API
      setLoading(true);
      try {
        const url = `${apiUrl}/api/icebreakers?matchId=${encodeURIComponent(matchId!)}`;
        const res = await fetch(url, { credentials: "include" });
        if (res.ok) {
          const data: { icebreakers: string[] } = await res.json();
          setIcebreakers(data.icebreakers);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data.icebreakers));
        }
      } catch {
        // Non-critical — chat still works without icebreakers
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [matchId, hasMessages]);

  const dismiss = useCallback(async () => {
    if (!matchId) return;
    setIcebreakers([]);
    await AsyncStorage.setItem(`${DISMISSED_PREFIX}${matchId}`, "1");
  }, [matchId]);

  return { icebreakers, loading, dismiss };
}

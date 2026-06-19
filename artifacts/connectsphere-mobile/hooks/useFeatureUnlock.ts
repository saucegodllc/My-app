/**
 * useFeatureUnlock
 * ─────────────────
 * React hook for the progressive feature unlock system.
 * Provides both sync reads and async writes.
 *
 * Usage:
 *   const { milestone, isUnlocked, unlock, newUnlockLabel } = useFeatureUnlock();
 *
 *   // Gate a UI section:
 *   if (!isUnlocked("eventsTab")) return <LockedFeaturePlaceholder />;
 *
 *   // Record a milestone:
 *   const newLabel = await unlock(MILESTONES.FIRST_MATCH, totalMatches);
 *   if (newLabel) showToast(newLabel);
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MILESTONES,
  type Milestone,
  type FeatureKey,
  FEATURE_GATES,
  getUnlockedMilestone,
  advanceMilestone,
  MILESTONE_UNLOCKS,
} from "@/lib/featureUnlock";

type UseFeatureUnlockResult = {
  /** Current highest unlocked milestone (0–6) */
  milestone: Milestone;
  /** Whether a given feature is currently unlocked */
  isUnlocked: (feature: FeatureKey) => boolean;
  /** Advance to a milestone; returns the unlock toast label if this is new */
  unlock: (m: Milestone) => Promise<string | null>;
  /** Reload from storage (call after background sync) */
  reload: () => Promise<void>;
};

export function useFeatureUnlock(): UseFeatureUnlockResult {
  const [milestone, setMilestone] = useState<Milestone>(MILESTONES.SIGNED_UP);
  const loaded = useRef(false);

  useEffect(() => {
    getUnlockedMilestone().then((m) => {
      setMilestone(m);
      loaded.current = true;
    });
  }, []);

  const isUnlocked = useCallback(
    (feature: FeatureKey): boolean => {
      return milestone >= FEATURE_GATES[feature];
    },
    [milestone],
  );

  const unlock = useCallback(
    async (m: Milestone): Promise<string | null> => {
      const isNew = await advanceMilestone(m);
      if (isNew) {
        setMilestone((prev) => Math.max(prev, m) as Milestone);
        return MILESTONE_UNLOCKS[m] ?? null;
      }
      return null;
    },
    [],
  );

  const reload = useCallback(async () => {
    const m = await getUnlockedMilestone();
    setMilestone(m);
  }, []);

  return { milestone, isUnlocked, unlock, reload };
}

import { useEffect } from "react";

import { getFirebaseRuntime } from "@/services/connections/firebaseClient";
import { subscribeToUserConnections } from "@/services/connections/firestoreConnections";
import type { ConnectionDocument } from "@/services/connections/types";

type ListenerOptions = {
  currentUserId: string | null | undefined;
  enabled: boolean;
  onConnections: (connections: ConnectionDocument[]) => void;
  onError: (error: Error) => void;
};

export function useFirestoreConnectionsListener({
  currentUserId,
  enabled,
  onConnections,
  onError,
}: ListenerOptions) {
  useEffect(() => {
    if (!enabled || !currentUserId) return;

    const runtime = getFirebaseRuntime();
    if (!runtime) {
      onError(new Error("Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* values to enable Firestore."));
      return;
    }

    return subscribeToUserConnections(runtime.db, currentUserId, onConnections, onError);
  }, [currentUserId, enabled, onConnections, onError]);
}

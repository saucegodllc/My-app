import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useFirestoreConnectionsListener } from "@/hooks/useFirestoreConnections";
import { shouldUseDemoSeeds } from "@/lib/launchConfig";
import { getFirebaseRuntime } from "@/services/connections/firebaseClient";
import { seedMockConnectionsToFirestore } from "@/services/connections/firestoreConnections";
import {
  buildMockConnectionsForSoloTesting,
  getConnectionBuckets,
  sortConnectionsForInbox,
} from "@/services/connections/mockConnections";
import type { ConnectionBuckets, ConnectionDocument } from "@/services/connections/types";

type ConnectionsContextValue = {
  connections: ConnectionDocument[];
  buckets: ConnectionBuckets;
  loading: boolean;
  error: string | null;
  firestoreEnabled: boolean;
  seedLocalMockConnections: (currentUserId: string) => ConnectionDocument[];
  seedFirestoreMockConnections: (currentUserId: string) => Promise<ConnectionDocument[]>;
  setConnectionsFromFirestore: (connections: ConnectionDocument[]) => void;
};

const EMPTY_BUCKETS: ConnectionBuckets = {
  all: [],
  dating: [],
  friend: [],
  plan: [],
};

const ConnectionsContext = createContext<ConnectionsContextValue | null>(null);

export function ConnectionsProvider({
  currentUserId,
  children,
}: {
  currentUserId: string | null | undefined;
  children: ReactNode;
}) {
  const [connections, setConnections] = useState<ConnectionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Firebase config is optional for local UI work. When missing, the provider
  // still exposes `seedLocalMockConnections` so the Connect tab can be tested.
  const firestoreEnabled = getFirebaseRuntime() !== null;

  const setConnectionsFromFirestore = useCallback((nextConnections: ConnectionDocument[]) => {
    setConnections(sortConnectionsForInbox(nextConnections));
    setLoading(false);
    setError(null);
  }, []);

  const handleListenerError = useCallback((listenerError: Error) => {
    setLoading(false);
    setError(listenerError.message);
  }, []);

  useFirestoreConnectionsListener({
    currentUserId,
    enabled: firestoreEnabled,
    onConnections: setConnectionsFromFirestore,
    onError: handleListenerError,
  });

  const seedLocalMockConnections = useCallback((userId: string) => {
    // Guard: only available in dev/demo builds — never in production.
    if (!shouldUseDemoSeeds) {
      if (__DEV__) console.warn("seedLocalMockConnections: EXPO_PUBLIC_ENABLE_DEMO_SEEDS is false");
      return [] as ConnectionDocument[];
    }
    // This path never touches the network. It is useful for simulator work,
    // screenshots, and testing state transitions without another real account.
    const mockConnections = sortConnectionsForInbox(buildMockConnectionsForSoloTesting(userId));
    setConnections(mockConnections);
    setLoading(false);
    setError(null);
    return mockConnections;
  }, []);

  const seedFirestoreMockConnections = useCallback(async (userId: string) => {
    // Guard: only available in dev/demo builds — never in production.
    if (!shouldUseDemoSeeds) {
      if (__DEV__) console.warn("seedFirestoreMockConnections: EXPO_PUBLIC_ENABLE_DEMO_SEEDS is false");
      return [] as ConnectionDocument[];
    }
    const runtime = getFirebaseRuntime();
    if (!runtime) {
      // The same call can be used in development regardless of Firebase setup:
      // with config it seeds Firestore, without config it falls back locally.
      const mockConnections = seedLocalMockConnections(userId);
      setError("Firebase is not configured, so mock connections were loaded into local state only.");
      return mockConnections;
    }

    const seeded = await seedMockConnectionsToFirestore(runtime.db, userId);
    setConnections(sortConnectionsForInbox(seeded));
    setLoading(false);
    setError(null);
    return seeded;
  }, [seedLocalMockConnections]);

  const buckets = useMemo(() => (connections.length ? getConnectionBuckets(connections) : EMPTY_BUCKETS), [connections]);

  const value = useMemo<ConnectionsContextValue>(
    () => ({
      connections,
      buckets,
      loading,
      error,
      firestoreEnabled,
      seedLocalMockConnections,
      seedFirestoreMockConnections,
      setConnectionsFromFirestore,
    }),
    [
      buckets,
      connections,
      error,
      firestoreEnabled,
      loading,
      seedFirestoreMockConnections,
      seedLocalMockConnections,
      setConnectionsFromFirestore,
    ],
  );

  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>;
}

export function useConnections() {
  const ctx = useContext(ConnectionsContext);
  if (!ctx) {
    throw new Error("useConnections must be used inside <ConnectionsProvider>");
  }
  return ctx;
}

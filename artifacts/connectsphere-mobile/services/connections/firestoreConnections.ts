import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { buildMockConnectionsForSoloTesting } from "./mockConnections";
import type { ConnectionDocument, ConnectionLastMessage, ConnectionUnreadState } from "./types";

const CONNECTIONS_COLLECTION = "connections";

// Firestore may return native Timestamp values in production and ISO strings
// from local mocks/imports. Normalize both so the UI can sort safely.
function timestampToIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

// Keep unread data defensive because old documents or manual test records may
// be incomplete. Missing unread state becomes a harmless "read" state.
function normalizeUnreadMap(value: unknown): Record<string, ConnectionUnreadState> {
  if (!value || typeof value !== "object") return {};

  return Object.entries(value as Record<string, Partial<ConnectionUnreadState>>).reduce<
    Record<string, ConnectionUnreadState>
  >((acc, [userId, unread]) => {
    acc[userId] = {
      hasUnread: unread.hasUnread === true,
      count: typeof unread.count === "number" ? unread.count : 0,
      lastReadAt: unread.lastReadAt ?? null,
    };
    return acc;
  }, {});
}

// The inbox preview needs only one message. Full message history should remain
// in the chat/messages model so this document stays small.
function normalizeLastMessage(value: unknown): ConnectionLastMessage {
  const message = value && typeof value === "object" ? (value as Partial<ConnectionLastMessage>) : {};
  return {
    text: typeof message.text === "string" ? message.text : "",
    senderUserId: typeof message.senderUserId === "string" ? message.senderUserId : null,
    createdAt: timestampToIso(message.createdAt),
  };
}

// Convert raw Firestore data into the strict app-level shape. This is the only
// place where loose Firestore data is allowed to enter the Connect domain.
export function connectionFromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>): ConnectionDocument {
  const data = snapshot.data();
  const fallbackDate = timestampToIso(data.updatedAt ?? data.createdAt);

  return {
    id: snapshot.id,
    participantUserIds: Array.isArray(data.participantUserIds) ? data.participantUserIds.map(String) : [],
    type: data.type === "friend" || data.type === "plan" ? data.type : "dating",
    sourceId: typeof data.sourceId === "string" ? data.sourceId : snapshot.id,
    createdAt: timestampToIso(data.createdAt ?? fallbackDate),
    updatedAt: timestampToIso(data.updatedAt ?? fallbackDate),
    lastMessage: normalizeLastMessage(data.lastMessage),
    unreadByUserId: normalizeUnreadMap(data.unreadByUserId),
    participantPreviews:
      data.participantPreviews && typeof data.participantPreviews === "object" ? data.participantPreviews : {},
    previewTitle: typeof data.previewTitle === "string" ? data.previewTitle : "Connection",
    previewSubtitle: typeof data.previewSubtitle === "string" ? data.previewSubtitle : "",
    location:
      data.location && typeof data.location === "object"
        ? { city: "Miami", neighborhood: String(data.location.neighborhood ?? "Miami"), venueName: data.location.venueName }
        : { city: "Miami", neighborhood: "Miami" },
    archivedByUserId:
      data.archivedByUserId && typeof data.archivedByUserId === "object" ? data.archivedByUserId : {},
  };
}

export function subscribeToUserConnections(
  db: Firestore,
  userId: string,
  onConnections: (connections: ConnectionDocument[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  // `array-contains` is the critical privacy filter: each client only receives
  // connection documents where the signed-in user participates.
  const connectionsQuery = query(
    collection(db, CONNECTIONS_COLLECTION),
    where("participantUserIds", "array-contains", userId),
  );

  return onSnapshot(
    connectionsQuery,
    (snapshot) => {
      onConnections(
        snapshot.docs
          .map(connectionFromFirestore)
          .filter((connection) => connection.archivedByUserId[userId] !== true),
      );
    },
    onError,
  );
}

export async function upsertConnection(db: Firestore, connection: ConnectionDocument) {
  await setDoc(
    doc(db, CONNECTIONS_COLLECTION, connection.id),
    {
      ...connection,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// Solo test seeding writes deterministic records so repeated runs update the
// same five documents instead of creating inbox clutter.
export async function seedMockConnectionsToFirestore(db: Firestore, currentUserId: string) {
  const batch = writeBatch(db);
  const mockConnections = buildMockConnectionsForSoloTesting(currentUserId);

  for (const connection of mockConnections) {
    batch.set(doc(db, CONNECTIONS_COLLECTION, connection.id), connection, { merge: true });
  }

  await batch.commit();
  return mockConnections;
}

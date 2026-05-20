export const CONNECTION_TYPES = ["dating", "friend", "plan"] as const;

export type ConnectionType = (typeof CONNECTION_TYPES)[number];

// Per-user unread state lives directly on the connection document so the inbox can
// render badges without fetching messages. Each participant owns one key.
export type ConnectionUnreadState = {
  hasUnread: boolean;
  count: number;
  lastReadAt: string | null;
};

export type ConnectionLastMessage = {
  text: string;
  senderUserId: string | null;
  createdAt: string;
};

// Denormalized participant data keeps the Connect tab fast. The profile screen
// can still fetch the full user later, but the inbox should not need to.
export type ConnectionParticipantPreview = {
  userId: string;
  displayName: string;
  photoUrl?: string;
};

export type ConnectionLocationPreview = {
  city: "Miami";
  neighborhood: string;
  venueName?: string;
};

// This is the Firestore document contract for the Connect tab. It intentionally
// supports all three creation sources: dating matches, accepted friend requests,
// and joined plans.
export type ConnectionDocument = {
  id: string;
  participantUserIds: string[];
  type: ConnectionType;
  sourceId: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: ConnectionLastMessage;
  unreadByUserId: Record<string, ConnectionUnreadState>;
  participantPreviews: Record<string, ConnectionParticipantPreview>;
  previewTitle: string;
  previewSubtitle: string;
  location: ConnectionLocationPreview;
  archivedByUserId: Record<string, boolean>;
};

export type ConnectionBuckets = {
  all: ConnectionDocument[];
  dating: ConnectionDocument[];
  friend: ConnectionDocument[];
  plan: ConnectionDocument[];
};

export type CreateConnectionInput = {
  id?: string;
  participantUserIds: string[];
  type: ConnectionType;
  sourceId: string;
  lastMessageText: string;
  lastMessageSenderUserId?: string | null;
  participantPreviews: Record<string, ConnectionParticipantPreview>;
  previewTitle: string;
  previewSubtitle: string;
  location: ConnectionLocationPreview;
  createdAt?: string;
};

# Connect Tab Firestore Architecture

## Collection: `connections`

Each document ID is the unique connection ID. The client also stores the same value in `id` so local mocks, Firestore snapshots, and UI rows share one shape.

```ts
type ConnectionDocument = {
  id: string;
  participantUserIds: string[];
  type: "dating" | "friend" | "plan";
  sourceId: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: {
    text: string;
    senderUserId: string | null;
    createdAt: string;
  };
  unreadByUserId: Record<string, {
    hasUnread: boolean;
    count: number;
    lastReadAt: string | null;
  }>;
  participantPreviews: Record<string, {
    userId: string;
    displayName: string;
    photoUrl?: string;
  }>;
  previewTitle: string;
  previewSubtitle: string;
  location: {
    city: "Miami";
    neighborhood: string;
    venueName?: string;
  };
  archivedByUserId: Record<string, boolean>;
};
```

## Listener Query

The frontend listens with:

```ts
query(
  collection(db, "connections"),
  where("participantUserIds", "array-contains", currentUserId),
)
```

The app sorts by `lastMessage.createdAt` locally. This keeps the Firestore index requirement simple.

## Security Rule Intent

Production rules should allow reads only when `request.auth.uid` is in `participantUserIds`. Writes should be performed by trusted backend code or Cloud Functions when dating matches, accepted friend requests, or joined plans are created.

```js
match /connections/{connectionId} {
  allow read: if request.auth != null
    && request.auth.uid in resource.data.participantUserIds;

  allow create, update, delete: if false;
}
```

## Local Seeding

To write five Miami mock connections to Firestore:

```sh
pnpm --filter @workspace/connectsphere-mobile run seed:connections user_self
```

To seed local in-memory state from the app, call:

```ts
const { seedLocalMockConnections } = useConnections();
seedLocalMockConnections(currentUserId);
```

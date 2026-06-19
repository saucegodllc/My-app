import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMockConnectionsForSoloTesting,
  getConnectionBuckets,
  sortConnectionsForInbox,
} from "./mockConnections.ts";

describe("buildMockConnectionsForSoloTesting", () => {
  it("creates five Miami connections for the current user with the required type mix", () => {
    const currentUserId = "user_self";
    const connections = buildMockConnectionsForSoloTesting(currentUserId);

    assert.equal(connections.length, 5);
    assert.equal(connections.filter((item) => item.type === "dating").length, 2);
    assert.equal(connections.filter((item) => item.type === "friend").length, 2);
    assert.equal(connections.filter((item) => item.type === "plan").length, 1);

    for (const connection of connections) {
      assert.ok(connection.id.startsWith("mock_connection_"));
      assert.ok(connection.participantUserIds.includes(currentUserId));
      assert.ok(connection.sourceId.length > 0);
      assert.ok(connection.lastMessage.text.length > 0);
      assert.ok(connection.lastMessage.createdAt.length > 0);
      assert.equal(typeof connection.unreadByUserId[currentUserId]?.hasUnread, "boolean");
      assert.equal(typeof connection.unreadByUserId[currentUserId]?.count, "number");
      assert.ok(connection.previewTitle.length > 0);
      assert.equal(connection.location.city, "Miami");
    }
  });
});

describe("connection selectors", () => {
  it("sorts newest messages first and separates the enum buckets for UI filters", () => {
    const currentUserId = "user_self";
    const connections = buildMockConnectionsForSoloTesting(currentUserId);
    const sorted = sortConnectionsForInbox(connections);
    const buckets = getConnectionBuckets(sorted);

    assert.deepEqual(
      sorted.map((item) => item.id),
      [...sorted]
        .sort(
          (a, b) =>
            new Date(b.lastMessage.createdAt).getTime() -
            new Date(a.lastMessage.createdAt).getTime(),
        )
        .map((item) => item.id),
    );
    assert.equal(buckets.all.length, 5);
    assert.equal(buckets.dating.length, 2);
    assert.equal(buckets.friend.length, 2);
    assert.equal(buckets.plan.length, 1);
  });
});

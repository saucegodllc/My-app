const selectResults: unknown[][] = [];
const insertResults: unknown[][] = [];

function makeSelectBuilder() {
  const next = () => selectResults.shift() ?? [];
  const builder: Record<string, jest.Mock> & PromiseLike<unknown[]> = {
    from: jest.fn(() => builder),
    where: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    limit: jest.fn(async () => next()),
    then: jest.fn((resolve, reject) => Promise.resolve(next()).then(resolve, reject)),
  };
  return builder;
}

function makeInsertBuilder() {
  const builder = {
    values: jest.fn(() => builder),
    returning: jest.fn(async () => insertResults.shift() ?? []),
  };
  return builder;
}

jest.mock("@workspace/db", () => ({
  db: {
    select: jest.fn(() => makeSelectBuilder()),
    insert: jest.fn(() => makeInsertBuilder()),
  },
  blocksTable: {
    id: "blocks.id",
    blockerUserId: "blocks.blocker_user_id",
    blockedUserId: "blocks.blocked_user_id",
  },
  matchesTable: {
    id: "matches.id",
    userId1: "matches.user_id_1",
    userId2: "matches.user_id_2",
  },
  messagesTable: {
    matchId: "chat_messages.match_id",
    senderId: "chat_messages.sender_id",
    isRead: "chat_messages.is_read",
    createdAt: "chat_messages.created_at",
  },
  profilesTable: {
    userId: "profiles.user_id",
  },
}));

describe("ensureMatchThread", () => {
  beforeEach(() => {
    selectResults.length = 0;
    insertResults.length = 0;
    jest.resetModules();
  });

  it("returns an existing mutual match instead of creating a duplicate chat", async () => {
    const existing = { id: "match_existing", userId1: "user_a", userId2: "user_b", matchedAt: new Date("2026-06-01T12:00:00Z") };
    selectResults.push([], [existing]);

    const { ensureMatchThread } = await import("./lib/matchThreads");
    const result = await ensureMatchThread({ userId1: "user_a", userId2: "user_b", originAction: "like" });

    expect(result).toEqual({ match: existing, created: false });
  });

  it("creates one server match thread when no mutual chat exists yet", async () => {
    const created = { id: "match_new", userId1: "user_a", userId2: "user_b", matchedAt: new Date("2026-06-01T12:00:00Z") };
    selectResults.push([], []);
    insertResults.push([created]);

    const { ensureMatchThread } = await import("./lib/matchThreads");
    const result = await ensureMatchThread({ userId1: "user_a", userId2: "user_b", originAction: "spark" });

    expect(result).toEqual({ match: created, created: true });
  });

  it("blocks chat creation when either user blocked the other", async () => {
    selectResults.push([{ id: "block_1" }]);

    const { ensureMatchThread } = await import("./lib/matchThreads");
    await expect(ensureMatchThread({ userId1: "user_a", userId2: "user_b", originAction: "shot" }))
      .rejects
      .toMatchObject({ status: 403, message: "This connection is blocked." });
  });
});

import express from "express";
import request from "supertest";

const mockSelectResults: unknown[][] = [];
const mockInsertResults: unknown[][] = [];
const mockEnsureMatchThread = jest.fn();

function makeSelectBuilder() {
  const next = () => mockSelectResults.shift() ?? [];
  const builder: Record<string, jest.Mock> & PromiseLike<unknown[]> = {
    from: jest.fn(() => builder),
    where: jest.fn(() => builder),
    limit: jest.fn(async () => next()),
    then: jest.fn((resolve, reject) => Promise.resolve(next()).then(resolve, reject)),
  };
  return builder;
}

function makeInsertBuilder() {
  const builder: Record<string, jest.Mock> = {
    values: jest.fn(() => builder),
    onConflictDoUpdate: jest.fn(() => builder),
    onConflictDoNothing: jest.fn(() => builder),
    returning: jest.fn(async () => mockInsertResults.shift() ?? []),
  };
  return builder;
}

const mockDb = {
  select: jest.fn(() => makeSelectBuilder()),
  insert: jest.fn(() => makeInsertBuilder()),
};

jest.mock("@workspace/db", () => ({
  db: mockDb,
  profilesTable: { userId: "profiles.user_id", isPremium: "profiles.is_premium" },
  likesTable: {
    id: "likes.id",
    fromUserId: "likes.from_user_id",
    toUserId: "likes.to_user_id",
    action: "likes.action",
    createdAt: "likes.created_at",
  },
  matchesTable: {
    id: "matches.id",
    userId1: "matches.user_id_1",
    userId2: "matches.user_id_2",
  },
  blocksTable: {
    blockerUserId: "blocks.blocker_user_id",
    blockedUserId: "blocks.blocked_user_id",
  },
  discoveryActionUsageTable: {
    userId: "discovery_action_usage.user_id",
    dateKey: "discovery_action_usage.date_key",
    actionBucket: "discovery_action_usage.action_bucket",
    count: "discovery_action_usage.count",
    updatedAt: "discovery_action_usage.updated_at",
  },
}));

jest.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: "user-a" }),
}));

jest.mock("./launchGuards", () => ({
  shouldUseLocalDbFallback: () => false,
}));

jest.mock("./middlewares/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock("./lib/matchThreads", () => ({
  MatchThreadError: class MatchThreadError extends Error {
    status = 400;
  },
  ensureMatchThread: (...args: unknown[]) => mockEnsureMatchThread(...args),
  buildMatchThreadResponse: jest.fn(async ({ match }) => ({ ...match, chatId: match.id })),
}));

function makeApp() {
  const discoveryRouter = require("./routes/discovery").default;
  const app = express();
  app.use(express.json());
  app.use("/api", discoveryRouter);
  return app;
}

describe("POST /api/discovery/action hardening", () => {
  beforeEach(() => {
    mockSelectResults.length = 0;
    mockInsertResults.length = 0;
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockEnsureMatchThread.mockReset();
    jest.resetModules();
  });

  it("allows five free dating swipes, then rejects with 429", async () => {
    const app = makeApp();

    for (let i = 0; i < 5; i += 1) {
      mockSelectResults.push(
        [], // block check
        [], // existing like
        [{ isPremium: false }],
        [{ count: i }], // current remaining query
        [], // reciprocal like
      );
      mockInsertResults.push([{ count: i + 1 }]);

      const response = await request(app)
        .post("/api/discovery/action")
        .send({ targetUserId: `user-${i}`, action: "like" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ matched: false, pending: true, remainingSwipes: 4 - i });
    }

    mockSelectResults.push(
      [], // block check
      [], // existing like
      [{ isPremium: false }],
      [{ count: 5 }],
    );
    mockInsertResults.push([]);

    const limited = await request(app)
      .post("/api/discovery/action")
      .send({ targetUserId: "user-limit", action: "like" });

    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({
      code: "SWIPE_LIMIT_REACHED",
      remainingSwipes: 0,
      premiumRequired: true,
    });
  });

  it("does not insert or consume usage for a duplicate swipe", async () => {
    const app = makeApp();
    mockSelectResults.push(
      [], // block check
      [{ id: "like-1", fromUserId: "user-a", toUserId: "user-b", action: "like" }],
      [{ isPremium: false }],
      [{ count: 1 }],
      [], // reciprocal like
    );

    const response = await request(app)
      .post("/api/discovery/action")
      .send({ targetUserId: "user-b", action: "like" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ matched: false, pending: true, remainingSwipes: 4 });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns an existing mutual match for duplicate retries without creating another match", async () => {
    const app = makeApp();
    const existingMatch = { id: "match-1", userId1: "user-a", userId2: "user-b", matchedAt: "2026-06-26T12:00:00.000Z" };

    mockSelectResults.push(
      [], // block check
      [{ id: "like-1", fromUserId: "user-a", toUserId: "user-b", action: "like" }],
      [{ isPremium: false }],
      [{ count: 1 }],
      [{ id: "like-2", fromUserId: "user-b", toUserId: "user-a", action: "like" }],
      [existingMatch],
    );

    const response = await request(app)
      .post("/api/discovery/action")
      .send({ targetUserId: "user-b", action: "like" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ matched: true, chatId: "match-1", remainingSwipes: 4 });
    expect(mockEnsureMatchThread).not.toHaveBeenCalled();
  });
});

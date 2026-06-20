/**
 * inboxRoutes.test.ts
 *
 * Integration tests for the Inbox v2 Express routes in friends.ts.
 * Tests hit the real Express router with a temp db.json — no mocked fetch.
 *
 * Routes covered (12 total):
 *   GET  /api/inbox/primary/:userId
 *   GET  /api/inbox/requests/:userId
 *   POST /api/inbox/requests/send
 *   POST /api/inbox/requests/accept/:id
 *   POST /api/inbox/requests/decline/:id
 *   GET  /api/inbox/reactions/:userId
 *   POST /api/inbox/reactions/send
 *   POST /api/inbox/reactions/like-back/:id
 *   POST /api/inbox/reactions/ignore/:id
 *   POST /api/inbox/reactions/withdraw
 *   GET  /api/inbox/messages/:conversationId
 *   POST /api/inbox/messages/send
 */

import express from "express";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import request from "supertest";
import friendsRouter from "./routes/friends";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("./lib/matchThreads", () => ({
  ensureMatchThread: jest.fn(async ({ userId1, userId2 }: any) => ({
    match: {
      id: `match-${userId1}-${userId2}`,
      userId1,
      userId2,
      matchedAt: new Date("2026-06-01T12:00:00.000Z"),
    },
    created: true,
  })),
  buildMatchThreadResponse: jest.fn(async ({ match, viewerUserId }: any) => ({
    ...match,
    chatId: match.id,
    otherProfile: {
      userId: match.userId1 === viewerUserId ? match.userId2 : match.userId1,
      displayName: "Test User",
      intent: "friendship",
    },
    lastMessage: null,
    unreadCount: 0,
  })),
}));

jest.mock("./lib/connectPushNotifications", () => ({
  sendConnectThreadPush: jest.fn(async () => ({ ok: true })),
}));

jest.mock("./routes/notifications", () => ({
  getPushToken: jest.fn(() => "ExponentPushToken[test]"),
}));

// authUserId(req, fallback) returns req.auth?.userId ?? fallback
// With getAuth returning { userId: null }, authUserId uses the fallback param
jest.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: null }),
}));

// ── DB helpers ───────────────────────────────────────────────────────────────

const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const dbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");
const backupPath = join(dirname(dbPath), "db.json.inbox-routes-test-backup");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", friendsRouter);
  return app;
}

const BASE_USERS = [
  {
    id: "user-alice",
    name: "Alice",
    photos: ["https://example.com/alice.jpg"],
    age: 28,
    city: "Miami",
    neighborhood: "Brickell",
    interests: [],
    activityStyle: [],
    energy: "plans",
    accessibility: [],
    safety: [],
    familyFriendly: false,
    lgbtqFriendly: true,
    mutualConnections: [],
  },
  {
    id: "user-bob",
    name: "Bob",
    photos: ["https://example.com/bob.jpg"],
    age: 30,
    city: "Miami",
    neighborhood: "Wynwood",
    interests: [],
    activityStyle: [],
    energy: "vibes",
    accessibility: [],
    safety: [],
    familyFriendly: false,
    lgbtqFriendly: true,
    mutualConnections: [],
  },
  {
    id: "user-carol",
    name: "Carol",
    photos: [],
    age: 25,
    city: "Miami",
    neighborhood: "Midtown",
    interests: [],
    activityStyle: [],
    energy: "vibes",
    accessibility: [],
    safety: [],
    familyFriendly: false,
    lgbtqFriendly: false,
    mutualConnections: [],
  },
];

function writeTestDb(overrides: Record<string, unknown[]> = {}) {
  const db = {
    users: BASE_USERS,
    friendPosts: [],
    postComments: [],
    postLikes: [],
    connectionRequests: [],
    connections: [],
    plans: [],
    planMembers: [],
    chats: [],
    chatMembers: [],
    messages: [],
    userBehavior: [],
    friendStories: [],
    friendStoryReactions: [],
    planJoinRequests: [],
    userReports: [],
    datingMatches: [],
    doubleDatePairs: [],
    doubleDateLikes: [],
    doubleDatePasses: [],
    doubleDateMatches: [],
    blockedUsers: [],
    planShareLinks: [],
    planShareLinkRedemptions: [],
    friendReactions: [],
    friendActionUsage: [],
    friendInvites: [],
    csReactions: [],
    csRequests: [],
    csConversations: [],
    ...overrides,
  };
  writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe("Inbox v2 routes", () => {
  const app = makeApp();

  beforeAll(() => {
    if (existsSync(dbPath)) writeFileSync(backupPath, readFileSync(dbPath));
  });

  beforeEach(() => {
    writeTestDb();
  });

  afterAll(() => {
    if (existsSync(backupPath)) {
      writeFileSync(dbPath, readFileSync(backupPath));
      unlinkSync(backupPath);
    } else if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  // ── Primary inbox ──────────────────────────────────────────────────────────

  describe("GET /api/inbox/primary/:userId", () => {
    it("returns empty primary inbox for a new user", async () => {
      const res = await request(app).get("/api/inbox/primary/user-alice");
      expect(res.status).toBe(200);
      expect(res.body.conversations).toEqual([]);
    });

    it("returns active conversation for existing participants", async () => {
      writeTestDb({
        csConversations: [
          {
            id: "conv-1",
            participantIds: ["user-alice", "user-bob"],
            type: "match",
            category: "primary",
            status: "active",
            hasMessages: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).get("/api/inbox/primary/user-alice");
      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.conversations[0].participantIds).toContain("user-alice");
    });
  });

  // ── Requests tab ──────────────────────────────────────────────────────────

  describe("GET /api/inbox/requests/:userId", () => {
    it("returns 200 with empty list for a user with no requests", async () => {
      const res = await request(app).get("/api/inbox/requests/user-alice");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.requests).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it("returns incoming pending requests for the receiver", async () => {
      writeTestDb({
        csRequests: [
          {
            id: "req-1",
            senderId: "user-bob",
            receiverId: "user-alice",
            type: "connect_request",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).get("/api/inbox/requests/user-alice");
      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(1);
      expect(res.body.requests[0].senderId).toBe("user-bob");
      expect(res.body.requests[0].status).toBe("pending");
      expect(res.body.count).toBe(1);
    });

    it("does not surface requests where the user is the sender", async () => {
      writeTestDb({
        csRequests: [
          {
            id: "req-2",
            senderId: "user-alice",
            receiverId: "user-bob",
            type: "connect_request",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).get("/api/inbox/requests/user-alice");
      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(0);
    });
  });

  describe("POST /api/inbox/requests/send", () => {
    it("creates a connect_request and returns it", async () => {
      const res = await request(app)
        .post("/api/inbox/requests/send")
        .send({ senderId: "user-alice", receiverId: "user-bob", type: "connect_request" });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.request.senderId).toBe("user-alice");
      expect(res.body.request.receiverId).toBe("user-bob");
      expect(res.body.request.status).toBe("pending");
    });

    it("returns duplicate:true if a pending request already exists", async () => {
      // First request
      await request(app)
        .post("/api/inbox/requests/send")
        .send({ senderId: "user-alice", receiverId: "user-bob", type: "connect_request" });

      // Duplicate
      const res = await request(app)
        .post("/api/inbox/requests/send")
        .send({ senderId: "user-alice", receiverId: "user-bob", type: "connect_request" });

      expect(res.status).toBe(200);
      expect(res.body.duplicate).toBe(true);
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await request(app)
        .post("/api/inbox/requests/send")
        .send({ senderId: "user-alice" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/inbox/requests/accept/:id", () => {
    it("accepts a pending request and creates a conversation", async () => {
      // Seed pending request
      writeTestDb({
        csRequests: [
          {
            id: "req-accept-1",
            senderId: "user-bob",
            receiverId: "user-alice",
            type: "connect_request",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).post("/api/inbox/requests/accept/req-accept-1");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.request.status).toBe("accepted");
      expect(res.body.conversation).toBeDefined();
      expect(res.body.conversation.participantIds).toContain("user-bob");
      expect(res.body.conversation.participantIds).toContain("user-alice");
    });

    it("returns 404 for a non-existent request id", async () => {
      const res = await request(app).post("/api/inbox/requests/accept/does-not-exist");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/inbox/requests/decline/:id", () => {
    it("declines a pending request", async () => {
      writeTestDb({
        csRequests: [
          {
            id: "req-decline-1",
            senderId: "user-bob",
            receiverId: "user-alice",
            type: "connect_request",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).post("/api/inbox/requests/decline/req-decline-1");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.request.status).toBe("declined");
    });
  });

  // ── Reactions section ─────────────────────────────────────────────────────

  describe("GET /api/inbox/reactions/:userId", () => {
    it("returns 200 with empty list and zero counts for a new user", async () => {
      const res = await request(app).get("/api/inbox/reactions/user-alice");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.reactions).toEqual([]);
      expect(res.body.counts.total).toBe(0);
    });

    it("returns pending reactions sent TO the user", async () => {
      writeTestDb({
        csReactions: [
          {
            id: "rxn-1",
            senderId: "user-bob",
            receiverId: "user-alice",
            type: "spark",
            status: "pending",
            isBlurredForReceiver: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).get("/api/inbox/reactions/user-alice");
      expect(res.status).toBe(200);
      expect(res.body.reactions).toHaveLength(1);
      expect(res.body.reactions[0].type).toBe("spark");
      expect(res.body.counts.spark).toBe(1);
      expect(res.body.counts.total).toBe(1);
    });

    it("does not surface reactions sent BY the user", async () => {
      writeTestDb({
        csReactions: [
          {
            id: "rxn-2",
            senderId: "user-alice",
            receiverId: "user-bob",
            type: "like",
            status: "pending",
            isBlurredForReceiver: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).get("/api/inbox/reactions/user-alice");
      expect(res.status).toBe(200);
      expect(res.body.reactions).toHaveLength(0);
    });

    it("does not include already-converted or ignored reactions", async () => {
      writeTestDb({
        csReactions: [
          {
            id: "rxn-3",
            senderId: "user-bob",
            receiverId: "user-alice",
            type: "spark",
            status: "converted_to_match",
            isBlurredForReceiver: false,
            createdAt: new Date().toISOString(),
          },
          {
            id: "rxn-4",
            senderId: "user-carol",
            receiverId: "user-alice",
            type: "like",
            status: "ignored",
            isBlurredForReceiver: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).get("/api/inbox/reactions/user-alice");
      expect(res.status).toBe(200);
      expect(res.body.reactions).toHaveLength(0);
      expect(res.body.counts.total).toBe(0);
    });
  });

  describe("POST /api/inbox/reactions/send", () => {
    it("creates a spark reaction and returns it", async () => {
      const res = await request(app)
        .post("/api/inbox/reactions/send")
        .send({ senderId: "user-alice", receiverId: "user-bob", type: "spark" });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.reaction.senderId).toBe("user-alice");
      expect(res.body.reaction.type).toBe("spark");
      expect(res.body.reaction.status).toBe("pending");
    });

    it("creates a like reaction", async () => {
      const res = await request(app)
        .post("/api/inbox/reactions/send")
        .send({ senderId: "user-alice", receiverId: "user-bob", type: "like" });

      expect(res.status).toBe(201);
      expect(res.body.reaction.type).toBe("like");
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await request(app)
        .post("/api/inbox/reactions/send")
        .send({ senderId: "user-alice", type: "spark" });

      expect(res.status).toBe(400);
    });
  });

  // ── Like-back → match ─────────────────────────────────────────────────────

  describe("POST /api/inbox/reactions/like-back/:id", () => {
    it("converts a pending reaction to a match and returns a conversation", async () => {
      writeTestDb({
        csReactions: [
          {
            id: "rxn-likeback-1",
            senderId: "user-bob",
            receiverId: "user-alice",
            type: "spark",
            status: "pending",
            isBlurredForReceiver: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).post("/api/inbox/reactions/like-back/rxn-likeback-1");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.reaction.status).toBe("converted_to_match");
      expect(res.body.conversation).toBeDefined();
      expect(res.body.conversation.participantIds).toContain("user-bob");
      expect(res.body.conversation.participantIds).toContain("user-alice");
    });

    it("returns 404 when the reaction does not exist", async () => {
      const res = await request(app).post("/api/inbox/reactions/like-back/does-not-exist");
      expect(res.status).toBe(404);
    });

    it("returns 409 when the reaction is already converted", async () => {
      writeTestDb({
        csReactions: [
          {
            id: "rxn-already",
            senderId: "user-bob",
            receiverId: "user-alice",
            type: "spark",
            status: "converted_to_match",
            isBlurredForReceiver: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).post("/api/inbox/reactions/like-back/rxn-already");
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/inbox/reactions/ignore/:id", () => {
    it("marks a pending reaction as ignored", async () => {
      writeTestDb({
        csReactions: [
          {
            id: "rxn-ignore-1",
            senderId: "user-bob",
            receiverId: "user-alice",
            type: "like",
            status: "pending",
            isBlurredForReceiver: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).post("/api/inbox/reactions/ignore/rxn-ignore-1");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.reaction.status).toBe("ignored");
    });

    it("returns 404 for unknown reaction id", async () => {
      const res = await request(app).post("/api/inbox/reactions/ignore/ghost-id");
      expect(res.status).toBe(404);
    });
  });

  // ── Rewind / withdraw ─────────────────────────────────────────────────────

  describe("POST /api/inbox/reactions/withdraw", () => {
    it("withdraws a pending reaction and returns withdrawn:true", async () => {
      writeTestDb({
        csReactions: [
          {
            id: "rxn-withdraw-1",
            senderId: "user-alice",
            receiverId: "user-bob",
            type: "like",
            status: "pending",
            isBlurredForReceiver: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post("/api/inbox/reactions/withdraw")
        .send({ senderId: "user-alice", receiverId: "user-bob", type: "like" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.withdrawn).toBe(true);
    });

    it("returns withdrawn:false when no matching pending reaction exists", async () => {
      const res = await request(app)
        .post("/api/inbox/reactions/withdraw")
        .send({ senderId: "user-alice", receiverId: "user-carol", type: "spark" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.withdrawn).toBe(false);
    });

    it("returns withdrawn:false for an already-converted reaction (safe fire-and-forget)", async () => {
      writeTestDb({
        csReactions: [
          {
            id: "rxn-converted",
            senderId: "user-alice",
            receiverId: "user-bob",
            type: "spark",
            status: "converted_to_match",
            isBlurredForReceiver: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post("/api/inbox/reactions/withdraw")
        .send({ senderId: "user-alice", receiverId: "user-bob", type: "spark" });

      expect(res.status).toBe(200);
      expect(res.body.withdrawn).toBe(false);
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await request(app)
        .post("/api/inbox/reactions/withdraw")
        .send({ senderId: "user-alice" });

      expect(res.status).toBe(400);
    });
  });

  // ── Messages ──────────────────────────────────────────────────────────────

  describe("GET /api/inbox/messages/:conversationId", () => {
    it("returns messages for an existing conversation", async () => {
      writeTestDb({
        csConversations: [
          {
            id: "conv-msgs-1",
            participantIds: ["user-alice", "user-bob"],
            type: "match",
            category: "primary",
            status: "active",
            hasMessages: true,
            createdAt: new Date().toISOString(),
          },
        ],
        messages: [
          {
            id: "msg-1",
            conversationId: "conv-msgs-1",
            senderId: "user-bob",
            text: "Hey!",
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).get("/api/inbox/messages/conv-msgs-1");
      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].text).toBe("Hey!");
    });

    it("returns empty messages array for a conversation with no messages", async () => {
      writeTestDb({
        csConversations: [
          {
            id: "conv-empty",
            participantIds: ["user-alice", "user-carol"],
            type: "direct",
            category: "primary",
            status: "active",
            hasMessages: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).get("/api/inbox/messages/conv-empty");
      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });
  });

  describe("POST /api/inbox/messages/send", () => {
    it("sends a message to an existing conversation", async () => {
      writeTestDb({
        csConversations: [
          {
            id: "conv-send-1",
            participantIds: ["user-alice", "user-bob"],
            type: "match",
            category: "primary",
            status: "active",
            hasMessages: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post("/api/inbox/messages/send")
        .send({
          conversationId: "conv-send-1",
          senderId: "user-alice",
          text: "Hello from integration test!",
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.message.text).toBe("Hello from integration test!");
      expect(res.body.message.senderId).toBe("user-alice");
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await request(app)
        .post("/api/inbox/messages/send")
        .send({ senderId: "user-alice", text: "No conversation id" });

      expect(res.status).toBe(400);
    });
  });
});

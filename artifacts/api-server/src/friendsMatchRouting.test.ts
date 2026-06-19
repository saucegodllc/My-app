import express from "express";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import request from "supertest";
import friendsRouter from "./routes/friends";

const mockEnsureMatchThread = jest.fn(async ({ userId1, userId2 }) => ({
  match: {
    id: `match-${userId1}-${userId2}`,
    userId1,
    userId2,
    matchedAt: new Date("2026-06-06T12:00:00.000Z"),
  },
  created: true,
}));

jest.mock("./lib/matchThreads", () => ({
  ensureMatchThread: (...args: unknown[]) => mockEnsureMatchThread(...args),
  buildMatchThreadResponse: async ({ match, viewerUserId, intent, originAction }: any) => ({
    ...match,
    chatId: match.id,
    intent,
    originAction,
    otherProfile: {
      userId: match.userId1 === viewerUserId ? match.userId2 : match.userId1,
      displayName: "Friend",
      intent: "friendship",
    },
    lastMessage: null,
    unreadCount: 0,
  }),
}));

jest.mock("./lib/connectPushNotifications", () => ({
  sendConnectThreadPush: jest.fn(async () => ({ ok: true })),
}));

jest.mock("./routes/notifications", () => ({
  getPushToken: jest.fn(() => "ExponentPushToken[test]"),
}));

jest.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: null }),
}));

const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const dbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");
const backupPath = join(dirname(dbPath), "db.json.friends-match-routing-test-backup");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", friendsRouter);
  return app;
}

function writeTestDb() {
  const db = {
    users: [
      { id: "user-a", name: "Ava", city: "Miami", neighborhood: "Brickell", interests: [], activityStyle: [], energy: "plans", accessibility: [], safety: [], familyFriendly: false, lgbtqFriendly: true, mutualConnections: [] },
      { id: "user-b", name: "Ben", city: "Miami", neighborhood: "Wynwood", interests: [], activityStyle: [], energy: "plans", accessibility: [], safety: [], familyFriendly: false, lgbtqFriendly: true, mutualConnections: [] },
    ],
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
  };
  writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

describe("friends mutual match-to-chat routing", () => {
  const app = makeApp();

  beforeAll(() => {
    if (existsSync(dbPath)) writeFileSync(backupPath, readFileSync(dbPath));
  });

  beforeEach(() => {
    mockEnsureMatchThread.mockClear();
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

  it("keeps friend requests pending with no chat payload", async () => {
    const response = await request(app)
      .post("/api/friends/connect/request")
      .send({ fromUserId: "user-a", toUserId: "user-b" });

    expect(response.status).toBe(201);
    expect(response.body.request.status).toBe("pending");
    expect(response.body.chat).toBeUndefined();
    expect(response.body.match).toBeUndefined();
    expect(mockEnsureMatchThread).not.toHaveBeenCalled();
  });

  it("returns the server match id as the chat id when a friend request is accepted", async () => {
    const pending = await request(app)
      .post("/api/friends/connect/request")
      .send({ fromUserId: "user-a", toUserId: "user-b" });

    const accepted = await request(app)
      .post("/api/friends/connect/accept")
      .send({ requestId: pending.body.request.id });

    expect(accepted.status).toBe(200);
    expect(accepted.body.request.status).toBe("accepted");
    expect(accepted.body.chat.id).toBe("match-user-a-user-b");
    expect(accepted.body.match.chatId).toBe("match-user-a-user-b");
    expect(accepted.body.conversation.id).toBe("match-user-a-user-b");
  });

  it("keeps direct plan invites as pending requests until the receiver accepts", async () => {
    const created = await request(app)
      .post("/api/friends/plans/create")
      .send({
        creatorId: "user-a",
        title: "Wynwood tacos",
        type: "Dinner",
        invitedUserIds: ["user-b"],
      });

    expect(created.status).toBe(201);
    expect(created.body.chat.participantIds).toEqual(["user-a"]);

    const inbox = await request(app).get("/api/friends/requests/user-b");
    expect(inbox.body.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromUserId: "user-a",
          toUserId: "user-b",
          status: "pending",
          kind: "plan_invite",
        }),
      ]),
    );

    const requesterConnect = await request(app).get("/api/connect/user-b");
    expect(requesterConnect.body.chats ?? []).toHaveLength(0);
  });

  it("adds the invited user to the plan chat and returns the server match chat only after plan acceptance", async () => {
    await request(app)
      .post("/api/friends/plans/create")
      .send({
        creatorId: "user-a",
        title: "Wynwood tacos",
        type: "Dinner",
        invitedUserIds: ["user-b"],
      });
    const inbox = await request(app).get("/api/friends/requests/user-b");
    const requestId = inbox.body.requests[0].id;

    const accepted = await request(app)
      .post("/api/friends/request/respond")
      .send({ userId: "user-b", requestId, action: "accept" });

    expect(accepted.status).toBe(200);
    expect(accepted.body.request.status).toBe("accepted");
    expect(accepted.body.chat.id).toBe("match-user-a-user-b");
    expect(accepted.body.match.chatId).toBe("match-user-a-user-b");

    const requesterConnect = await request(app).get("/api/connect/user-b");
    expect(requesterConnect.body.chats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "friend_plan",
          participants: expect.arrayContaining([
            expect.objectContaining({ id: "user-b" }),
          ]),
        }),
      ]),
    );
  });
});

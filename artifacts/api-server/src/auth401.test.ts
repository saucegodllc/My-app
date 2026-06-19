import request from "supertest";

jest.mock("@workspace/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    query: {},
  },
  profilesTable: {},
  likesTable: {},
  matchesTable: {},
  messagesTable: {},
  blocksTable: {},
  reportsTable: {},
  savedVenuesTable: {},
  livenessNoncesTable: {},
  livenessAttemptsTable: {},
}));

jest.mock("@workspace/db/schema", () => ({
  profiles: {},
  matches: {},
  pushTokens: {},
}));

jest.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null, sessionId: null }),
}));

const app = require("./app").default;

describe("Express API auth coverage", () => {
  it.each([
    ["GET", "/api/discovery"],
    ["GET", "/api/me/session-state"],
    ["POST", "/api/reports/block"],
    ["GET", "/api/subscriptions/status"],
    ["GET", "/api/venues/saved"],
  ] as const)("returns 401 for unauthenticated %s %s", async (method, path) => {
    const agent = request(app);
    const response =
      method === "GET"
        ? await agent.get(path)
        : await agent.post(path).send({ blockedUserId: "user_target" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("error");
  });
});

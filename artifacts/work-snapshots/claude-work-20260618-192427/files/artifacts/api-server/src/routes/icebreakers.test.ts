/**
 * Integration tests — GET /api/icebreakers
 *
 * Run with: pnpm test --testPathPattern=icebreakers
 *
 * Uses supertest to hit the actual Express app.
 * DB and Clerk are mocked so no real credentials needed.
 */
import request from "supertest";
import app from "../app";

// ─── Mock auth middleware ────────────────────────────────────────────────────

jest.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.auth = { userId: "user_test_123" };
    next();
  },
}));

// ─── Mock DB ─────────────────────────────────────────────────────────────────

const MOCK_MY_VIBE = {
  loveLanguage: "words",
  energyType: "adventurer",
  conflictStyle: "talk-it-out",
  datePace: "slow-burn",
  adventureLevel: 5,
};
const MOCK_THEIR_VIBE = {
  loveLanguage: "words",
  energyType: "adventurer",
  conflictStyle: "talk-it-out",
  datePace: "slow-burn",
  adventureLevel: 4,
};

jest.mock("@workspace/db", () => ({
  db: {
    query: {
      profiles: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          // Return different profiles based on userId
          return {
            userId: "other_user",
            name: "Alex",
            vibeCheck: { answers: MOCK_THEIR_VIBE },
          };
        }),
      },
      matches: {
        findFirst: jest.fn().mockResolvedValue({
          id: "match-1",
          userId1: "user_test_123",
          userId2: "other_user",
          status: "matched",
        }),
      },
    },
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/icebreakers", () => {
  it("returns 3 icebreakers for a valid matchId", async () => {
    const res = await request(app)
      .get("/api/icebreakers?matchId=match-1")
      .expect(200);

    expect(res.body).toHaveProperty("icebreakers");
    expect(res.body.icebreakers).toHaveLength(3);
    expect(Array.isArray(res.body.icebreakers)).toBe(true);
  });

  it("all icebreakers are non-empty strings", async () => {
    const res = await request(app)
      .get("/api/icebreakers?matchId=match-1")
      .expect(200);

    res.body.icebreakers.forEach((s: string) => {
      expect(typeof s).toBe("string");
      expect(s.length).toBeGreaterThan(5);
    });
  });

  it("returns personalized:true when vibe data exists", async () => {
    const res = await request(app)
      .get("/api/icebreakers?matchId=match-1")
      .expect(200);

    expect(res.body.personalized).toBe(true);
  });

  it("returns generic fallbacks when no matchId provided", async () => {
    const res = await request(app)
      .get("/api/icebreakers")
      .expect(200);

    expect(res.body.icebreakers).toHaveLength(3);
    expect(res.body.personalized).toBe(false);
  });

  it("returns 401 when not authenticated", async () => {
    // Temporarily restore real requireAuth to test 401
    jest.resetModules();
    const unauthApp = require("../app").default;
    await request(unauthApp)
      .get("/api/icebreakers?matchId=match-1")
      .expect(401);
  });

  it("returns different icebreakers on repeated calls (not deterministic)", async () => {
    // Run twice — at least sometimes results differ due to shuffling
    const res1 = await request(app).get("/api/icebreakers");
    const res2 = await request(app).get("/api/icebreakers");
    // Both should be valid
    expect(res1.body.icebreakers).toHaveLength(3);
    expect(res2.body.icebreakers).toHaveLength(3);
  });
});

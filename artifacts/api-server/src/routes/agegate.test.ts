/**
 * Integration tests: 18+ age gate + account deletion cascade
 *
 * These tests use the local-db fallback path (no live Postgres/Clerk needed)
 * so they run cleanly in CI with no external dependencies.
 *
 * Environment: NODE_ENV=test, USE_LOCAL_DB_FALLBACK=true (set below via env mock)
 */

import express from "express";
import request from "supertest";

// Force local-db fallback so no Postgres or Clerk calls are made.
jest.mock("../launchGuards", () => ({ shouldUseLocalDbFallback: () => true }));
jest.mock("@workspace/db", () => ({
  db: {},
  profilesTable: {},
  matchesTable: {},
  messagesTable: {},
  blocksTable: {},
  reportsTable: {},
  livenessNoncesTable: {},
  livenessAttemptsTable: {},
}));
jest.mock("@clerk/express", () => ({
  getAuth: (req: express.Request) => ({ userId: (req.headers["x-connectsphere-user-id"] as string) || null }),
  clerkMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

// Use a temp file for the JSON-db so tests don't touch the real db.json.
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const tmpDir = mkdtempSync(join(tmpdir(), "cs-agegate-test-"));
const tempDbPath = join(tmpDir, "db.json");

// Override the workspace root so profiles.ts / account.ts finds our temp db.
process.env["AGEGATE_TEST_DB_PATH"] = tempDbPath;

// Patch cwd so the db.json path resolves to our temp file.
const originalCwd = process.cwd;
beforeAll(() => {
  process.cwd = () => join(tmpDir, "artifacts", "api-server");
});
afterAll(() => {
  process.cwd = originalCwd;
});

function writeSeedDb(data: Record<string, unknown>) {
  writeFileSync(tempDbPath, JSON.stringify(data, null, 2));
}

function readDb(): Record<string, unknown[]> {
  if (!existsSync(tempDbPath)) return {};
  return JSON.parse(readFileSync(tempDbPath, "utf8"));
}

// Build a minimal Express app with just the routes under test.
import profilesRouter from "./profiles";
import accountRouter from "./account";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", profilesRouter);
  app.use("/api", accountRouter);
  return app;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dobForAge(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split("T")[0];
}

const VALID_BODY = (birthDate: string) => ({
  displayName: "Test User",
  username: "testuser123",
  birthDate,
  intent: "dating",
  acceptCommunityCode: true,
});

// ── Age-gate tests ───────────────────────────────────────────────────────────

describe("PUT /api/profiles/me — age gate", () => {
  beforeEach(() => writeSeedDb({ profiles: [], livenessNonces: [] }));

  it("returns 403 { error: 'underage' } for a 17-year-old", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-connectsphere-user-id", "user-under-18")
      .send(VALID_BODY(dobForAge(17)));

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("underage");
  });

  it("returns 403 for a user born exactly today minus 17 years", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-connectsphere-user-id", "user-17-today")
      .send(VALID_BODY(dobForAge(17)));

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("underage");
  });

  it("returns 200 for an 18-year-old", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-connectsphere-user-id", "user-18")
      .send(VALID_BODY(dobForAge(18)));

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("user-18");
  });

  it("returns 200 for a 25-year-old", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-connectsphere-user-id", "user-25")
      .send(VALID_BODY(dobForAge(25)));

    expect(res.status).toBe(200);
  });

  it("returns 400 (not 403) when birthDate is missing entirely", async () => {
    const app = makeApp();
    const body = { ...VALID_BODY(dobForAge(25)) };
    delete (body as Partial<typeof body>).birthDate;
    const res = await request(app)
      .put("/api/profiles/me")
      .set("x-connectsphere-user-id", "user-no-dob")
      .send(body);

    // Missing DOB is a validation error, not an underage rejection.
    expect(res.status).toBe(400);
    expect(res.body.error).not.toBe("underage");
  });
});

// ── Account deletion cascade tests ───────────────────────────────────────────

describe("POST /api/account/delete — cascade", () => {
  const USER_ID = "delete-test-user";

  beforeEach(() => {
    writeSeedDb({
      profiles: [
        { id: "p1", userId: USER_ID, displayName: "Test", intent: "dating", birthDate: dobForAge(25) },
        { id: "p2", userId: "other-user", displayName: "Other", intent: "dating", birthDate: dobForAge(25) },
      ],
      shots: [
        { id: "s1", fromUserId: USER_ID, toUserId: "other-user", message: "hey", status: "pending" },
        { id: "s2", fromUserId: "other-user", toUserId: USER_ID, message: "hi", status: "pending" },
      ],
      friends: [
        { id: "f1", userId: USER_ID, friendId: "other-user" },
      ],
    });
  });

  it("removes the user's profile row from JSON-db", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/account/delete")
      .set("x-connectsphere-user-id", USER_ID)
      .send({ confirmation: "DELETE" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const db = readDb();
    const profiles = (db.profiles ?? []) as Array<{ userId: string }>;
    const remaining = profiles.filter((p) => p.userId === USER_ID);
    expect(remaining).toHaveLength(0);
  });

  it("leaves other users' profiles intact after deletion", async () => {
    const app = makeApp();
    await request(app)
      .post("/api/account/delete")
      .set("x-connectsphere-user-id", USER_ID)
      .send({ confirmation: "DELETE" });

    const db = readDb();
    const profiles = (db.profiles ?? []) as Array<{ userId: string }>;
    expect(profiles.some((p) => p.userId === "other-user")).toBe(true);
  });

  it("removes JSON-db shots sent or received by the deleted user", async () => {
    const app = makeApp();
    await request(app)
      .post("/api/account/delete")
      .set("x-connectsphere-user-id", USER_ID)
      .send({ confirmation: "DELETE" });

    const db = readDb();
    const shots = (db.shots ?? []) as Array<{ fromUserId: string; toUserId: string }>;
    expect(shots.some((s) => s.fromUserId === USER_ID || s.toUserId === USER_ID)).toBe(false);
  });

  it("removes JSON-db friend records for the deleted user", async () => {
    const app = makeApp();
    await request(app)
      .post("/api/account/delete")
      .set("x-connectsphere-user-id", USER_ID)
      .send({ confirmation: "DELETE" });

    const db = readDb();
    const friends = (db.friends ?? []) as Array<{ userId: string; friendId: string }>;
    expect(friends.some((f) => f.userId === USER_ID || f.friendId === USER_ID)).toBe(false);
  });

  it("returns 400 when confirmation is wrong", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/account/delete")
      .set("x-connectsphere-user-id", USER_ID)
      .send({ confirmation: "delete" }); // wrong case

    expect(res.status).toBe(400);
  });

  it("returns 401 without a user id", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/account/delete")
      .send({ confirmation: "DELETE" });

    expect(res.status).toBe(401);
  });
});

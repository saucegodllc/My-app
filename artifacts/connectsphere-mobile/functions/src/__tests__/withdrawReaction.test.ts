/**
 * withdrawReaction.test.ts
 *
 * Unit tests for the withdrawReaction Cloud Function (functions/src/reactions.ts).
 *
 * Tests cover:
 *  - Auth rejection when x-cs-user-id is missing or mismatched
 *  - 400 on missing / invalid body fields
 *  - 200 idempotent response when reaction not found
 *  - 409 when reaction is already acted on (not pending)
 *  - 200 successful withdrawal with Firestore batch delete
 *  - Method rejection (GET → 405)
 *
 * Run from /functions: pnpm test (requires jest + ts-jest)
 */

import type { Request, Response } from "firebase-functions";

// ── Minimal Firestore mock ─────────────────────────────────────────────────────

type MockDoc = { exists: boolean; data: () => Record<string, unknown> | undefined };

function makeFirestoreMock(docData: MockDoc) {
  const deleted: string[] = [];

  const batchMock = {
    delete: jest.fn((ref: { path: string }) => { deleted.push(ref.path); }),
    commit: jest.fn(() => Promise.resolve()),
  };

  const docRef = (path: string) => ({
    path,
    get: jest.fn(() => Promise.resolve(docData)),
  });

  const db = {
    collection: (col: string) => ({
      doc: (id: string) => ({
        path: `${col}/${id}`,
        collection: (sub: string) => ({
          doc: (subId: string) => docRef(`${col}/${id}/${sub}/${subId}`),
        }),
      }),
    }),
    batch: jest.fn(() => batchMock),
    _deleted: deleted,
    _batch: batchMock,
  };

  return db;
}

// ── Mock firebase-admin ────────────────────────────────────────────────────────

let currentDocMock: MockDoc = { exists: true, data: () => ({ status: "pending", type: "like" }) };
const adminMock = {
  apps: ["app"], // non-empty → skip initializeApp
  initializeApp: jest.fn(),
  firestore: jest.fn(() => makeFirestoreMock(currentDocMock)),
};

jest.mock("firebase-admin", () => adminMock);
jest.mock("firebase-functions", () => ({
  https: { onRequest: (fn: Function) => fn },
  logger: { error: jest.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(
  method: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
): Request {
  return { method, headers, body } as unknown as Request;
}

type MockResponse = Response & {
  readonly _status: number;
  readonly _body: Record<string, unknown>;
};

function makeRes(): MockResponse {
  let _status = 200;
  let _body: Record<string, unknown> = {};
  return {
    status: jest.fn((s: number) => { _status = s; return { json: (b: Record<string, unknown>) => { _body = b; } }; }),
    json: jest.fn((b: Record<string, unknown>) => { _body = b; }),
    get _status() { return _status; },
    get _body() { return _body; },
  } as unknown as MockResponse;
}

// Import AFTER mocks are set up
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withdrawReaction } = require("../reactions") as typeof import("../reactions");

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("withdrawReaction — method guard", () => {
  it("returns 405 for GET requests", async () => {
    const req = makeReq("GET", {}, {});
    const res = makeRes();
    await withdrawReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

describe("withdrawReaction — auth", () => {
  it("returns 401 when x-cs-user-id header is missing", async () => {
    const req = makeReq("POST", {}, { senderId: "alice", receiverId: "bob", type: "like" });
    const res = makeRes();
    await withdrawReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when x-cs-user-id does not match senderId", async () => {
    const req = makeReq(
      "POST",
      { "x-cs-user-id": "mallory" },
      { senderId: "alice", receiverId: "bob", type: "like" }
    );
    const res = makeRes();
    await withdrawReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("withdrawReaction — validation", () => {
  it("returns 400 when body fields are missing", async () => {
    const req = makeReq("POST", { "x-cs-user-id": "alice" }, { senderId: "alice" });
    const res = makeRes();
    await withdrawReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for invalid reaction type", async () => {
    const req = makeReq(
      "POST",
      { "x-cs-user-id": "alice" },
      { senderId: "alice", receiverId: "bob", type: "wink" }
    );
    const res = makeRes();
    await withdrawReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("withdrawReaction — idempotent not-found", () => {
  beforeEach(() => {
    currentDocMock = { exists: false, data: () => undefined };
    adminMock.firestore.mockReturnValue(makeFirestoreMock(currentDocMock));
  });

  it("returns 200 withdrawn=false when reaction does not exist", async () => {
    const req = makeReq(
      "POST",
      { "x-cs-user-id": "alice" },
      { senderId: "alice", receiverId: "bob", type: "like" }
    );
    const res = makeRes();
    await withdrawReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("withdrawReaction — already acted on", () => {
  beforeEach(() => {
    currentDocMock = {
      exists: true,
      data: () => ({ status: "liked_back", type: "like" }),
    };
    adminMock.firestore.mockReturnValue(makeFirestoreMock(currentDocMock));
  });

  it("returns 409 when reaction status is liked_back", async () => {
    const req = makeReq(
      "POST",
      { "x-cs-user-id": "alice" },
      { senderId: "alice", receiverId: "bob", type: "like" }
    );
    const res = makeRes();
    await withdrawReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("withdrawReaction — successful withdrawal", () => {
  beforeEach(() => {
    currentDocMock = {
      exists: true,
      data: () => ({ status: "pending", type: "like" }),
    };
  });

  it("returns 200 with withdrawn=true", async () => {
    const mockDb = makeFirestoreMock(currentDocMock);
    adminMock.firestore.mockReturnValue(mockDb);

    const req = makeReq(
      "POST",
      { "x-cs-user-id": "alice" },
      { senderId: "alice", receiverId: "bob", type: "like" }
    );
    const res = makeRes();
    await withdrawReaction(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockDb._batch.commit).toHaveBeenCalled();
    // Both received and sent docs should be deleted
    expect(mockDb._batch.delete).toHaveBeenCalledTimes(2);
  });
});

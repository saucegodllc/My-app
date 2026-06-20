"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
function makeFirestoreMock(docData) {
    const deleted = [];
    const batchMock = {
        delete: jest.fn((ref) => { deleted.push(ref.path); }),
        commit: jest.fn(() => Promise.resolve()),
    };
    const docRef = (path) => ({
        path,
        get: jest.fn(() => Promise.resolve(docData)),
    });
    const db = {
        collection: (col) => ({
            doc: (id) => ({
                path: `${col}/${id}`,
                collection: (sub) => ({
                    doc: (subId) => docRef(`${col}/${id}/${sub}/${subId}`),
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
let currentDocMock = { exists: true, data: () => ({ status: "pending", type: "like" }) };
const adminMock = {
    apps: ["app"], // non-empty → skip initializeApp
    initializeApp: jest.fn(),
    firestore: jest.fn(() => makeFirestoreMock(currentDocMock)),
};
jest.mock("firebase-admin", () => adminMock);
jest.mock("firebase-functions", () => ({
    https: { onRequest: (fn) => fn },
    logger: { error: jest.fn() },
}));
// ── Helpers ────────────────────────────────────────────────────────────────────
function makeReq(method, headers, body) {
    return { method, headers, body };
}
function makeRes() {
    let _status = 200;
    let _body = {};
    return {
        status: jest.fn((s) => { _status = s; return { json: (b) => { _body = b; } }; }),
        json: jest.fn((b) => { _body = b; }),
        get _status() { return _status; },
        get _body() { return _body; },
    };
}
// Import AFTER mocks are set up
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withdrawReaction } = require("../reactions");
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
        const req = makeReq("POST", { "x-cs-user-id": "mallory" }, { senderId: "alice", receiverId: "bob", type: "like" });
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
        const req = makeReq("POST", { "x-cs-user-id": "alice" }, { senderId: "alice", receiverId: "bob", type: "wink" });
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
        const req = makeReq("POST", { "x-cs-user-id": "alice" }, { senderId: "alice", receiverId: "bob", type: "like" });
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
        const req = makeReq("POST", { "x-cs-user-id": "alice" }, { senderId: "alice", receiverId: "bob", type: "like" });
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
        const req = makeReq("POST", { "x-cs-user-id": "alice" }, { senderId: "alice", receiverId: "bob", type: "like" });
        const res = makeRes();
        await withdrawReaction(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(mockDb._batch.commit).toHaveBeenCalled();
        // Both received and sent docs should be deleted
        expect(mockDb._batch.delete).toHaveBeenCalledTimes(2);
    });
});
//# sourceMappingURL=withdrawReaction.test.js.map
/**
 * inboxEndpoints.test.ts
 *
 * Unit tests for the Inbox v2 client API wrapper (connectApi.ts).
 * Covers the four previously-broken paths:
 *   1. GET /api/inbox/requests/:userId
 *   2. GET /api/inbox/reactions/:userId
 *   3. POST /api/inbox/reactions/like-back/:id  → match creation
 *   4. POST /api/inbox/reactions/withdraw       → rewind
 */
import { customFetch } from "@workspace/api-client-react";
import {
  getInboxRequests,
  getInboxReactions,
  likeBackReaction,
  ignoreReaction,
  withdrawReaction,
  sendReaction,
  acceptRequest,
  declineRequest,
  sendRequest,
} from "../services/connectApi";

const mockFetch = customFetch as jest.Mock;

beforeEach(() => {
  mockFetch.mockReset();
});

// ── 1. Requests tab ──────────────────────────────────────────────────────────

describe("getInboxRequests", () => {
  it("calls the correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, requests: [], count: 0 });
    await getInboxRequests("user_me");
    expect(mockFetch).toHaveBeenCalledWith("/api/inbox/requests/user_me");
  });

  it("returns incoming pending requests", async () => {
    const request = {
      id: "req_1",
      senderId: "user_a",
      receiverId: "user_me",
      type: "connect_request",
      status: "pending",
      createdAt: "2026-06-01T10:00:00Z",
      senderName: "Ava",
    };
    mockFetch.mockResolvedValueOnce({ ok: true, requests: [request], count: 1 });

    const result = await getInboxRequests("user_me");

    expect(result.count).toBe(1);
    expect(result.requests[0]).toMatchObject({
      id: "req_1",
      type: "connect_request",
      status: "pending",
      senderName: "Ava",
    });
  });
});

describe("acceptRequest", () => {
  it("accepts and returns a conversation", async () => {
    const conversation = {
      id: "conv_1",
      participantIds: ["user_a", "user_me"],
      type: "direct",
      category: "primary",
      status: "active",
      hasMessages: false,
      createdAt: "2026-06-01T10:01:00Z",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      request: { id: "req_1", status: "accepted" },
      chat: { id: "conv_1", matchId: "match_1" },
      conversation,
    });

    const result = await acceptRequest("req_1");

    expect(mockFetch).toHaveBeenCalledWith("/api/inbox/requests/accept/req_1", { method: "POST" });
    expect(result.ok).toBe(true);
    expect(result.conversation.id).toBe("conv_1");
  });
});

describe("declineRequest", () => {
  it("declines the request", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, request: { id: "req_1", status: "declined" } });

    const result = await declineRequest("req_1");

    expect(mockFetch).toHaveBeenCalledWith("/api/inbox/requests/decline/req_1", { method: "POST" });
    expect(result.request.status).toBe("declined");
  });
});

describe("sendRequest", () => {
  it("sends a connect_request to another user", async () => {
    const request = { id: "req_new", senderId: "user_me", receiverId: "user_b", type: "connect_request", status: "pending", createdAt: "2026-06-01T11:00:00Z" };
    mockFetch.mockResolvedValueOnce({ ok: true, request });

    const result = await sendRequest({ senderId: "user_me", receiverId: "user_b", type: "connect_request" });

    expect(mockFetch).toHaveBeenCalledWith("/api/inbox/requests/send", {
      method: "POST",
      body: JSON.stringify({ senderId: "user_me", receiverId: "user_b", type: "connect_request" }),
    });
    expect(result.ok).toBe(true);
    expect(result.request.type).toBe("connect_request");
  });

  it("returns duplicate flag when request already exists", async () => {
    const existing = { id: "req_1", senderId: "user_me", receiverId: "user_b", type: "connect_request", status: "pending", createdAt: "2026-06-01T09:00:00Z" };
    mockFetch.mockResolvedValueOnce({ ok: true, request: existing, duplicate: true });

    const result = await sendRequest({ senderId: "user_me", receiverId: "user_b", type: "connect_request" });

    expect(result.duplicate).toBe(true);
  });
});

// ── 2. Reactions section ─────────────────────────────────────────────────────

describe("getInboxReactions", () => {
  it("calls the correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, reactions: [], counts: { spark: 0, like: 0, shot_reaction: 0, plan_like: 0, vibe_reaction: 0, total: 0 }, isPremium: false });
    await getInboxReactions("user_me");
    expect(mockFetch).toHaveBeenCalledWith("/api/inbox/reactions/user_me");
  });

  it("returns pending reactions with counts", async () => {
    const reaction = {
      id: "rxn_1",
      senderId: "user_a",
      receiverId: "user_me",
      type: "spark",
      status: "pending",
      isBlurredForReceiver: true,
      createdAt: "2026-06-01T08:00:00Z",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      reactions: [reaction],
      counts: { spark: 1, like: 0, shot_reaction: 0, plan_like: 0, vibe_reaction: 0, total: 1 },
      isPremium: false,
    });

    const result = await getInboxReactions("user_me");

    expect(result.reactions).toHaveLength(1);
    expect(result.reactions[0].type).toBe("spark");
    expect(result.counts.total).toBe(1);
    expect(result.isPremium).toBe(false);
  });

  it("free users get blurred reactions", async () => {
    const reaction = {
      id: "rxn_2",
      senderId: "user_b",
      receiverId: "user_me",
      type: "like",
      status: "pending",
      isBlurredForReceiver: true,
      senderName: "Mia",   // first name only for free users (server trims)
      senderPhotoUrl: undefined,
      createdAt: "2026-06-01T09:00:00Z",
    };
    mockFetch.mockResolvedValueOnce({ ok: true, reactions: [reaction], counts: { spark: 0, like: 1, shot_reaction: 0, plan_like: 0, vibe_reaction: 0, total: 1 }, isPremium: false });

    const result = await getInboxReactions("user_me");

    expect(result.reactions[0].isBlurredForReceiver).toBe(true);
    expect(result.reactions[0].senderPhotoUrl).toBeUndefined();
  });
});

describe("sendReaction", () => {
  it("sends a spark reaction", async () => {
    const reaction = { id: "rxn_new", senderId: "user_me", receiverId: "user_c", type: "spark", status: "pending", isBlurredForReceiver: true, createdAt: "2026-06-01T12:00:00Z" };
    mockFetch.mockResolvedValueOnce({ ok: true, reaction });

    const result = await sendReaction({ senderId: "user_me", receiverId: "user_c", type: "spark" });

    expect(mockFetch).toHaveBeenCalledWith("/api/inbox/reactions/send", {
      method: "POST",
      body: JSON.stringify({ senderId: "user_me", receiverId: "user_c", type: "spark" }),
    });
    expect(result.ok).toBe(true);
  });
});

// ── 3. Like-back → match creation ────────────────────────────────────────────

describe("likeBackReaction", () => {
  it("creates a match and returns a conversation", async () => {
    const conversation = {
      id: "conv_match_1",
      participantIds: ["user_a", "user_me"],
      type: "match",
      category: "primary",
      status: "active",
      hasMessages: false,
      createdAt: "2026-06-01T13:00:00Z",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      reaction: { id: "rxn_1", status: "converted_to_match", convertedConversationId: "conv_match_1" },
      chat: { id: "conv_match_1", matchId: "match_1" },
      conversation,
    });

    const result = await likeBackReaction("rxn_1");

    expect(mockFetch).toHaveBeenCalledWith("/api/inbox/reactions/like-back/rxn_1", { method: "POST" });
    expect(result.ok).toBe(true);
    expect(result.reaction.status).toBe("converted_to_match");
    expect(result.conversation.id).toBe("conv_match_1");
    expect(result.chat?.id).toBe("conv_match_1");
  });

  it("returns the reaction status when already matched (409 scenario handled upstream)", async () => {
    // The server returns 409 for non-pending reactions; client gets the error
    mockFetch.mockRejectedValueOnce(new Error("Reaction already converted_to_match"));
    await expect(likeBackReaction("rxn_already")).rejects.toThrow("already");
  });
});

describe("ignoreReaction", () => {
  it("marks the reaction ignored", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, reaction: { id: "rxn_1", status: "ignored" } });

    const result = await ignoreReaction("rxn_1");

    expect(mockFetch).toHaveBeenCalledWith("/api/inbox/reactions/ignore/rxn_1", { method: "POST" });
    expect(result.reaction.status).toBe("ignored");
  });
});

// ── 4. Rewind → withdraw reaction ────────────────────────────────────────────

describe("withdrawReaction", () => {
  it("withdraws a pending like reaction", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, withdrawn: true });

    const result = await withdrawReaction({ senderId: "user_me", receiverId: "user_d", type: "like" });

    expect(mockFetch).toHaveBeenCalledWith("/api/inbox/reactions/withdraw", {
      method: "POST",
      body: JSON.stringify({ senderId: "user_me", receiverId: "user_d", type: "like" }),
    });
    expect(result.ok).toBe(true);
    expect(result.withdrawn).toBe(true);
  });

  it("withdraws a pending spark reaction", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, withdrawn: true });

    const result = await withdrawReaction({ senderId: "user_me", receiverId: "user_e", type: "spark" });

    expect(result.withdrawn).toBe(true);
  });

  it("returns withdrawn=false when reaction was already matched (safe fire-and-forget)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, withdrawn: false });

    const result = await withdrawReaction({ senderId: "user_me", receiverId: "user_f", type: "like" });

    expect(result.ok).toBe(true);
    expect(result.withdrawn).toBe(false);
  });

  it("returns withdrawn=false when no matching reaction found", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, withdrawn: false });

    const result = await withdrawReaction({ senderId: "user_me", receiverId: "user_ghost", type: "spark" });

    expect(result.withdrawn).toBe(false);
  });
});

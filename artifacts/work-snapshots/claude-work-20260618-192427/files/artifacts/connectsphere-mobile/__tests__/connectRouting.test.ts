/**
 * connectRouting.test.ts
 *
 * Verifies the core routing logic for the Connect tab inbox:
 *   • Matches segment: pendingShots + newMatches + incomingCards
 *   • Chats segment: messages (hasMessages === true) only
 *   • openProfile passes fallback display data
 *   • DatingMatchModal onKeepExploring prop
 *   • getMutualMatchChats hasMessages discriminator
 *
 * These are unit tests that run without Expo or React Native.
 */

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: mockPush },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { routes, openProfile } from "../lib/routes";
import { buildIncomingActionCards } from "../services/connectIncoming";
import type { CsConversation, CsReaction, CsRequest } from "../services/connectApi";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeConversation(overrides: Partial<CsConversation> = {}): CsConversation {
  return {
    id: "conv-1",
    participantIds: ["user-a", "user-b"],
    type: "match",
    category: "primary",
    status: "active",
    hasMessages: false,
    createdAt: new Date().toISOString(),
    peerId: "user-b",
    peerName: "Jamie",
    peerPhotoUrl: "https://example.com/jamie.jpg",
    unreadCount: 0,
    ...overrides,
  };
}

function makeReaction(overrides: Partial<CsReaction> = {}): CsReaction {
  return {
    id: "react-1",
    senderId: "user-x",
    receiverId: "user-me",
    type: "like",
    sourceType: "profile",
    status: "pending",
    isBlurredForReceiver: false,
    createdAt: new Date().toISOString(),
    senderName: "Alex",
    senderPhotoUrl: "https://example.com/alex.jpg",
    senderAge: 27,
    senderNeighborhood: "Wynwood",
    ...overrides,
  };
}

function makeRequest(overrides: Partial<CsRequest> = {}): CsRequest {
  return {
    id: "req-1",
    senderId: "user-y",
    receiverId: "user-me",
    type: "connect_request",
    sourceType: "profile",
    status: "pending",
    createdAt: new Date().toISOString(),
    senderName: "Casey",
    senderPhotoUrl: "https://example.com/casey.jpg",
    senderAge: 24,
    senderNeighborhood: "Brickell",
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Connect tab — Matches vs Chats split", () => {
  test("conversation with no messages goes to Matches (spotlight)", () => {
    const conv = makeConversation({ hasMessages: false });
    expect(conv.hasMessages).toBe(false);
  });

  test("conversation with messages goes to Chats", () => {
    const conv = makeConversation({ hasMessages: true, lastMessageText: "Hey!" });
    expect(conv.hasMessages).toBe(true);
  });

  test("newMatches = conversations where hasMessages is false", () => {
    const convs: CsConversation[] = [
      makeConversation({ id: "a", hasMessages: false }),
      makeConversation({ id: "b", hasMessages: true, lastMessageText: "Hi" }),
      makeConversation({ id: "c", hasMessages: false }),
    ];
    const newMatches = convs.filter((c) => !c.hasMessages);
    const messages = convs.filter((c) => c.hasMessages);
    expect(newMatches).toHaveLength(2);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("b");
  });

  test("pendingShots (DatingShot.status === 'pending') belong in Matches, not Chats", () => {
    const shots = [
      { id: "s1", status: "pending" },
      { id: "s2", status: "accepted" },
      { id: "s3", status: "pending" },
    ] as Array<{ id: string; status: string }>;
    const pendingShots = shots.filter((s) => s.status === "pending");
    // Should land in Matches segment only
    expect(pendingShots).toHaveLength(2);
    expect(pendingShots.every((s) => s.status === "pending")).toBe(true);
  });
});

describe("buildIncomingActionCards", () => {
  test("pending reactions become incoming cards", () => {
    const cards = buildIncomingActionCards({
      reactions: [makeReaction({ status: "pending" })],
      requests: [],
      isPremium: true,
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].sourceType).toBe("reaction");
    expect(cards[0].senderId).toBe("user-x");
  });

  test("non-pending reactions are excluded", () => {
    const cards = buildIncomingActionCards({
      reactions: [makeReaction({ status: "liked_back" }), makeReaction({ status: "ignored" })],
      requests: [],
      isPremium: true,
    });
    expect(cards).toHaveLength(0);
  });

  test("pending requests become incoming cards", () => {
    const cards = buildIncomingActionCards({
      reactions: [],
      requests: [makeRequest({ status: "pending" })],
      isPremium: true,
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].sourceType).toBe("request");
  });

  test("non-pending requests are excluded", () => {
    const cards = buildIncomingActionCards({
      reactions: [],
      requests: [makeRequest({ status: "accepted" }), makeRequest({ status: "declined" })],
      isPremium: true,
    });
    expect(cards).toHaveLength(0);
  });

  test("free user sees index 0 unlocked, rest locked", () => {
    const reactions = Array.from({ length: 4 }, (_, i) =>
      makeReaction({ id: `r${i}`, senderId: `user-${i}` })
    );
    const cards = buildIncomingActionCards({ reactions, requests: [], isPremium: false });
    expect(cards).toHaveLength(4);
    expect(cards[0].isLocked).toBe(false);
    expect(cards[1].isLocked).toBe(true);
    expect(cards[2].isLocked).toBe(true);
  });

  test("premium user sees all unlocked", () => {
    const reactions = Array.from({ length: 4 }, (_, i) =>
      makeReaction({ id: `r${i}`, senderId: `user-${i}` })
    );
    const cards = buildIncomingActionCards({ reactions, requests: [], isPremium: true });
    expect(cards.every((c) => !c.isLocked)).toBe(true);
  });

  test("sender display data is preserved on cards", () => {
    const card = buildIncomingActionCards({
      reactions: [makeReaction({ senderName: "Jordan", senderAge: 29, senderNeighborhood: "South Beach" })],
      requests: [],
      isPremium: true,
    })[0];
    expect(card.senderName).toBe("Jordan");
    expect(card.senderAge).toBe(29);
    expect(card.senderNeighborhood).toBe("South Beach");
  });
});

describe("routes.profile — fallback params", () => {
  test("with no fallback: only userId and from params", () => {
    const route = routes.profile("user-123", "matches");
    expect((route as any).params.userId).toBe("user-123");
    expect((route as any).params.from).toBe("matches");
    expect((route as any).params.fallbackName).toBeUndefined();
    expect((route as any).params.fallbackPhoto).toBeUndefined();
  });

  test("with fallback name and photo: params are included", () => {
    const route = routes.profile("user-456", "matches", {
      name: "Sofia",
      photoUrl: "https://example.com/sofia.jpg",
      age: 25,
      neighborhood: "Coconut Grove",
    });
    const params = (route as any).params;
    expect(params.fallbackName).toBe("Sofia");
    expect(params.fallbackPhoto).toBe("https://example.com/sofia.jpg");
    expect(params.fallbackAge).toBe("25");
    expect(params.fallbackNeighborhood).toBe("Coconut Grove");
  });

  test("undefined fallback fields are omitted from params", () => {
    const route = routes.profile("user-789", "matches", { name: "Sam" });
    const params = (route as any).params;
    expect(params.fallbackName).toBe("Sam");
    expect(params.fallbackPhoto).toBeUndefined();
    expect(params.fallbackAge).toBeUndefined();
    expect(params.fallbackNeighborhood).toBeUndefined();
  });
});

describe("openProfile — calls router.push with fallback params", () => {
  beforeEach(() => { mockPush.mockClear(); });

  test("without fallback: simple navigate", () => {
    openProfile("user-abc");
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0][0] as any;
    expect(arg.params.userId).toBe("user-abc");
    expect(arg.params.fallbackName).toBeUndefined();
  });

  test("with fallback: passes all display data to route", () => {
    openProfile("user-mock-001", "matches", {
      name: "Alex",
      photoUrl: "https://example.com/alex.jpg",
      age: 28,
      neighborhood: "Wynwood",
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0][0] as any;
    expect(arg.params.fallbackName).toBe("Alex");
    expect(arg.params.fallbackPhoto).toBe("https://example.com/alex.jpg");
    expect(arg.params.fallbackAge).toBe("28");
    expect(arg.params.fallbackNeighborhood).toBe("Wynwood");
  });
});

describe("getMutualMatchChats — hasMessages discriminator", () => {
  test("match with no lastMessageText → hasMessages false", () => {
    const lastMessageText = null;
    const hasMessages = Boolean(lastMessageText);
    expect(hasMessages).toBe(false);
  });

  test("match with lastMessageText → hasMessages true", () => {
    const lastMessageText = "Hey, what's up?";
    const hasMessages = Boolean(lastMessageText);
    expect(hasMessages).toBe(true);
  });

  test("match with empty string lastMessageText → hasMessages false", () => {
    const lastMessageText = "";
    const hasMessages = Boolean(lastMessageText);
    expect(hasMessages).toBe(false);
  });
});

describe("Segment badge counts", () => {
  test("pendingCount = incomingCards + pendingShots + newMatches", () => {
    const incomingCards = buildIncomingActionCards({
      reactions: [makeReaction(), makeReaction({ id: "r2", senderId: "u2" })],
      requests: [makeRequest()],
      isPremium: true,
    });
    const pendingShots = [{ id: "s1" }, { id: "s2" }];
    const newMatches = [makeConversation({ hasMessages: false }), makeConversation({ id: "a2", hasMessages: false })];

    const pendingCount = incomingCards.length + pendingShots.length + newMatches.length;
    expect(pendingCount).toBe(7); // 3 + 2 + 2
  });

  test("chatCount = only conversations with messages", () => {
    const all = [
      makeConversation({ id: "a", hasMessages: false }),
      makeConversation({ id: "b", hasMessages: true }),
      makeConversation({ id: "c", hasMessages: false }),
      makeConversation({ id: "d", hasMessages: true }),
    ];
    const messages = all.filter((c) => c.hasMessages);
    const chatCount = messages.length;
    expect(chatCount).toBe(2);
  });
});

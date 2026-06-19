/**
 * buildLocalConvs.test.ts
 *
 * Unit tests for the pure buildLocalConvs helper.
 *
 * Critical invariant (race window fix):
 *   A match that was added to DatingMatchContext with source:"server"
 *   (e.g. immediately after like-back or accept) has NO corresponding
 *   localChats entry.  Such matches must get isLocal: false so the
 *   Connect tab routes them via openChat() instead of dead-ending at
 *   /chat/dating/[id] → "Chat unavailable".
 */

import { buildLocalConvs, type LocalChat, type LocalMatch } from "../lib/buildLocalConvs";

const NOW = "2026-06-01T12:00:00.000Z";
const LATER = "2026-06-01T13:00:00.000Z";

function makeMatch(overrides: Partial<LocalMatch> = {}): LocalMatch {
  return {
    id: "match-1",
    chatId: "chat-1",
    profile: { id: "peer-1", name: "Alice", photos: ["https://example.com/alice.jpg"] },
    createdAt: NOW,
    ...overrides,
  };
}

function makeChat(overrides: Partial<LocalChat> = {}): LocalChat {
  return {
    id: "chat-1",
    messages: [],
    ...overrides,
  };
}

describe("buildLocalConvs", () => {

  // ── Core race window fix ─────────────────────────────────────────────────

  it("sets isLocal: false for a server-sourced match with no local chat", () => {
    const match = makeMatch({ id: "match-server", chatId: "conv-server-123" });
    // No chat in localChats — this is what happens with source:"server" matches
    const result = buildLocalConvs([match], [], new Set(), "user-me");

    expect(result).toHaveLength(1);
    expect(result[0].isLocal).toBe(false);
  });

  it("uses chatId as the conv id when the match is server-sourced (enables openChat routing)", () => {
    const match = makeMatch({ id: "match-server", chatId: "conv-server-123" });
    const result = buildLocalConvs([match], [], new Set(), "user-me");

    // id should be the chatId (server conv id) so openChat(conv.id) resolves correctly
    expect(result[0].id).toBe("conv-server-123");
  });

  it("falls back to match.id when chatId is undefined and match is server-sourced", () => {
    const match = makeMatch({ id: "match-no-chatid", chatId: undefined });
    const result = buildLocalConvs([match], [], new Set(), "user-me");

    expect(result[0].isLocal).toBe(false);
    expect(result[0].id).toBe("match-no-chatid");
  });

  // ── Normal local match (has a local chat) ────────────────────────────────

  it("sets isLocal: true for a match that has a corresponding local chat", () => {
    const match = makeMatch();
    const chat = makeChat({ id: "chat-1" });
    const result = buildLocalConvs([match], [chat], new Set(), "user-me");

    expect(result[0].isLocal).toBe(true);
  });

  it("uses match.id (not chatId) as conv id for local matches", () => {
    const match = makeMatch({ id: "match-local", chatId: "chat-local" });
    const chat = makeChat({ id: "chat-local" });
    const result = buildLocalConvs([match], [chat], new Set(), "user-me");

    expect(result[0].id).toBe("match-local");
  });

  // ── Server deduplication ─────────────────────────────────────────────────

  it("filters out matches whose peerId is already in serverPeerIds", () => {
    const match = makeMatch({ profile: { id: "peer-already-on-server", name: "Bob" } });
    const result = buildLocalConvs([match], [], new Set(["peer-already-on-server"]), "user-me");

    expect(result).toHaveLength(0);
  });

  it("keeps matches whose peerId is NOT in serverPeerIds", () => {
    const match = makeMatch({ profile: { id: "peer-local-only", name: "Carol" } });
    const result = buildLocalConvs([match], [], new Set(["peer-someone-else"]), "user-me");

    expect(result).toHaveLength(1);
  });

  // ── Message derivation ───────────────────────────────────────────────────

  it("excludes system messages from hasMessages and lastMessageText", () => {
    const match = makeMatch();
    const chat = makeChat({
      messages: [
        { senderId: "system", text: "Match created!", createdAt: NOW },
      ],
    });
    const result = buildLocalConvs([match], [chat], new Set(), "user-me");

    expect(result[0].hasMessages).toBe(false);
    expect(result[0].lastMessageText).toBeUndefined();
  });

  it("surfaces the last non-system message as lastMessageText", () => {
    const match = makeMatch();
    const chat = makeChat({
      messages: [
        { senderId: "system", text: "Match created!", createdAt: NOW },
        { senderId: "peer-1", text: "Hey there!", createdAt: LATER },
      ],
    });
    const result = buildLocalConvs([match], [chat], new Set(), "user-me");

    expect(result[0].lastMessageText).toBe("Hey there!");
    expect(result[0].hasMessages).toBe(true);
    expect(result[0].lastMessageAt).toBe(LATER);
  });

  it("sets lastMessageIsMe: true when last sender is currentUserId", () => {
    const match = makeMatch();
    const chat = makeChat({
      messages: [{ senderId: "user-me", text: "Hello", createdAt: LATER }],
    });
    const result = buildLocalConvs([match], [chat], new Set(), "user-me");

    expect(result[0].lastMessageIsMe).toBe(true);
  });

  it("sets lastMessageIsMe: false when last sender is the peer", () => {
    const match = makeMatch();
    const chat = makeChat({
      messages: [{ senderId: "peer-1", text: "Hello back", createdAt: LATER }],
    });
    const result = buildLocalConvs([match], [chat], new Set(), "user-me");

    expect(result[0].lastMessageIsMe).toBe(false);
  });

  // ── Profile fields ───────────────────────────────────────────────────────

  it("maps peerId, peerName, and first photo to peerPhotoUrl", () => {
    const match = makeMatch({
      profile: { id: "peer-1", name: "Dana", photos: ["https://example.com/dana.jpg", "https://example.com/dana2.jpg"] },
    });
    const result = buildLocalConvs([match], [], new Set(), "user-me");

    expect(result[0].peerId).toBe("peer-1");
    expect(result[0].peerName).toBe("Dana");
    expect(result[0].peerPhotoUrl).toBe("https://example.com/dana.jpg");
  });

  it("sets peerPhotoUrl to undefined when no photos are present", () => {
    const match = makeMatch({ profile: { id: "peer-1", name: "No Photo User", photos: [] } });
    const result = buildLocalConvs([match], [], new Set(), "user-me");

    expect(result[0].peerPhotoUrl).toBeUndefined();
  });

  // ── Empty inputs ─────────────────────────────────────────────────────────

  it("returns an empty array when localMatches is empty", () => {
    const result = buildLocalConvs([], [], new Set(), "user-me");
    expect(result).toEqual([]);
  });

  it("handles multiple matches correctly, only filtering server peers", () => {
    const matchA = makeMatch({ id: "m-a", chatId: "c-a", profile: { id: "peer-a", name: "A" } });
    const matchB = makeMatch({ id: "m-b", chatId: "c-b", profile: { id: "peer-b", name: "B" } });
    const matchC = makeMatch({ id: "m-c", chatId: "c-c", profile: { id: "peer-c", name: "C" } });
    const chatA = makeChat({ id: "c-a" });
    // peer-b is already on server — should be filtered out
    // peer-c has no local chat — server-sourced match

    const result = buildLocalConvs(
      [matchA, matchB, matchC],
      [chatA],
      new Set(["peer-b"]),
      "user-me",
    );

    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.peerId);
    expect(ids).toContain("peer-a");
    expect(ids).toContain("peer-c");
    expect(ids).not.toContain("peer-b");

    const convA = result.find((r) => r.peerId === "peer-a")!;
    const convC = result.find((r) => r.peerId === "peer-c")!;
    expect(convA.isLocal).toBe(true);
    expect(convC.isLocal).toBe(false);  // server-sourced, no local chat
  });
});

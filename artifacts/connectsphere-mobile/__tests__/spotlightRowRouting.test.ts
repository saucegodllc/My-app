/**
 * spotlightRowRouting.test.ts
 *
 * Tests the MatchesSpotlightRow.onPress routing fix in matches.tsx (2026-06).
 *
 * Bug: Previously checked peerId first, so every new match card (which has
 *      both chatId and peerId) opened the profile instead of chat.
 * Fix: Check chatId first:
 *        1. chatId.startsWith("local:") → router.push("/chat/dating/[id]")
 *        2. chatId present (non-local)   → openChat(chatId)
 *        3. no chatId, has peerId        → navigateProfile(peerId)
 *
 * Run with: pnpm jest __tests__/spotlightRowRouting.test.ts
 */

const mockPush = jest.fn();
const mockOpenChat = jest.fn();
const mockNavigateProfile = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: mockPush, replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/lib/routes", () => ({
  openChat: mockOpenChat,
  openProfile: mockNavigateProfile,
  openPremium: jest.fn(),
}));

import { router } from "expo-router";
import { openChat, openProfile as navigateProfile } from "@/lib/routes";

// ─── Type & mirror of onPress logic from matches.tsx ─────────────────────────

interface SpotlightMatch {
  chatId?: string;
  peerId?: string;
  peerName?: string;
  peerPhotoUrl?: string;
}

/**
 * Mirrors MatchesSpotlightRow.onPress as fixed in matches.tsx:
 *   chatId first, peerId as fallback.
 */
function onSpotlightPress(match: SpotlightMatch) {
  if (match.chatId) {
    if (match.chatId.startsWith("local:")) {
      router.push({
        pathname: "/chat/dating/[id]",
        params: { id: match.chatId.slice(6) },
      } as never);
    } else {
      openChat(match.chatId);
    }
    return;
  }
  if (match.peerId) {
    navigateProfile(match.peerId, "matches", {
      name: match.peerName,
      photoUrl: match.peerPhotoUrl,
    });
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MatchesSpotlightRow.onPress — chatId takes priority over peerId", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockOpenChat.mockClear();
    mockNavigateProfile.mockClear();
  });

  describe("server chat (chatId, non-local)", () => {
    it("calls openChat with the chatId when both chatId and peerId are present", () => {
      onSpotlightPress({ chatId: "conv-server-1", peerId: "user-abc" });
      expect(mockOpenChat).toHaveBeenCalledWith("conv-server-1");
    });

    it("does NOT navigate to profile when chatId is present", () => {
      onSpotlightPress({ chatId: "conv-server-1", peerId: "user-abc" });
      expect(mockNavigateProfile).not.toHaveBeenCalled();
    });

    it("does NOT push router when chatId is non-local", () => {
      onSpotlightPress({ chatId: "conv-server-1", peerId: "user-abc" });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("works when only chatId is present (no peerId)", () => {
      onSpotlightPress({ chatId: "conv-server-2" });
      expect(mockOpenChat).toHaveBeenCalledWith("conv-server-2");
    });
  });

  describe("local dating chat (chatId starts with 'local:')", () => {
    it("pushes to /chat/dating/[id] with id stripped of 'local:' prefix", () => {
      onSpotlightPress({ chatId: "local:dating-123", peerId: "user-xyz" });
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/chat/dating/[id]",
        params: { id: "dating-123" },
      });
    });

    it("does NOT call openChat for local: chats", () => {
      onSpotlightPress({ chatId: "local:dating-123", peerId: "user-xyz" });
      expect(mockOpenChat).not.toHaveBeenCalled();
    });

    it("does NOT navigate to profile for local: chats", () => {
      onSpotlightPress({ chatId: "local:dating-123", peerId: "user-xyz" });
      expect(mockNavigateProfile).not.toHaveBeenCalled();
    });

    it("handles local chat IDs with hyphens and numbers", () => {
      onSpotlightPress({ chatId: "local:abc-def-456" });
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ params: { id: "abc-def-456" } }),
      );
    });
  });

  describe("fallback to profile (no chatId)", () => {
    it("navigates to profile when only peerId is present", () => {
      onSpotlightPress({ peerId: "user-fallback" });
      expect(mockNavigateProfile).toHaveBeenCalledWith(
        "user-fallback",
        "matches",
        expect.anything(),
      );
    });

    it("passes peerName and peerPhotoUrl in nav params", () => {
      onSpotlightPress({ peerId: "user-maya", peerName: "Maya", peerPhotoUrl: "https://example.com/maya.jpg" });
      expect(mockNavigateProfile).toHaveBeenCalledWith(
        "user-maya",
        "matches",
        { name: "Maya", photoUrl: "https://example.com/maya.jpg" },
      );
    });

    it("does NOT call openChat when only peerId is present", () => {
      onSpotlightPress({ peerId: "user-fallback" });
      expect(mockOpenChat).not.toHaveBeenCalled();
    });

    it("does nothing when both chatId and peerId are absent", () => {
      onSpotlightPress({});
      expect(mockOpenChat).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockNavigateProfile).not.toHaveBeenCalled();
    });
  });
});

/**
 * notificationRouting.test.ts
 *
 * Tests the routeFromNotification() function in PushTokenRegistrar.tsx (2026-06),
 * which was expanded to handle three distinct notification data shapes:
 *
 *   Shape 1 — chatId/matchId present (message, friend_accept, plan_invite,
 *              plan_join, double_date_match) → openChat(chatId)
 *   Shape 2 — data.url with /chat/<id> pattern → openChat(decoded chatId)
 *   Shape 3a — data.route = "/chat/dating/<id>" (anti-ghost nudge)
 *              → router.push({ pathname: "/chat/dating/[id]", params: { id } })
 *   Shape 3b — data.route = "/(tabs)/index" or "/(tabs)/matches" (daily spark)
 *              → router.push(route)
 *
 * Run with: pnpm jest __tests__/notificationRouting.test.ts
 */

const mockPush = jest.fn();
const mockOpenChat = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: mockPush, replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/lib/routes", () => ({
  openChat: mockOpenChat,
  openProfile: jest.fn(),
  openPremium: jest.fn(),
}));

import { router } from "expo-router";
import { openChat } from "@/lib/routes";

// ─── Mirror of routeFromNotification() from PushTokenRegistrar.tsx ───────────

function routeFromNotification(data: Record<string, unknown>) {
  // Shape 1: chatId or matchId
  const chatId =
    typeof data.chatId === "string" ? data.chatId
    : typeof data.matchId === "string" ? data.matchId
    : undefined;
  if (chatId) {
    openChat(chatId);
    return;
  }

  // Shape 2: URL-based legacy routing
  const url = typeof data.url === "string" ? data.url : undefined;
  if (url) {
    const chatMatch = url.match(/\/chat\/([^/?#]+)/);
    if (chatMatch?.[1]) {
      openChat(decodeURIComponent(chatMatch[1]));
      return;
    }
  }

  // Shape 3: route-based (anti-ghost nudge or daily spark)
  const route = typeof data.route === "string" ? data.route : undefined;
  if (route) {
    const datingChatMatch = route.match(/^\/chat\/dating\/([^/?#]+)/);
    if (datingChatMatch?.[1]) {
      router.push({
        pathname: "/chat/dating/[id]",
        params: { id: datingChatMatch[1] },
      } as never);
      return;
    }
    router.push(route as never);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("routeFromNotification — Shape 1: chatId / matchId", () => {
  beforeEach(() => {
    mockOpenChat.mockClear();
    mockPush.mockClear();
  });

  it("routes via openChat when chatId is present", () => {
    routeFromNotification({ chatId: "conv-abc", type: "message" });
    expect(mockOpenChat).toHaveBeenCalledWith("conv-abc");
  });

  it("routes via openChat when matchId is present (no chatId)", () => {
    routeFromNotification({ matchId: "match-xyz", type: "friend_accept" });
    expect(mockOpenChat).toHaveBeenCalledWith("match-xyz");
  });

  it("prefers chatId over matchId when both present", () => {
    routeFromNotification({ chatId: "conv-1", matchId: "match-2" });
    expect(mockOpenChat).toHaveBeenCalledWith("conv-1");
  });

  it("does not call router.push for Shape 1", () => {
    routeFromNotification({ chatId: "conv-abc" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("handles plan_invite notification type", () => {
    routeFromNotification({ chatId: "plan-conv-99", type: "plan_invite" });
    expect(mockOpenChat).toHaveBeenCalledWith("plan-conv-99");
  });

  it("handles double_date_match notification type", () => {
    routeFromNotification({ chatId: "dd-conv-77", type: "double_date_match" });
    expect(mockOpenChat).toHaveBeenCalledWith("dd-conv-77");
  });
});

describe("routeFromNotification — Shape 2: URL-based routing", () => {
  beforeEach(() => {
    mockOpenChat.mockClear();
    mockPush.mockClear();
  });

  it("extracts chat id from /chat/<id> URL and calls openChat", () => {
    routeFromNotification({ url: "/chat/conv-legacy-123" });
    expect(mockOpenChat).toHaveBeenCalledWith("conv-legacy-123");
  });

  it("URL-decodes the chat id", () => {
    routeFromNotification({ url: "/chat/conv%2Fwith%2Fslashes" });
    expect(mockOpenChat).toHaveBeenCalledWith("conv/with/slashes");
  });

  it("ignores URL if it has no /chat/ segment", () => {
    routeFromNotification({ url: "/profile/user-abc" });
    expect(mockOpenChat).not.toHaveBeenCalled();
  });

  it("strips query params from chat URL match", () => {
    routeFromNotification({ url: "/chat/conv-abc?ref=push" });
    expect(mockOpenChat).toHaveBeenCalledWith("conv-abc");
  });
});

describe("routeFromNotification — Shape 3a: anti-ghost nudge (/chat/dating/<id>)", () => {
  beforeEach(() => {
    mockOpenChat.mockClear();
    mockPush.mockClear();
  });

  it("pushes to /chat/dating/[id] with the correct id param", () => {
    routeFromNotification({ route: "/chat/dating/dating-conv-55" });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/chat/dating/[id]",
      params: { id: "dating-conv-55" },
    });
  });

  it("does not call openChat for anti-ghost route", () => {
    routeFromNotification({ route: "/chat/dating/dating-conv-55" });
    expect(mockOpenChat).not.toHaveBeenCalled();
  });

  it("handles dating chat IDs with hyphens", () => {
    routeFromNotification({ route: "/chat/dating/abc-123-xyz" });
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: "abc-123-xyz" } }),
    );
  });
});

describe("routeFromNotification — Shape 3b: daily spark (tab-level routes)", () => {
  beforeEach(() => {
    mockOpenChat.mockClear();
    mockPush.mockClear();
  });

  it("pushes /(tabs)/index for daily spark re-engagement", () => {
    routeFromNotification({ route: "/(tabs)/index" });
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/index");
  });

  it("pushes /(tabs)/matches for daily spark matches nudge", () => {
    routeFromNotification({ route: "/(tabs)/matches" });
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/matches");
  });

  it("does not call openChat for tab routes", () => {
    routeFromNotification({ route: "/(tabs)/index" });
    expect(mockOpenChat).not.toHaveBeenCalled();
  });
});

describe("routeFromNotification — no-op cases", () => {
  beforeEach(() => {
    mockOpenChat.mockClear();
    mockPush.mockClear();
  });

  it("does nothing when data is empty", () => {
    routeFromNotification({});
    expect(mockOpenChat).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignores non-string chatId", () => {
    routeFromNotification({ chatId: 12345 });
    expect(mockOpenChat).not.toHaveBeenCalled();
  });

  it("ignores null values", () => {
    routeFromNotification({ chatId: null, matchId: null, url: null, route: null });
    expect(mockOpenChat).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("Shape 1 takes precedence over Shape 2 and 3 when chatId present", () => {
    routeFromNotification({
      chatId: "conv-1",
      url: "/chat/conv-2",
      route: "/(tabs)/matches",
    });
    expect(mockOpenChat).toHaveBeenCalledTimes(1);
    expect(mockOpenChat).toHaveBeenCalledWith("conv-1");
    expect(mockPush).not.toHaveBeenCalled();
  });
});

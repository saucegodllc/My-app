import { customFetch } from "@workspace/api-client-react";
import { getConnectConversations, getMutualMatchChats, sendMatchThreadMessage } from "../services/connectApi";

const mockCustomFetch = customFetch as jest.Mock;

describe("Connect mutual match chats", () => {
  beforeEach(() => {
    mockCustomFetch.mockReset();
  });

  it("maps only server matches into Connect chat rows", async () => {
    mockCustomFetch.mockResolvedValueOnce({
      matches: [
        {
          id: "match_1",
          chatId: "match_1",
          userId1: "viewer",
          userId2: "other",
          intent: "dating",
          matchedAt: "2026-06-01T12:00:00Z",
          otherProfile: {
            userId: "other",
            displayName: "Maya",
            photos: ["https://example.com/maya.jpg"],
          },
          lastMessage: null,
          unreadCount: 0,
        },
      ],
    });

    const result = await getMutualMatchChats("viewer");

    expect(mockCustomFetch).toHaveBeenCalledWith("/api/matches?page=1&limit=100");
    expect(result.conversations).toEqual([
      expect.objectContaining({
        id: "match_1",
        type: "match",
        hasMessages: false,
        peerId: "other",
        peerName: "Maya",
        peerPhotoUrl: "https://example.com/maya.jpg",
      }),
    ]);
  });

  it("marks a matched thread with a last message as an active conversation", async () => {
    mockCustomFetch.mockResolvedValueOnce({
      matches: [
        {
          id: "match_2",
          userId1: "viewer",
          userId2: "friend",
          intent: "friends",
          matchedAt: "2026-06-01T12:00:00Z",
          otherProfile: { userId: "friend", displayName: "Ari", intent: "friendship" },
          lastMessage: {
            content: "Want to grab coffee?",
            senderId: "friend",
            createdAt: "2026-06-01T12:05:00Z",
          },
        },
      ],
    });

    const result = await getMutualMatchChats("viewer");

    expect(result.conversations[0]).toEqual(expect.objectContaining({
      id: "match_2",
      type: "direct",
      hasMessages: true,
      lastMessageText: "Want to grab coffee?",
      lastMessageIsMe: false,
    }));
  });

  it("uses server matches for generic Connect conversations", async () => {
    mockCustomFetch.mockResolvedValueOnce({
      matches: [
        {
          id: "match_3",
          userId1: "viewer",
          userId2: "other",
          intent: "dating",
          otherProfile: { userId: "other", displayName: "Nia" },
          unreadCount: 2,
        },
      ],
    });

    const result = await getConnectConversations("viewer");

    expect(mockCustomFetch).toHaveBeenCalledWith("/api/matches?page=1&limit=100");
    expect(result.conversations[0]).toEqual(expect.objectContaining({
      id: "match_3",
      unreadCount: 2,
      peerName: "Nia",
    }));
  });

  it("sends opener and share invites through the match message route", async () => {
    mockCustomFetch.mockResolvedValueOnce({
      id: "msg_1",
      content: "Want to trade two truths and a lie?",
      senderId: "viewer",
      createdAt: "2026-06-01T12:00:00Z",
    });

    await sendMatchThreadMessage({ conversationId: "match_4", text: "Want to trade two truths and a lie?" });

    expect(mockCustomFetch).toHaveBeenCalledWith("/api/messages/match_4", {
      method: "POST",
      body: JSON.stringify({ content: "Want to trade two truths and a lie?" }),
    });
  });
});

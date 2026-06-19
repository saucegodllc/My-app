import { normalizeBlockedUsersResponse } from "../services/blockedUsersApi";

describe("normalizeBlockedUsersResponse", () => {
  it("keeps canonical backend blocked user display fields", () => {
    expect(
      normalizeBlockedUsersResponse({
        blockedUsers: [
          {
            id: "user_maya",
            userId: "user_maya",
            name: "Maya",
            photoUrl: "https://example.com/maya.jpg",
            blockedAt: "2026-06-03T12:00:00.000Z",
          },
        ],
      }),
    ).toEqual([
      {
        id: "user_maya",
        userId: "user_maya",
        name: "Maya",
        photoUrl: "https://example.com/maya.jpg",
        blockedAt: "2026-06-03T12:00:00.000Z",
      },
    ]);
  });

  it("falls back for legacy list responses with only userId", () => {
    expect(normalizeBlockedUsersResponse({ blockedUsers: [{ userId: "user_omar" }] })).toEqual([
      {
        id: "user_omar",
        userId: "user_omar",
        name: "Unknown",
        photoUrl: "",
        blockedAt: undefined,
      },
    ]);
  });
});

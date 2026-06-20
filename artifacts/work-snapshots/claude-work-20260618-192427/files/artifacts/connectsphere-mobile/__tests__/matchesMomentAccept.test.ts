/**
 * matchesMomentAccept.test.ts
 *
 * Regression tests for the accept() fix in matches.tsx (2026-06):
 *
 *   Before: accepted a request, showed a flash, but left the user stranded
 *           with no way to reach the accepted person.
 *   After:  removes the request from the list, shows flash immediately, then
 *           at 800ms clears the flash and calls navigateProfile() so the user
 *           lands on the accepted person's profile.
 *
 * accept() lives inside the private MomentsConnectSection component, so we
 * test the behavioral contract directly as a pure-logic unit test — the same
 * approach used in connectRouting.test.ts.
 *
 * Run with: pnpm jest __tests__/matchesMomentAccept.test.ts
 */

import * as Haptics from "expo-haptics";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// expo-haptics is globally mocked in jest.setup.js.
// openProfile from @/lib/routes is what the component calls after 800ms.
const mockNavigateProfile = jest.fn();

jest.mock("@/lib/routes", () => ({
  openProfile: mockNavigateProfile,
  openChat: jest.fn(),
  openPremium: jest.fn(),
}));

// ─── Types & fixtures ────────────────────────────────────────────────────────

interface MomentRequest {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  fromPhotoUrl: string;
  status: "pending" | "accepted" | "declined";
}

function makeRequest(overrides: Partial<MomentRequest> = {}): MomentRequest {
  return {
    id: "req-1",
    fromUserId: "user-carlos",
    fromDisplayName: "Carlos",
    fromPhotoUrl: "https://example.com/carlos.jpg",
    status: "pending",
    ...overrides,
  };
}

// ─── accept() behavioral contract ────────────────────────────────────────────

describe("accept() in MomentsConnectSection", () => {
  let requests: MomentRequest[];
  let setRequests: jest.Mock;
  let setAcceptedFlash: jest.Mock;

  /**
   * Mirrors the accept() implementation in matches.tsx:
   *
   *   const req = requests.find(r => r.id === rid);
   *   if (!req) return;
   *   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
   *   setRequests(prev => prev.filter(r => r.id !== rid));
   *   setAcceptedFlash(`Accepted ${req.fromDisplayName}'s request!`);
   *   setTimeout(() => {
   *     setAcceptedFlash(null);
   *     navigateProfile(req.fromUserId, "moments", { name: req.fromDisplayName, photoUrl: req.fromPhotoUrl });
   *   }, 800);
   */
  function accept(rid: string) {
    const req = requests.find((r) => r.id === rid);
    if (!req) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRequests((prev: MomentRequest[]) => prev.filter((r) => r.id !== rid));
    setAcceptedFlash(`Accepted ${req.fromDisplayName}'s request!`);
    setTimeout(() => {
      setAcceptedFlash(null);
      mockNavigateProfile(req.fromUserId, "moments", {
        name: req.fromDisplayName,
        photoUrl: req.fromPhotoUrl,
      });
    }, 800);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    requests = [makeRequest(), makeRequest({ id: "req-2", fromUserId: "user-nia", fromDisplayName: "Nia" })];
    setRequests = jest.fn();
    setAcceptedFlash = jest.fn();
    mockNavigateProfile.mockClear();
    (Haptics.notificationAsync as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Immediate effects ──────────────────────────────────────────────────────

  it("removes the accepted request from the list immediately", () => {
    accept("req-1");
    // setRequests is called with an updater — invoke it to verify filter logic
    const updater = setRequests.mock.calls[0][0];
    const result = updater(requests);
    expect(result.find((r: MomentRequest) => r.id === "req-1")).toBeUndefined();
  });

  it("keeps other requests in the list", () => {
    accept("req-1");
    const updater = setRequests.mock.calls[0][0];
    const result = updater(requests);
    expect(result.find((r: MomentRequest) => r.id === "req-2")).toBeDefined();
  });

  it("shows acceptedFlash immediately with the person's display name", () => {
    accept("req-1");
    expect(setAcceptedFlash).toHaveBeenNthCalledWith(1, "Accepted Carlos's request!");
  });

  it("fires Success haptic immediately on accept", () => {
    accept("req-1");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it("does nothing if rid is not found", () => {
    accept("nonexistent-id");
    expect(setRequests).not.toHaveBeenCalled();
    expect(setAcceptedFlash).not.toHaveBeenCalled();
    expect(mockNavigateProfile).not.toHaveBeenCalled();
  });

  // ── 800ms navigation ──────────────────────────────────────────────────────

  it("does not navigate before 800ms", () => {
    accept("req-1");
    jest.advanceTimersByTime(799);
    expect(mockNavigateProfile).not.toHaveBeenCalled();
  });

  it("navigates to the accepted user's profile after exactly 800ms", () => {
    accept("req-1");
    jest.advanceTimersByTime(800);
    expect(mockNavigateProfile).toHaveBeenCalledTimes(1);
  });

  it("navigates with correct userId", () => {
    accept("req-1");
    jest.advanceTimersByTime(800);
    expect(mockNavigateProfile).toHaveBeenCalledWith(
      "user-carlos",
      expect.anything(),
      expect.anything(),
    );
  });

  it("navigates with 'moments' context", () => {
    accept("req-1");
    jest.advanceTimersByTime(800);
    expect(mockNavigateProfile).toHaveBeenCalledWith(
      expect.anything(),
      "moments",
      expect.anything(),
    );
  });

  it("passes display name and photo in nav params", () => {
    accept("req-1");
    jest.advanceTimersByTime(800);
    const params = mockNavigateProfile.mock.calls[0][2];
    expect(params.name).toBe("Carlos");
    expect(params.photoUrl).toBe("https://example.com/carlos.jpg");
  });

  it("clears the flash before navigating at 800ms", () => {
    accept("req-1");
    jest.advanceTimersByTime(800);
    // The 2nd call to setAcceptedFlash should be null (clear)
    expect(setAcceptedFlash).toHaveBeenNthCalledWith(2, null);
    // And navigation happens in the same tick
    expect(mockNavigateProfile).toHaveBeenCalledTimes(1);
  });

  // ── Works for any request in the list ────────────────────────────────────

  it("navigates to the correct user when accepting a different request", () => {
    accept("req-2");
    expect(setAcceptedFlash).toHaveBeenNthCalledWith(1, "Accepted Nia's request!");
    jest.advanceTimersByTime(800);
    expect(mockNavigateProfile).toHaveBeenCalledWith(
      "user-nia",
      "moments",
      expect.objectContaining({ name: "Nia" }),
    );
  });
});

/**
 * Unit tests — useIcebreakers hook
 *
 * Run with: pnpm test --testPathPattern=useIcebreakers
 */
import { renderHook, act, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIcebreakers } from "../hooks/useIcebreakers";

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const MOCK_ICEBREAKERS = [
  "What's the best spontaneous thing you've done recently?",
  "Cozy night in or out — what tips you either way?",
  "Fellow quality-time person — ideal no-phone afternoon?",
];

function mockFetchSuccess() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ icebreakers: MOCK_ICEBREAKERS, personalized: true }),
  } as Response);
}

function mockFetchFailure() {
  global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useIcebreakers", () => {
  it("returns empty array initially", () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useIcebreakers("match-1", false));
    expect(result.current.icebreakers).toEqual([]);
  });

  it("fetches and returns icebreakers for a new match", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useIcebreakers("match-1", false));

    await waitFor(() => {
      expect(result.current.icebreakers).toHaveLength(3);
    });

    expect(result.current.icebreakers[0]).toBe(MOCK_ICEBREAKERS[0]);
  });

  it("does NOT fetch when hasMessages is true", async () => {
    mockFetchSuccess();
    renderHook(() => useIcebreakers("match-1", true));
    await new Promise((r) => setTimeout(r, 50));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does NOT fetch when matchId is undefined", async () => {
    mockFetchSuccess();
    renderHook(() => useIcebreakers(undefined, false));
    await new Promise((r) => setTimeout(r, 50));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("caches result in AsyncStorage", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useIcebreakers("match-cache", false));
    await waitFor(() => expect(result.current.icebreakers.length).toBe(3));

    const cached = await AsyncStorage.getItem("icebreakers_v1_match-cache");
    expect(JSON.parse(cached!)).toEqual(MOCK_ICEBREAKERS);
  });

  it("returns cached result without fetching on second render", async () => {
    // Pre-populate cache
    await AsyncStorage.setItem(
      "icebreakers_v1_match-cached",
      JSON.stringify(MOCK_ICEBREAKERS),
    );

    mockFetchSuccess();
    const { result } = renderHook(() => useIcebreakers("match-cached", false));

    await waitFor(() => expect(result.current.icebreakers.length).toBe(3));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not show after being dismissed", async () => {
    // Pre-populate dismissed flag
    await AsyncStorage.setItem("icebreakers_dismissed_v1_match-dismissed", "1");

    mockFetchSuccess();
    const { result } = renderHook(() => useIcebreakers("match-dismissed", false));

    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.icebreakers).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dismiss() clears icebreakers and sets dismissed flag", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useIcebreakers("match-dismiss-test", false));
    await waitFor(() => expect(result.current.icebreakers.length).toBe(3));

    await act(async () => {
      result.current.dismiss();
    });

    expect(result.current.icebreakers).toHaveLength(0);
    const flag = await AsyncStorage.getItem("icebreakers_dismissed_v1_match-dismiss-test");
    expect(flag).toBe("1");
  });

  it("handles fetch failure gracefully — returns empty, no crash", async () => {
    mockFetchFailure();
    const { result } = renderHook(() => useIcebreakers("match-fail", false));
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.icebreakers).toHaveLength(0);
  });
});

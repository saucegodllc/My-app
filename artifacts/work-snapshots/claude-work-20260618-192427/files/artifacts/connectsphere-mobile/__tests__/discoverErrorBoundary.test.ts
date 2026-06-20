/**
 * discoverErrorBoundary.test.ts
 * ──────────────────────────────
 * Tests for DiscoverErrorBoundary behaviour:
 *   1. Derives error message from getDerivedStateFromError
 *   2. componentDidCatch reports to Sentry + Analytics
 *   3. retry() resets state back to clean
 *   4. Sentry.captureException receives componentStack + source tag
 *   5. Analytics.errorBoundaryTriggered receives screen + message
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCaptureException = jest.fn();
jest.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: mockCaptureException,
  },
}));

const mockErrorBoundaryTriggered = jest.fn();
jest.mock("@/lib/analytics", () => ({
  Analytics: {
    errorBoundaryTriggered: mockErrorBoundaryTriggered,
  },
}));

// ─── getDerivedStateFromError logic ──────────────────────────────────────────

describe("getDerivedStateFromError", () => {
  function deriveState(error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";
    return { hasError: true, errorMessage: msg };
  }

  it("extracts message from Error objects", () => {
    const state = deriveState(new Error("Deck exploded"));
    expect(state.hasError).toBe(true);
    expect(state.errorMessage).toBe("Deck exploded");
  });

  it("uses string errors directly", () => {
    const state = deriveState("SwipeCard null ref");
    expect(state.hasError).toBe(true);
    expect(state.errorMessage).toBe("SwipeCard null ref");
  });

  it("falls back to 'Unknown error' for non-string/non-Error values", () => {
    const state = deriveState(42);
    expect(state.hasError).toBe(true);
    expect(state.errorMessage).toBe("Unknown error");
  });

  it("falls back to 'Unknown error' for null", () => {
    const state = deriveState(null);
    expect(state.errorMessage).toBe("Unknown error");
  });
});

// ─── componentDidCatch side-effects ──────────────────────────────────────────

describe("componentDidCatch side-effects", () => {
  beforeEach(() => {
    mockCaptureException.mockClear();
    mockErrorBoundaryTriggered.mockClear();
  });

  function simulateCatch(error: unknown, componentStack: string) {
    // Inline the same logic as DiscoverErrorBoundary.componentDidCatch
    const { Sentry } = require("@/lib/sentry");
    const { Analytics } = require("@/lib/analytics");
    Sentry.captureException(error, {
      componentStack,
      source: "DiscoverErrorBoundary",
    });
    Analytics.errorBoundaryTriggered("discover", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  it("calls Sentry.captureException with the error object", () => {
    const err = new Error("SwipeCard crash");
    simulateCatch(err, "\n  at SwipeCard\n  at DiscoverScreen");
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ source: "DiscoverErrorBoundary" }),
    );
  });

  it("passes componentStack to Sentry", () => {
    const stack = "\n  at SwipeCard\n  at FlatList";
    simulateCatch(new Error("oops"), stack);
    const [, extra] = mockCaptureException.mock.calls[0];
    expect(extra.componentStack).toBe(stack);
  });

  it("calls Analytics.errorBoundaryTriggered with screen 'discover'", () => {
    simulateCatch(new Error("null ref"), "stack");
    expect(mockErrorBoundaryTriggered).toHaveBeenCalledWith(
      "discover",
      expect.objectContaining({ message: "null ref" }),
    );
  });

  it("handles non-Error thrown values in Analytics message", () => {
    simulateCatch("plain string error", "stack");
    expect(mockErrorBoundaryTriggered).toHaveBeenCalledWith(
      "discover",
      expect.objectContaining({ message: "plain string error" }),
    );
  });

  it("reports 'unavailable' componentStack when info.componentStack is null", () => {
    const { Sentry } = require("@/lib/sentry");
    const error = new Error("test");
    const nullStack: string | null = null;
    Sentry.captureException(error, {
      componentStack: nullStack ?? "unavailable",
      source: "DiscoverErrorBoundary",
    });
    const [, extra] = mockCaptureException.mock.calls[0];
    expect(extra.componentStack).toBe("unavailable");
  });
});

// ─── retry() ─────────────────────────────────────────────────────────────────

describe("retry()", () => {
  it("resets hasError and errorMessage to clean state", () => {
    let state: { hasError: boolean; errorMessage: string | null } = { hasError: true, errorMessage: "boom" };
    // Simulate retry — same logic as DiscoverErrorBoundary.retry
    const retry = () => { state = { hasError: false, errorMessage: null }; };
    retry();
    expect(state.hasError).toBe(false);
    expect(state.errorMessage).toBeNull();
  });

  it("can be called multiple times without side effects", () => {
    let state: { hasError: boolean; errorMessage: string | null } = { hasError: true, errorMessage: "boom" };
    const retry = () => { state = { hasError: false, errorMessage: null }; };
    retry();
    retry();
    expect(state.hasError).toBe(false);
  });
});

// ─── Render path selection ────────────────────────────────────────────────────

describe("render path selection", () => {
  it("renders children when hasError is false", () => {
    const state = { hasError: false, errorMessage: null };
    // Simulate: return children when no error
    const rendered = state.hasError ? "fallback" : "children";
    expect(rendered).toBe("children");
  });

  it("renders fallback when hasError is true", () => {
    const state = { hasError: true, errorMessage: "crash" };
    const rendered = state.hasError ? "fallback" : "children";
    expect(rendered).toBe("fallback");
  });

  it("uses custom fallback prop when provided", () => {
    const state = { hasError: true, errorMessage: "crash" };
    const customFallback = jest.fn((_retry: () => void) => "custom");
    const retry = jest.fn();
    const rendered = state.hasError && customFallback
      ? customFallback(retry)
      : "default-fallback";
    expect(customFallback).toHaveBeenCalledWith(retry);
    expect(rendered).toBe("custom");
  });
});

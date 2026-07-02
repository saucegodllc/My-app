import {
  isSentrySmokeEnabled,
  sendSentrySmokeTest,
  type SentryLike,
} from "@/lib/sentry";

describe("Sentry smoke test", () => {
  it("is enabled in dev unless explicitly disabled", () => {
    expect(isSentrySmokeEnabled({ NODE_ENV: "development" }, true)).toBe(true);
    expect(isSentrySmokeEnabled({ EXPO_PUBLIC_ENABLE_SENTRY_SMOKE: "false" }, true)).toBe(false);
  });

  it("requires an explicit flag outside dev", () => {
    expect(isSentrySmokeEnabled({ NODE_ENV: "production" }, false)).toBe(false);
    expect(isSentrySmokeEnabled({ EXPO_PUBLIC_ENABLE_SENTRY_SMOKE: "true" }, false)).toBe(true);
  });

  it("sends a message and metrics through the active Sentry client", async () => {
    const client = {
      captureException: jest.fn(),
      captureMessage: jest.fn(),
      flush: jest.fn().mockResolvedValue(true),
      metrics: {
        count: jest.fn(),
        gauge: jest.fn(),
        distribution: jest.fn(),
      },
    } as unknown as SentryLike;

    const result = await sendSentrySmokeTest(client);

    expect(result).toEqual({ sent: true, metricsSent: true });
    expect(client.captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(client.captureMessage).toHaveBeenCalledWith("ConnectSphere mobile Sentry smoke test");
    expect(client.flush).toHaveBeenCalledWith(2000);
    expect(client.metrics?.count).toHaveBeenCalledWith("connectsphere.sentry_smoke", 1, {
      unit: "event",
      attributes: { source: "settings" },
    });
    expect(client.metrics?.gauge).toHaveBeenCalledWith("connectsphere.sentry_smoke_queue_depth", 1);
    expect(client.metrics?.distribution).toHaveBeenCalledWith("connectsphere.sentry_smoke_response_time", 187.5, {
      unit: "millisecond",
    });
  });
});

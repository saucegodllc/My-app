import { assertProductionLaunchSafety, shouldUseLocalDbFallback } from "./launchGuards";

describe("production launch guards", () => {
  it("rejects local DB fallback in production", () => {
    expect(() =>
      assertProductionLaunchSafety({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://prod.example/connectsphere",
        CONNECTSPHERE_LOCAL_DB_FALLBACK: "1",
      }),
    ).toThrow(/CONNECTSPHERE_LOCAL_DB_FALLBACK/);
  });

  it("rejects demo seed flags in production", () => {
    expect(() =>
      assertProductionLaunchSafety({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://prod.example/connectsphere",
        CONNECTSPHERE_ENABLE_DEMO_SEEDS: "true",
      }),
    ).toThrow(/CONNECTSPHERE_ENABLE_DEMO_SEEDS/);
  });

  it("requires a database URL in production", () => {
    expect(() =>
      assertProductionLaunchSafety({
        NODE_ENV: "production",
        CONNECTSPHERE_LOCAL_DB_FALLBACK: "0",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("allows local fallback outside production", () => {
    const env = {
      NODE_ENV: "development",
      CONNECTSPHERE_LOCAL_DB_FALLBACK: "true",
    };

    expect(() => assertProductionLaunchSafety(env)).not.toThrow();
    expect(shouldUseLocalDbFallback(env)).toBe(true);
  });
});

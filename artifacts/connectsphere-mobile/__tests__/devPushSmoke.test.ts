import {
  buildDevPushSmokeRequest,
  getDevPushSmokeSnapshot,
  getMaskedExpoPushToken,
  isDevPushSmokeEnabled,
  resetDevPushSmokeState,
  updateDevPushSmokeState,
} from "@/lib/devPushSmoke";

describe("dev push smoke helper", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.EXPO_PUBLIC_ENABLE_PUSH_SMOKE;
  const mutableEnv = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };

  afterEach(() => {
    mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_ENABLE_PUSH_SMOKE;
    else process.env.EXPO_PUBLIC_ENABLE_PUSH_SMOKE = originalFlag;
    resetDevPushSmokeState();
  });

  it("is gated out of production UI", () => {
    mutableEnv.NODE_ENV = "production";
    process.env.EXPO_PUBLIC_ENABLE_PUSH_SMOKE = "true";
    expect(isDevPushSmokeEnabled()).toBe(false);
  });

  it("can be hidden in development with a public env flag", () => {
    mutableEnv.NODE_ENV = "development";
    process.env.EXPO_PUBLIC_ENABLE_PUSH_SMOKE = "false";
    expect(isDevPushSmokeEnabled()).toBe(false);

    delete process.env.EXPO_PUBLIC_ENABLE_PUSH_SMOKE;
    expect(isDevPushSmokeEnabled()).toBe(true);
  });

  it("tracks token registration state for Settings UI", () => {
    updateDevPushSmokeState({
      token: "ExponentPushToken[abcdefghijklmnopqrstuvwxyz1234567890]",
      registrationStatus: "registered",
      registeredAt: "2026-06-11T20:00:00.000Z",
      lastMessage: "registered token with API",
    });

    expect(getDevPushSmokeSnapshot()).toEqual(
      expect.objectContaining({
        token: "ExponentPushToken[abcdefghijklmnopqrstuvwxyz1234567890]",
        registrationStatus: "registered",
        registeredAt: "2026-06-11T20:00:00.000Z",
        lastMessage: "registered token with API",
      }),
    );
  });

  it("masks long Expo tokens without hiding the token state", () => {
    expect(getMaskedExpoPushToken(null)).toBe("No Expo token yet");
    expect(getMaskedExpoPushToken("ExponentPushToken[abcdefghijklmnopqrstuvwxyz1234567890]")).toBe(
      "ExponentPushToken[abcd...7890]",
    );
  });

  it("builds message and match smoke requests for /api/notify/test", () => {
    expect(buildDevPushSmokeRequest("message")).toEqual({
      method: "POST",
      body: JSON.stringify({ kind: "message", chatId: "push-smoke-test-message" }),
    });
    expect(buildDevPushSmokeRequest("match")).toEqual({
      method: "POST",
      body: JSON.stringify({ kind: "double_date_match", chatId: "push-smoke-test-match" }),
    });
  });

  it("loads the dev panel and registrar modules through app aliases", () => {
    expect(require("@/components/DevPushSmokePanel").default).toBeDefined();
    expect(require("@/components/PushTokenRegistrar").default).toBeDefined();
  });
});

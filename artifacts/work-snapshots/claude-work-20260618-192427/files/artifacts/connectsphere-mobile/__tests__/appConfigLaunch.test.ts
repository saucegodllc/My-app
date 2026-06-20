const appJson = require("../app.json");

describe("launch app config", () => {
  const expo = appJson.expo;

  it("has deterministic native launch version fields", () => {
    expect(expo.ios.buildNumber).toBe("2");
    expect(expo.android.versionCode).toBe(2);
  });

  it("uses the production Expo Router origin", () => {
    const routerPlugin = expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-router");
    expect(routerPlugin?.[1]?.origin).toBe("https://connectsphere.app");
  });

  it("has App Store permission descriptions for camera, photos, and location", () => {
    expect(expo.ios.infoPlist.NSCameraUsageDescription).toContain("camera");
    expect(expo.ios.infoPlist.NSPhotoLibraryUsageDescription).toContain("photos");
    expect(expo.ios.infoPlist.NSLocationWhenInUseUsageDescription).toContain("nearby");
  });

  it("documents that OTA updates are intentionally disabled for this release", () => {
    expect(expo.runtimeVersion).toBeUndefined();
    expect(expo.updates).toBeUndefined();
  });
});

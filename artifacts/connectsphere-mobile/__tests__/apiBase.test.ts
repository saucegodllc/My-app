describe("getApiBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_DOMAIN;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.dontMock("expo-constants");
    jest.dontMock("react-native");
  });

  async function loadApiBase(options: {
    platform: "web" | "ios" | "android";
    domain?: string;
    explicit?: string;
    hostUri?: string | null;
  }) {
    if (options.domain !== undefined) process.env.EXPO_PUBLIC_DOMAIN = options.domain;
    if (options.explicit !== undefined) process.env.EXPO_PUBLIC_API_URL = options.explicit;

    jest.doMock("react-native", () => ({
      Platform: { OS: options.platform },
    }));
    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: {
        expoConfig: { hostUri: options.hostUri ?? null },
        manifest: null,
        manifest2: null,
      },
    }));

    return require("@/lib/apiBase") as typeof import("@/lib/apiBase");
  }

  it("uses an explicit API URL without trailing slashes", async () => {
    const { getApiBaseUrl } = await loadApiBase({
      platform: "ios",
      explicit: "https://api.example.com///",
      domain: "localhost:8080",
    });

    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });

  it("keeps localhost on web", async () => {
    const { getApiBaseUrl } = await loadApiBase({
      platform: "web",
      domain: "localhost:8093",
    });

    expect(getApiBaseUrl()).toBe("http://localhost:8093");
  });

  it("rewrites native localhost to the Expo LAN host", async () => {
    const { getApiBaseUrl } = await loadApiBase({
      platform: "ios",
      domain: "localhost:8093",
      hostUri: "192.168.1.197:8108",
    });

    expect(getApiBaseUrl()).toBe("http://192.168.1.197:8093");
  });

  it("uses the Android emulator host when Expo has no LAN host", async () => {
    const { getApiBaseUrl } = await loadApiBase({
      platform: "android",
      domain: "localhost:8093",
    });

    expect(getApiBaseUrl()).toBe("http://10.0.2.2:8093");
  });

  it("uses https for Expo tunnel hosts", async () => {
    const { getApiBaseUrl } = await loadApiBase({
      platform: "ios",
      domain: "localhost:8097",
      hostUri: "wgmuwsg-anonymous-8097.exp.direct",
    });

    expect(getApiBaseUrl()).toBe("https://wgmuwsg-anonymous-8097.exp.direct");
  });
});

import { readFileSync } from "fs";
import { resolve } from "path";

describe("Connect Moments upgrade card", () => {
  it("routes taps to the Moments premium paywall", () => {
    const source = readFileSync(
      resolve("app/(tabs)/matches.tsx"),
      "utf8",
    );

    expect(source).toContain('<Pressable style={mStyles.upgradeCard} onPress={() => openPremium("moments")}>');
  });
});

describe("Profile Views upsell", () => {
  it("routes taps to the Profile Views premium paywall", () => {
    const source = readFileSync(
      resolve("app/profile-views.tsx"),
      "utf8",
    );

    expect(source).toContain('onPress={() => openPremium("profile-views")}');
  });
});

describe("Spark premium chips", () => {
  it("routes both premium token forms to the Spark premium paywall", () => {
    const source = readFileSync(
      resolve("app/chat/ai-bot.tsx"),
      "utf8",
    );

    expect(source).toContain('if (route === "premium" || route === "/premium")');
    expect(source).toContain('openPremium("spark")');
  });
});

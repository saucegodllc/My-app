export const launchEnvironment = process.env.EXPO_PUBLIC_ENVIRONMENT ?? (__DEV__ ? "development" : "production");

export const isProductionLaunch = launchEnvironment === "production";

export const demoSeedsEnabled =
  process.env.EXPO_PUBLIC_ENABLE_DEMO_SEEDS === "1" ||
  process.env.EXPO_PUBLIC_ENABLE_DEMO_SEEDS === "true" ||
  (__DEV__ && process.env.EXPO_PUBLIC_ENABLE_DEMO_SEEDS !== "0" && process.env.EXPO_PUBLIC_ENABLE_DEMO_SEEDS !== "false");

export function shouldUseDemoSeeds() {
  return !isProductionLaunch && demoSeedsEnabled;
}

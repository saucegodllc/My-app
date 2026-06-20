const appJson = require("./app.json");
const fs = require("fs");
const path = require("path");

const config = appJson.expo;
const optionalLocalPlugins = new Set(["expo-build-properties", "expo-tracking-transparency"]);

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function canResolvePlugin(plugin) {
  const name = pluginName(plugin);
  if (typeof name !== "string" || !optionalLocalPlugins.has(name)) return true;
  try {
    require.resolve(name, { paths: [__dirname] });
    return true;
  } catch {
    console.warn(`[app.config] Skipping optional config plugin "${name}" because it is not installed locally.`);
    return false;
  }
}

const plugins = [...(config.plugins ?? [])].filter(canResolvePlugin);
const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? config.extra?.eas?.projectId;
const environment = process.env.EXPO_PUBLIC_ENVIRONMENT ?? "development";
const android = { ...(config.android ?? {}) };
const ios = { ...(config.ios ?? {}) };

function flagEnabled(value) {
  return typeof value === "string" && ["1", "true", "yes", "on", "enabled"].includes(value.trim().toLowerCase());
}

if (environment === "production" && !projectId) {
  throw new Error("Missing EXPO_PUBLIC_PROJECT_ID for production EAS builds.");
}

if (environment === "production" && flagEnabled(process.env.EXPO_PUBLIC_ENABLE_DEMO_SEEDS)) {
  throw new Error("EXPO_PUBLIC_ENABLE_DEMO_SEEDS must be disabled for production EAS builds.");
}

if (environment === "production" && flagEnabled(process.env.EXPO_PUBLIC_CONNECTSPHERE_LOCAL_DB_FALLBACK)) {
  throw new Error("EXPO_PUBLIC_CONNECTSPHERE_LOCAL_DB_FALLBACK must be disabled for production EAS builds.");
}

if (android.googleServicesFile && !fs.existsSync(path.resolve(__dirname, android.googleServicesFile))) {
  console.warn(
    `[app.config] Skipping android.googleServicesFile because "${android.googleServicesFile}" is not present locally.`,
  );
  delete android.googleServicesFile;
}

if (ios.googleServicesFile && !fs.existsSync(path.resolve(__dirname, ios.googleServicesFile))) {
  console.warn(
    `[app.config] Skipping ios.googleServicesFile because "${ios.googleServicesFile}" is not present locally.`,
  );
  delete ios.googleServicesFile;
}

if (process.env.EXPO_PUBLIC_SENTRY_DSN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
  plugins.push([
    "@sentry/react-native/expo",
    {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    },
  ]);
}

module.exports = {
  expo: {
    ...config,
    plugins,
    extra: {
      ...(config.extra ?? {}),
      ...(projectId ? { eas: { ...(config.extra?.eas ?? {}), projectId } } : {}),
      environment,
      release: process.env.EXPO_PUBLIC_RELEASE ?? `${config.version ?? "0.0.0"}-${process.env.EAS_BUILD_GIT_COMMIT_HASH ?? "local"}`,
      buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER ?? process.env.EAS_BUILD_ID ?? "local",
    },
    android: {
      ...android,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_PLACES_API_KEY || "",
        },
      },
    },
    ios,
  },
};

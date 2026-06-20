type LaunchEnv = Record<string, string | undefined>;

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const PRODUCTION_DEMO_SEED_FLAGS = [
  "CONNECTSPHERE_ENABLE_DEMO_SEEDS",
  "CONNECTSPHERE_DEMO_SEEDS",
  "EXPO_PUBLIC_ENABLE_DEMO_SEEDS",
];

function envFlagEnabled(value: string | undefined): boolean {
  return typeof value === "string" && TRUE_VALUES.has(value.trim().toLowerCase());
}

export function isProductionEnv(env: LaunchEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

export function shouldUseLocalDbFallback(env: LaunchEnv = process.env): boolean {
  return envFlagEnabled(env.CONNECTSPHERE_LOCAL_DB_FALLBACK) && !isProductionEnv(env);
}

export function assertProductionLaunchSafety(env: LaunchEnv = process.env): void {
  if (!isProductionEnv(env)) return;

  if (!env.DATABASE_URL || env.DATABASE_URL.trim() === "") {
    throw new Error("DATABASE_URL is required when NODE_ENV=production; refusing to boot without a production database.");
  }

  if (envFlagEnabled(env.CONNECTSPHERE_LOCAL_DB_FALLBACK)) {
    throw new Error("CONNECTSPHERE_LOCAL_DB_FALLBACK must be disabled when NODE_ENV=production; refusing to boot with local demo data enabled.");
  }

  for (const key of PRODUCTION_DEMO_SEED_FLAGS) {
    if (envFlagEnabled(env[key])) {
      throw new Error(`${key} must be disabled when NODE_ENV=production; refusing to boot with mock seed data enabled.`);
    }
  }
}

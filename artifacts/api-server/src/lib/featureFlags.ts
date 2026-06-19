export const FEATURE_FLAG_KEYS = [
  "double_date",
  "premium",
  "push",
  "events_live_providers",
  "ai_bio",
  "resume_upload",
  "local_db_fallback",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

const DEFAULTS: Record<FeatureFlagKey, boolean> = {
  double_date: true,
  premium: true,
  push: true,
  events_live_providers: true,
  ai_bio: true,
  resume_upload: true,
  local_db_fallback: false,
};

const ENV_NAMES: Record<FeatureFlagKey, string> = {
  double_date: "CONNECTSPHERE_FEATURE_DOUBLE_DATE",
  premium: "CONNECTSPHERE_FEATURE_PREMIUM",
  push: "CONNECTSPHERE_FEATURE_PUSH",
  events_live_providers: "CONNECTSPHERE_FEATURE_EVENTS_LIVE_PROVIDERS",
  ai_bio: "CONNECTSPHERE_FEATURE_AI_BIO",
  resume_upload: "CONNECTSPHERE_FEATURE_RESUME_UPLOAD",
  local_db_fallback: "CONNECTSPHERE_LOCAL_DB_FALLBACK",
};

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
}

export function resolveFeatureFlags(env: Record<string, string | undefined> = process.env): Record<FeatureFlagKey, boolean> {
  return FEATURE_FLAG_KEYS.reduce(
    (flags, key) => {
      if (key === "local_db_fallback" && env.NODE_ENV === "production") {
        flags[key] = false;
        return flags;
      }
      flags[key] = parseBooleanFlag(env[ENV_NAMES[key]], DEFAULTS[key]);
      return flags;
    },
    {} as Record<FeatureFlagKey, boolean>,
  );
}

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return resolveFeatureFlags()[key];
}

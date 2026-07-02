export type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  setUser: (user: { id: string; username?: string } | null) => void;
  captureException: (error: unknown) => void;
  captureMessage: (message: string) => void;
  flush?: (timeout?: number) => PromiseLike<boolean>;
  metrics?: {
    count: (name: string, value: number, options?: Record<string, unknown>) => void;
    gauge: (name: string, value: number, options?: Record<string, unknown>) => void;
    distribution: (name: string, value: number, options?: Record<string, unknown>) => void;
  };
  reactNativeTracingIntegration?: () => unknown;
};

let sentry: SentryLike | null = null;
let initStarted = false;

async function loadSentry(): Promise<SentryLike | null> {
  if (sentry) return sentry;
  try {
    const moduleName = "@sentry/react-native";
    sentry = (await import(moduleName)) as SentryLike;
    return sentry;
  } catch {
    return null;
  }
}

export function initSentry() {
  if (initStarted) return;
  initStarted = true;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  void loadSentry().then((client) => {
    if (!client) return;
    client.init({
      dsn,
      environment: __DEV__ ? "development" : (process.env.EXPO_PUBLIC_ENVIRONMENT ?? "production"),
      release: process.env.EXPO_PUBLIC_RELEASE ?? undefined,
      dist: process.env.EXPO_PUBLIC_BUILD_NUMBER ?? undefined,
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      attachStacktrace: true,
      integrations: client.reactNativeTracingIntegration ? [client.reactNativeTracingIntegration()] : [],
      beforeSend(event: { user?: { email?: string; ip_address?: string } }) {
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }
        return event;
      },
    });
  });
}

export function setSentryUser(userId: string, displayName?: string) {
  void loadSentry().then((client) => client?.setUser({ id: userId, username: displayName }));
}

export function clearSentryUser() {
  void loadSentry().then((client) => client?.setUser(null));
}

export function isSentrySmokeEnabled(
  env: Record<string, string | undefined> = process.env,
  isDev = __DEV__,
) {
  const flag = env.EXPO_PUBLIC_ENABLE_SENTRY_SMOKE?.trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(flag ?? "")) return true;
  if (["0", "false", "no", "off", "disabled"].includes(flag ?? "")) return false;
  return isDev || env.NODE_ENV === "development";
}

export async function sendSentrySmokeTest(clientOverride?: SentryLike) {
  const client = clientOverride ?? await loadSentry();
  if (!client) return { sent: false, metricsSent: false };

  client.captureException(new Error("ConnectSphere mobile Sentry smoke test error"));
  client.captureMessage("ConnectSphere mobile Sentry smoke test");
  client.metrics?.count("connectsphere.sentry_smoke", 1, {
    unit: "event",
    attributes: { source: "settings" },
  });
  client.metrics?.gauge("connectsphere.sentry_smoke_queue_depth", 1);
  client.metrics?.distribution("connectsphere.sentry_smoke_response_time", 187.5, {
    unit: "millisecond",
  });
  await client.flush?.(2000);

  return { sent: true, metricsSent: Boolean(client.metrics) };
}

export const Sentry = {
  captureException(error: unknown, extra?: Record<string, unknown>) {
    void loadSentry().then((client) => {
      if (!client) return;
      // Pass optional extra context (e.g. componentStack from ErrorBoundary)
      if (extra) {
        (client as unknown as { captureException(e: unknown, hint: unknown): void })
          .captureException(error, { extra });
      } else {
        client.captureException(error);
      }
    });
  },
  captureMessage(message: string) {
    void loadSentry().then((client) => client?.captureMessage(message));
  },
};

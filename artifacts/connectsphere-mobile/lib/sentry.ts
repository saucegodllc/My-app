type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  setUser: (user: { id: string; username?: string } | null) => void;
  captureException: (error: unknown) => void;
  captureMessage: (message: string) => void;
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

import Stripe from "stripe";

// Price IDs are configured in Render environment variables.
// Current launch plans:
// - monthly:  $14.99 / 2 weeks
// - sixmonth: $150 / 6 months
// - yearly:   $300 / year
export const STRIPE_PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY ?? "",
  sixmonth: process.env.STRIPE_PRICE_SIXMONTH ?? "",
  yearly: process.env.STRIPE_PRICE_YEARLY ?? "",
} as const;

export type StripePlan = keyof typeof STRIPE_PRICES;

export function isStripePlan(s: unknown): s is StripePlan {
  return s === "monthly" || s === "sixmonth" || s === "yearly";
}

// Direct env-var client. Render should provide STRIPE_SECRET_KEY.
export function getDirectStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion });
}

// Returns a Stripe client regardless of hosting environment.
// Prefer Render direct key; fall back to the legacy Replit connector path.
export async function getStripeClient(): Promise<Stripe> {
  const direct = getDirectStripeClient();
  if (direct) return direct;
  return getUncachableStripeClient();
}

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data = (await response.json()) as {
    items?: Array<{ settings: { publishable: string; secret: string } }>;
  };

  const settings = data.items?.[0]?.settings;
  if (!settings?.publishable || !settings?.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: settings.publishable,
    secretKey: settings.secret,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
  });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}

export type StripeSyncInstance = {
  findOrCreateManagedWebhook: (url: string) => Promise<{ webhook: unknown }>;
  syncBackfill: () => Promise<void>;
  processWebhook: (payload: Buffer, signature: string) => Promise<void>;
};

let stripeSync: StripeSyncInstance | null = null;

export async function getStripeSync(): Promise<StripeSyncInstance> {
  if (!stripeSync) {
    const { StripeSync } = await import("stripe-replit-sync");
    const secretKey = await getStripeSecretKey();
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    }) as unknown as StripeSyncInstance;
  }
  return stripeSync;
}

import Stripe from "stripe";

// ── Price IDs ────────────────────────────────────────────────────────────────
// Create these in your Stripe dashboard (Products → Add product → Recurring)
// then paste the price_xxx IDs into your Railway env vars.
export const STRIPE_PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY ?? "", // e.g. price_1OxxxxMonthly
  yearly:  process.env.STRIPE_PRICE_YEARLY  ?? "", // e.g. price_1OxxxxYearly
} as const;

export type StripePlan = keyof typeof STRIPE_PRICES;

export function isStripePlan(s: unknown): s is StripePlan {
  return s === "monthly" || s === "yearly";
}

// ── Railway: direct env-var client ──────────────────────────────────────────
// When STRIPE_SECRET_KEY is set (Railway / any non-Replit host), use it
// directly instead of fetching from the Replit connector service.
export function getDirectStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion });
}

// Returns a Stripe client regardless of hosting environment.
// Prefer Railway direct key; fall back to Replit connector.
export async function getStripeClient(): Promise<Stripe> {
  const direct = getDirectStripeClient();
  if (direct) return direct;
  return getUncachableStripeClient(); // Replit path (defined below)
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
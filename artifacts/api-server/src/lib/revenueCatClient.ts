/**
 * RevenueCat REST API helper — used by the Stripe webhook to grant the
 * "plus" entitlement to users who subscribe via the web checkout.
 *
 * Docs: https://www.revenuecat.com/docs/api-v1#tag/Subscribers
 *
 * Required env var: REVENUECAT_API_SECRET_KEY
 * (Settings → API keys → "Secret API key" in the RevenueCat dashboard)
 */

const RC_BASE = "https://api.revenuecat.com/v1";
const RC_ENTITLEMENT = "plus"; // must match the entitlement id in RC dashboard

function rcHeaders() {
  const key = process.env.REVENUECAT_API_SECRET_KEY;
  if (!key) throw new Error("REVENUECAT_API_SECRET_KEY not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

/**
 * Grant a promotional "plus" entitlement to a RevenueCat subscriber.
 * Called after a Stripe checkout.session.completed event.
 *
 * @param appUserId  The Clerk user ID used as RevenueCat's app_user_id
 * @param durationMonths  How many months to grant (default 1 for monthly, 12 for yearly)
 */
export async function grantRevenueCatEntitlement(
  appUserId: string,
  durationMonths = 1,
): Promise<void> {
  // RevenueCat expects duration in seconds from now
  const seconds = durationMonths * 30 * 24 * 60 * 60;

  const res = await fetch(
    `${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}/entitlements/${RC_ENTITLEMENT}/promotional`,
    {
      method: "POST",
      headers: rcHeaders(),
      body: JSON.stringify({ duration: "custom", duration_in_seconds: seconds }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RevenueCat grant failed (${res.status}): ${body}`);
  }
}

/**
 * Revoke the "plus" entitlement (called when Stripe subscription is cancelled).
 */
export async function revokeRevenueCatEntitlement(appUserId: string): Promise<void> {
  const res = await fetch(
    `${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}/entitlements/${RC_ENTITLEMENT}/revoke_promotionals`,
    {
      method: "POST",
      headers: rcHeaders(),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RevenueCat revoke failed (${res.status}): ${body}`);
  }
}

/**
 * Fetch a subscriber's entitlement status.
 */
export async function getRevenueCatSubscriber(appUserId: string) {
  const res = await fetch(
    `${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: rcHeaders() },
  );
  if (!res.ok) return null;
  return res.json() as Promise<{ subscriber: { entitlements: Record<string, { expires_date: string | null }> } }>;
}

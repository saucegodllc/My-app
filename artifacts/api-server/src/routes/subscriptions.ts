import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { createOpsId, nowIso, readOpsStore, writeOpsStore, type PremiumEntitlementRecord } from "../lib/operationalStore";
import { logLaunchEvent } from "../lib/monitoring";

const router = Router();
const PLUS_ENTITLEMENT_ID = process.env.CONNECTSPHERE_PREMIUM_ENTITLEMENT_ID ?? "plus";

function entitlementFor(userId: string, profilePremium?: boolean | null): PremiumEntitlementRecord {
  const store = readOpsStore();
  const record = store.premiumEntitlements.find((item) => item.userId === userId);
  if (record) return record;
  const isPremium = profilePremium === true;
  return {
    userId,
    isPremium,
    source: isPremium ? "manual" : "none",
    tier: isPremium ? "plus" : "free",
    entitlementId: PLUS_ENTITLEMENT_ID,
    trialEligible: !isPremium,
    lastSyncedAt: nowIso(),
  };
}

async function persistEntitlement(record: PremiumEntitlementRecord) {
  const store = readOpsStore();
  const index = store.premiumEntitlements.findIndex((item) => item.userId === record.userId);
  if (index >= 0) store.premiumEntitlements[index] = record;
  else store.premiumEntitlements.push(record);
  writeOpsStore(store);

  await db
    .update(profilesTable)
    .set({ isPremium: record.isPremium, updatedAt: new Date() })
    .where(eq(profilesTable.userId, record.userId))
    .catch(() => undefined);
}

function entitlementResponse(record: PremiumEntitlementRecord) {
  return {
    isPremium: record.isPremium,
    source: record.source,
    tier: record.tier,
    entitlementId: record.entitlementId,
    productId: record.productId,
    trialEligible: record.trialEligible ?? !record.isPremium,
    renewalDate: record.renewalDate,
    managementUrl: record.managementUrl,
    restoreAvailable: true,
    gates: {
      connectAdmirers: record.isPremium,
      unlimitedShots: record.isPremium,
      unlimitedSparks: record.isPremium,
      bestieActions: record.isPremium,
      doubleDatePremium: record.isPremium,
    },
  };
}

router.get("/subscriptions/status", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  return res.json({ isPremium: profile?.isPremium ?? false });
});

router.get("/subscriptions/entitlement", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [profile] = await db
    .select({ isPremium: profilesTable.isPremium })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1)
    .catch(() => [] as Array<{ isPremium: boolean }>);

  return res.json(entitlementResponse(entitlementFor(userId, profile?.isPremium)));
});

router.post("/subscriptions/revenuecat/sync", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body as {
    appUserId?: string;
    isPremium?: boolean;
    entitlementId?: string;
    productId?: string;
    renewalDate?: string;
    managementUrl?: string;
    trialEligible?: boolean;
  };
  const isPremium = body.isPremium === true && (body.entitlementId ?? PLUS_ENTITLEMENT_ID) === PLUS_ENTITLEMENT_ID;
  const record: PremiumEntitlementRecord = {
    userId,
    isPremium,
    source: "revenuecat",
    tier: isPremium ? "plus" : "free",
    entitlementId: body.entitlementId ?? PLUS_ENTITLEMENT_ID,
    productId: body.productId,
    renewalDate: body.renewalDate,
    managementUrl: body.managementUrl,
    trialEligible: body.trialEligible ?? !isPremium,
    revenueCatAppUserId: body.appUserId ?? userId,
    lastSyncedAt: nowIso(),
  };
  await persistEntitlement(record);
  logLaunchEvent("premium_entitlement_synced", { userId, source: "revenuecat", isPremium });
  return res.json(entitlementResponse(record));
});

router.post("/subscriptions/webhook/revenuecat", async (req, res) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (secret && req.header("authorization") !== `Bearer ${secret}` && req.header("x-revenuecat-signature") !== secret) {
    return res.status(401).json({ error: "Invalid RevenueCat webhook signature" });
  }

  const event = (req.body as { event?: Record<string, unknown> })?.event ?? req.body ?? {};
  const userId = String(event.app_user_id ?? event.original_app_user_id ?? "");
  if (!userId) return res.status(202).json({ ok: true, ignored: "missing_app_user_id" });
  const entitlementIds = Array.isArray(event.entitlement_ids) ? event.entitlement_ids.map(String) : [];
  const productId = typeof event.product_id === "string" ? event.product_id : undefined;
  const expiration = typeof event.expiration_at_ms === "number" ? new Date(event.expiration_at_ms).toISOString() : undefined;
  const isPremium = entitlementIds.includes(PLUS_ENTITLEMENT_ID) && (!expiration || new Date(expiration).getTime() > Date.now());
  const record: PremiumEntitlementRecord = {
    userId,
    isPremium,
    source: "revenuecat",
    tier: isPremium ? "plus" : "free",
    entitlementId: PLUS_ENTITLEMENT_ID,
    productId,
    renewalDate: expiration,
    trialEligible: false,
    revenueCatAppUserId: userId,
    lastSyncedAt: nowIso(),
  };
  await persistEntitlement(record);
  logLaunchEvent("premium_webhook_received", { userId, source: "revenuecat", productId, isPremium, eventId: createOpsId() });
  return res.json({ ok: true });
});

router.get("/subscriptions/products", async (_req, res) => {
  return res.json({ products: [] });
});

export default router;

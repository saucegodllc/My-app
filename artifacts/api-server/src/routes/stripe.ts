/**
 * Stripe web checkout routes
 *
 * Flow:
 *   1. Mobile app opens browser → GET /api/stripe/subscribe?userId=xxx&plan=monthly
 *   2. API creates Stripe Checkout Session → browser redirects to stripe.com
 *   3. User pays on Stripe
 *   4. Stripe fires webhook → POST /api/stripe/webhook
 *   5. Webhook grants RevenueCat entitlement → user is now Premium in the app
 *   6. Success page shows "Open App" deep link
 *
 * Env vars required (set in Render):
 *   STRIPE_SECRET_KEY         sk_live_xxx or sk_test_xxx
 *   STRIPE_WEBHOOK_SECRET     whsec_xxx  (from Stripe dashboard → Webhooks)
 *   STRIPE_PRICE_MONTHLY      price_xxx
 *   STRIPE_PRICE_SIXMONTH     price_xxx
 *   STRIPE_PRICE_YEARLY       price_xxx
 *   REVENUECAT_API_SECRET_KEY  (from RC dashboard → API keys → Secret key)
 *   PUBLIC_APP_URL            https://connectsphere-api.onrender.com  (no trailing slash)
 *   APP_SCHEME                connectsphere  (matches app.json scheme)
 */

import { Router, type Request, type Response } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { getStripeClient, isStripePlan, STRIPE_PRICES } from "../lib/stripeClient";
import { grantRevenueCatEntitlement, revokeRevenueCatEntitlement } from "../lib/revenueCatClient";
import { logger } from "../lib/logger";
import { isProductionEnv } from "../launchGuards";

/** Write isPremium directly to the profiles table. This is the primary source
 *  of truth — RevenueCat is an optional signal on top. */
async function setDbPremium(clerkUserId: string, isPremium: boolean): Promise<void> {
  await db
    .update(profilesTable)
    .set({ isPremium, updatedAt: new Date() })
    .where(eq(profilesTable.userId, clerkUserId));
}

const router = Router();

const APP_URL    = process.env.PUBLIC_APP_URL ?? "https://connectsphere.app";
const APP_SCHEME = process.env.APP_SCHEME ?? "connectsphere";

// ── Success / cancel HTML pages served inline ─────────────────────────────

function successPage(name?: string) {
  const displayName = name ? `, ${name}` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>You're Premium — ConnectSphere</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      background:#0A0A0F;color:#fff;min-height:100vh;
      display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#13131A;border:1px solid rgba(255,255,255,.08);
      border-radius:24px;padding:40px 32px;max-width:420px;width:100%;text-align:center}
    .star{font-size:56px;margin-bottom:16px}
    h1{font-size:24px;font-weight:800;margin-bottom:8px}
    p{color:#A1A1AA;font-size:15px;line-height:1.6;margin-bottom:28px}
    .btn{display:inline-block;background:linear-gradient(135deg,#FF2DA8,#BE185D);
      color:#fff;font-size:16px;font-weight:700;text-decoration:none;
      padding:14px 32px;border-radius:28px;margin-bottom:12px}
    .small{color:#52525B;font-size:12px}
    .perks{text-align:left;margin-bottom:28px}
    .perk{display:flex;align-items:center;gap:10px;padding:8px 0;
      border-bottom:1px solid rgba(255,255,255,.06);font-size:14px;color:#E4E4E7}
    .perk:last-child{border-bottom:none}
    .check{color:#FF2DA8;font-size:18px;flex-shrink:0}
  </style>
</head>
<body>
  <div class="card">
    <div class="star">⭐</div>
    <h1>Welcome to Plus${displayName}!</h1>
    <p>Your premium access is active. Open the app to start using all your new features.</p>
    <div class="perks">
      <div class="perk"><span class="check">✓</span>Unlimited swipes</div>
      <div class="perk"><span class="check">✓</span>Rewind last swipe</div>
      <div class="perk"><span class="check">✓</span>More Sparks &amp; Shots</div>
      <div class="perk"><span class="check">✓</span>See who liked you</div>
    </div>
    <a class="btn" href="${APP_SCHEME}://premium-success">Open ConnectSphere →</a><br/>
    <span class="small">If the app doesn't open, make sure it's installed first.</span>
  </div>
</body>
</html>`;
}

function cancelPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment cancelled — ConnectSphere</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      background:#0A0A0F;color:#fff;min-height:100vh;
      display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#13131A;border:1px solid rgba(255,255,255,.08);
      border-radius:24px;padding:40px 32px;max-width:420px;width:100%;text-align:center}
    .icon{font-size:48px;margin-bottom:16px}
    h1{font-size:22px;font-weight:700;margin-bottom:8px}
    p{color:#A1A1AA;font-size:15px;line-height:1.6;margin-bottom:28px}
    .btn{display:inline-block;background:linear-gradient(135deg,#FF2DA8,#BE185D);
      color:#fff;font-size:16px;font-weight:700;text-decoration:none;
      padding:14px 32px;border-radius:28px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">↩️</div>
    <h1>No worries</h1>
    <p>Your payment was cancelled. You can try again anytime from the app.</p>
    <a class="btn" href="${APP_SCHEME}://premium">Back to app</a>
  </div>
</body>
</html>`;
}

// ── GET /stripe/subscribe ─────────────────────────────────────────────────
// Opens from mobile via Linking.openURL — creates checkout session and redirects.

router.get("/stripe/subscribe", async (req: Request, res: Response) => {
  const { userId, plan = "monthly" } = req.query as { userId?: string; plan?: string };

  if (!userId) {
    res.status(400).send("Missing userId");
    return;
  }
  if (!isStripePlan(plan)) {
    res.status(400).send("Invalid plan. Use monthly or yearly.");
    return;
  }

  const priceId = STRIPE_PRICES[plan];
  if (!priceId) {
    res.status(503).send(`STRIPE_PRICE_${plan.toUpperCase()} env var not configured.`);
    return;
  }

  let stripe: Stripe;
  try {
    stripe = await getStripeClient();
  } catch {
    res.status(503).send("Stripe not configured on this server.");
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      // client_reference_id lets us identify the user in the webhook
      client_reference_id: userId,
      // pre-populate customer email from Clerk if available (optional)
      success_url: `${APP_URL}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/api/stripe/cancel`,
      subscription_data: {
        metadata: { clerkUserId: userId },
      },
      metadata: { clerkUserId: userId, plan },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      res.status(500).send("Failed to create checkout session URL.");
      return;
    }

    res.redirect(303, session.url);
  } catch (err) {
    logger.error({ err }, "stripe create-checkout-session failed");
    res.status(500).send("Could not start checkout. Please try again.");
  }
});

// ── GET /stripe/success ───────────────────────────────────────────────────
// Stripe redirects here after a successful payment.

router.get("/stripe/success", async (req: Request, res: Response) => {
  const { session_id } = req.query as { session_id?: string };

  let customerName: string | undefined;

  if (session_id) {
    try {
      const stripe = await getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["customer"],
      });
      const customer = session.customer as Stripe.Customer | null;
      customerName = customer?.name ?? undefined;
    } catch {
      // non-fatal — page still renders
    }
  }

  res.setHeader("Content-Type", "text/html");
  res.send(successPage(customerName));
});

// ── GET /stripe/cancel ────────────────────────────────────────────────────

router.get("/stripe/cancel", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(cancelPage());
});

// ── GET /stripe/portal ────────────────────────────────────────────────────
// Lets a user manage or cancel their Stripe subscription.
// Called from the app: Linking.openURL(`{API_URL}/api/stripe/portal?userId=xxx`)

router.get("/stripe/portal", async (req: Request, res: Response) => {
  const { userId } = req.query as { userId?: string };
  if (!userId) { res.status(400).send("Missing userId"); return; }

  let stripe: Stripe;
  try {
    stripe = await getStripeClient();
  } catch {
    res.status(503).send("Stripe not configured.");
    return;
  }

  try {
    // Find the Stripe customer linked to this Clerk user
    const customers = await stripe.customers.search({
      query: `metadata["clerkUserId"]:"${userId}"`,
      limit: 1,
    });

    if (!customers.data.length) {
      // No Stripe customer yet — they haven't subscribed via web
      res.redirect(303, `${APP_URL}/api/stripe/subscribe?userId=${userId}&plan=monthly`);
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${APP_SCHEME}://settings`,
    });

    res.redirect(303, session.url);
  } catch (err) {
    logger.error({ err }, "stripe portal failed");
    res.status(500).send("Could not open billing portal. Please try again.");
  }
});

// ── POST /stripe/webhook ──────────────────────────────────────────────────
// Raw body required — JSON parsing is skipped for this route in routes/index.ts

router.post("/stripe/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // A webhook secret is mandatory in production. Without it we cannot prove a
  // request actually came from Stripe, and an attacker could forge a
  // `checkout.session.completed` event to grant themselves premium. Refuse to
  // process the webhook rather than trust an unverified payload.
  if (!webhookSecret && isProductionEnv()) {
    logger.error("STRIPE_WEBHOOK_SECRET is not set in production — rejecting webhook");
    res.status(500).json({ error: "Webhook not configured" });
    return;
  }

  let stripe: Stripe;
  try {
    stripe = await getStripeClient();
  } catch {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  let event: Stripe.Event;

  try {
    const rawBody = req.body as Buffer;
    if (webhookSecret) {
      // Signature verification is required whenever a secret is configured.
      // `constructEvent` throws if the signature header is missing or invalid,
      // so a request that simply omits `stripe-signature` is rejected below —
      // it can NOT fall through to the unverified branch.
      if (!sig) {
        logger.warn("stripe webhook missing stripe-signature header");
        res.status(400).json({ error: "Missing signature" });
        return;
      }
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // Only reachable outside production (guarded above). Local dev without a
      // configured webhook secret: accept the payload without verification.
      logger.warn("STRIPE_WEBHOOK_SECRET not set — accepting webhook without verification (dev only)");
      event = JSON.parse(rawBody.toString()) as Stripe.Event;
    }
  } catch (err) {
    logger.warn({ err }, "stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  logger.info({ type: event.type }, "stripe webhook received");

  try {
    switch (event.type) {
      // ── Subscription created / renewed ──────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const clerkUserId = session.client_reference_id
          ?? session.metadata?.clerkUserId;

        if (!clerkUserId) {
          logger.warn({ sessionId: session.id }, "checkout.session.completed: no clerkUserId");
          break;
        }

        // Tag the Stripe customer with the Clerk user ID for portal lookups
        if (session.customer) {
          await stripe.customers.update(session.customer as string, {
            metadata: { clerkUserId },
          }).catch((err) => logger.warn({ err }, "failed to tag stripe customer"));
        }

        const plan = (session.metadata?.plan ?? "monthly") as "monthly" | "sixmonth" | "yearly";
        const months = plan === "yearly" ? 12 : plan === "sixmonth" ? 6 : 1;

        // 1. Write to DB — primary source of truth, works without RevenueCat
        await setDbPremium(clerkUserId, true);
        logger.info({ clerkUserId, plan }, "stripe: set isPremium=true in DB");

        // 2. Also grant RevenueCat entitlement if configured (enables native IAP UI)
        await grantRevenueCatEntitlement(clerkUserId, months).catch((err) =>
          logger.warn({ err, clerkUserId }, "stripe: RC grant failed (non-fatal — DB already updated)"),
        );
        break;
      }

      // ── Subscription renewed (monthly/yearly billing cycle) ─────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only act on subscription invoices (not one-offs)
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string,
        );
        const clerkUserId = subscription.metadata?.clerkUserId;
        if (!clerkUserId) break;

        const interval = subscription.items.data[0]?.price.recurring?.interval;
        const intervalCount = subscription.items.data[0]?.price.recurring?.interval_count ?? 1;
        const plan = interval === "year" ? "yearly" : (interval === "month" && intervalCount === 6) ? "sixmonth" : "monthly";
        const months = plan === "yearly" ? 12 : plan === "sixmonth" ? 6 : 1;

        // 1. DB update
        await setDbPremium(clerkUserId, true);
        logger.info({ clerkUserId }, "stripe: renewed isPremium=true in DB");

        // 2. RC (optional)
        await grantRevenueCatEntitlement(clerkUserId, months).catch((err) =>
          logger.warn({ err, clerkUserId }, "stripe: RC renewal grant failed (non-fatal)"),
        );
        break;
      }

      // ── Subscription cancelled / payment failed ─────────────────────────
      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const obj = event.data.object as Stripe.Subscription | Stripe.Invoice;
        const subId = "id" in obj && "metadata" in obj
          ? obj.id                                       // Subscription object
          : (obj as Stripe.Invoice).subscription as string; // Invoice object

        if (!subId) break;

        const subscription = await stripe.subscriptions.retrieve(subId).catch(() => null);
        const clerkUserId = subscription?.metadata?.clerkUserId;
        if (!clerkUserId) break;

        // 1. DB update — revoke premium
        await setDbPremium(clerkUserId, false);
        logger.info({ clerkUserId }, "stripe: set isPremium=false in DB");

        // 2. RC (optional)
        await revokeRevenueCatEntitlement(clerkUserId).catch((err) =>
          logger.warn({ err, clerkUserId }, "stripe: RC revoke failed (non-fatal)"),
        );
        break;
      }

      default:
        // Unhandled event — log and acknowledge
        logger.info({ type: event.type }, "stripe webhook: unhandled event type");
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "stripe webhook handler error");
    // Still return 200 — if we return 4xx/5xx Stripe will retry
  }

  res.json({ received: true });
});

export default router;

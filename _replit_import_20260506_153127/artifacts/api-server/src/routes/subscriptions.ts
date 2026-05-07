import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { CreateCheckoutSessionBody } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient";

const router = Router();

router.get("/subscriptions/status", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile?.stripeSubscriptionId) {
    return res.json({ isPremium: profile?.isPremium ?? false });
  }

  try {
    const stripe = await getUncachableStripeClient();
    const subscription = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId) as unknown as {
      status: string;
      cancel_at_period_end: boolean;
      current_period_end: number;
      items: { data: Array<{ plan: { interval: string } }> };
    };
    const isActive = subscription.status === "active" || subscription.status === "trialing";

    if (profile.isPremium !== isActive) {
      await db.update(profilesTable).set({ isPremium: isActive }).where(eq(profilesTable.userId, userId));
    }

    return res.json({
      isPremium: isActive,
      plan: subscription.items.data[0]?.plan.interval,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch {
    return res.json({ isPremium: profile.isPremium });
  }
});

router.post("/subscriptions/checkout", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = CreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

  const { priceId, successUrl, cancelUrl } = parsed.data;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const stripe = await getUncachableStripeClient();

  let customerId = profile?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { userId },
    });
    customerId = customer.id;
    if (profile) {
      await db
        .update(profilesTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(profilesTable.userId, userId));
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return res.json({ url: session.url });
});

router.post("/subscriptions/portal", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile?.stripeCustomerId) {
    return res.status(400).json({ error: "No subscription found" });
  }

  const stripe = await getUncachableStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: (req.body as { returnUrl?: string })?.returnUrl ?? req.headers.referer ?? "",
  });

  return res.json({ url: session.url });
});

router.get("/subscriptions/products", async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const productsResult = await stripe.products.list({ active: true, limit: 10, expand: ["data.default_price"] });

    const result = await Promise.all(
      productsResult.data.map(async (product) => {
        const prices = await stripe.prices.list({ product: product.id, active: true });
        return {
          id: product.id,
          name: product.name,
          description: product.description ?? "",
          prices: prices.data.map((p) => ({
            id: p.id,
            unitAmount: p.unit_amount ?? 0,
            currency: p.currency,
            interval: p.recurring?.interval ?? null,
            intervalCount: p.recurring?.interval_count ?? null,
          })),
        };
      })
    );
    return res.json({ products: result });
  } catch (err) {
    console.error("Failed to fetch products:", err);
    return res.json({ products: [] });
  }
});

router.get("/subscriptions/publishable-key", async (_req, res) => {
  const key = await getStripePublishableKey();
  return res.json({ publishableKey: key });
});

export default router;

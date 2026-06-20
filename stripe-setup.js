/**
 * ConnectSphere one-time Stripe product setup
 *
 * Creates:
 *   - ConnectSphere Plus product
 *   - Biweekly recurring price: $14.99 every 2 weeks
 *   - 6-month recurring price: $150.00 every 6 months
 *   - Yearly recurring price: $300.00 per year
 *
 * Usage, without pasting secret keys in chat:
 *   PowerShell: .\scripts\run-stripe-setup.ps1
 *   Git Bash:   bash scripts/run-stripe-setup.sh
 *
 * Advanced local-only option:
 *   STRIPE_SECRET_KEY=sk_live_xxx node stripe-setup.js
 */

const Stripe = require("stripe");

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY env var is not set.");
  console.error("PowerShell: .\\scripts\\run-stripe-setup.ps1");
  console.error("Git Bash:   bash scripts/run-stripe-setup.sh");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });

async function main() {
  console.log("\nConnectSphere Stripe setup\n");

  console.log("Creating product: ConnectSphere Plus...");
  const product = await stripe.products.create({
    name: "ConnectSphere Plus",
    description:
      "Unlimited swipes, Rewind, extra Sparks and Shots, Daily Boost, " +
      "Reveal who liked you, Best Friend sends, AI Spark, and exclusive restaurant and retailer deals.",
    metadata: {
      app: "connectsphere",
      tier: "plus",
    },
    marketing_features: [
      { name: "Unlimited swipes" },
      { name: "Rewind your last swipe" },
      { name: "More Sparks and Shots" },
      { name: "Daily Profile Boost" },
      { name: "More Best Friend sends" },
      { name: "Reveal Reactions" },
      { name: "AI Spark unlimited chats" },
      { name: "Exclusive restaurant and retailer deals" },
    ],
  });
  console.log(`Product created: ${product.id} (${product.name})\n`);

  console.log("Creating price: $14.99 every 2 weeks...");
  const monthly = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 1499,
    recurring: {
      interval: "week",
      interval_count: 2,
    },
    nickname: "Plus Biweekly",
    metadata: { plan: "monthly" },
  });
  console.log(`Biweekly price: ${monthly.id} ($14.99 every 2 weeks)\n`);

  console.log("Creating price: $150.00 every 6 months...");
  const sixmonth = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 15000,
    recurring: {
      interval: "month",
      interval_count: 6,
    },
    nickname: "Plus 6 Months",
    metadata: { plan: "sixmonth" },
  });
  console.log(`6-month price: ${sixmonth.id} ($150 / 6 months)\n`);

  console.log("Creating price: $300.00 per year...");
  const yearly = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 30000,
    recurring: {
      interval: "year",
      interval_count: 1,
    },
    nickname: "Plus Yearly",
    metadata: { plan: "yearly" },
  });
  console.log(`Yearly price: ${yearly.id} ($300 / year)\n`);

  await stripe.products.update(product.id, {
    default_price: yearly.id,
  });

  console.log("Configuring customer portal...");
  try {
    await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "Manage your ConnectSphere Plus subscription",
      },
      features: {
        subscription_cancel: { enabled: true, mode: "at_period_end" },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          proration_behavior: "create_prorations",
          products: [
            {
              product: product.id,
              prices: [monthly.id, sixmonth.id, yearly.id],
            },
          ],
        },
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
      },
    });
    console.log("Customer portal configured\n");
  } catch (err) {
    console.warn("Customer portal config skipped, possibly already exists:", err.message);
  }

  console.log("=".repeat(56));
  console.log("Setup complete. Add these to Render -> Environment:\n");
  console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
  console.log(`STRIPE_PRICE_SIXMONTH=${sixmonth.id}`);
  console.log(`STRIPE_PRICE_YEARLY=${yearly.id}`);
  console.log("\nStripe Dashboard product:");
  console.log(`https://dashboard.stripe.com/products/${product.id}`);
  console.log("=".repeat(56));
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  if (err.type === "StripeAuthenticationError") {
    console.error("Your STRIPE_SECRET_KEY looks wrong. Check the key in Stripe Dashboard.");
  }
  process.exit(1);
});

import Stripe from "stripe";

async function getStripeSecretKey(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit connector environment variables. Run this script in the Replit environment."
    );
  }

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", "development");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data = (await response.json()) as {
    items?: Array<{ settings: { secret: string } }>;
  };

  const secretKey = data.items?.[0]?.settings?.secret;
  if (!secretKey) {
    throw new Error("Stripe development connection not found or missing secret key.");
  }

  return secretKey;
}

async function seedStripeProducts() {
  console.log("Fetching Stripe credentials...");
  const secretKey = await getStripeSecretKey();

  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
  });

  console.log("Checking for existing ConnectSphere products...");
  const existing = await stripe.products.list({ active: true, limit: 100 });
  const existingProduct = existing.data.find(
    (p) => p.metadata?.app === "connectsphere"
  );

  if (existingProduct) {
    console.log(`\nProduct already exists: ${existingProduct.name} (${existingProduct.id})`);
    const prices = await stripe.prices.list({ product: existingProduct.id, active: true });

    const hasMonthly = prices.data.some(
      (p) => p.recurring?.interval === "month" && p.unit_amount === 999
    );
    const hasAnnual = prices.data.some(
      (p) => p.recurring?.interval === "year" && p.unit_amount === 7999
    );

    if (!hasMonthly) {
      console.log("Missing monthly price — creating...");
      const monthlyPrice = await stripe.prices.create({
        product: existingProduct.id,
        unit_amount: 999,
        currency: "usd",
        recurring: { interval: "month" },
        nickname: "Monthly",
        metadata: { plan: "monthly" },
      });
      console.log(`Created monthly price: ${monthlyPrice.id}`);
    } else {
      console.log("Monthly price OK");
    }

    if (!hasAnnual) {
      console.log("Missing annual price — creating...");
      const annualPrice = await stripe.prices.create({
        product: existingProduct.id,
        unit_amount: 7999,
        currency: "usd",
        recurring: { interval: "year" },
        nickname: "Annual",
        metadata: { plan: "annual" },
      });
      console.log(`Created annual price: ${annualPrice.id}`);
    } else {
      console.log("Annual price OK");
    }

    const finalPrices = await stripe.prices.list({ product: existingProduct.id, active: true });
    console.log("\nFinal prices:");
    for (const price of finalPrices.data) {
      const amount = (price.unit_amount ?? 0) / 100;
      const interval = price.recurring?.interval ?? "one-time";
      console.log(`  - ${price.nickname ?? price.id}: $${amount} / ${interval} (${price.id})`);
    }
    return;
  }

  console.log("Creating ConnectSphere Premium product...");
  const product = await stripe.products.create({
    name: "ConnectSphere Premium",
    description:
      "Unlock unlimited likes, see who liked you, boost visibility, and more.",
    metadata: { app: "connectsphere" },
  });
  console.log(`Created product: ${product.id}`);

  console.log("Creating monthly price ($9.99/month)...");
  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 999,
    currency: "usd",
    recurring: { interval: "month" },
    nickname: "Monthly",
    metadata: { plan: "monthly" },
  });
  console.log(`Created monthly price: ${monthlyPrice.id}`);

  console.log("Creating annual price ($79.99/year)...");
  const annualPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 7999,
    currency: "usd",
    recurring: { interval: "year" },
    nickname: "Annual",
    metadata: { plan: "annual" },
  });
  console.log(`Created annual price: ${annualPrice.id}`);

  await stripe.products.update(product.id, { default_price: monthlyPrice.id });

  console.log("\nSeed complete!");
  console.log(`  Product:        ${product.name} (${product.id})`);
  console.log(`  Monthly price:  $9.99/month (${monthlyPrice.id})`);
  console.log(`  Annual price:   $79.99/year (${annualPrice.id})`);
}

seedStripeProducts().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

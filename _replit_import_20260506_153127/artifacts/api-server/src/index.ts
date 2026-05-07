import { createServer } from "http";
import express from "express";
import app from "./app";
import { setupSocketIO } from "./socket";
import { logger } from "./lib/logger";
import { getStripeSync } from "./lib/stripeClient";
import { runMigrations } from "stripe-replit-sync";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing signature" });
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      const stripeSync = await getStripeSync();
      await stripeSync.processWebhook(req.body as Buffer, sig);
      return res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook error");
      return res.status(400).json({ error: "Webhook error" });
    }
  }
);

async function runLivenessMigrations() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS liveness_nonces (
        id                VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        nonce             VARCHAR(36) NOT NULL UNIQUE,
        user_id           VARCHAR(255) NOT NULL,
        expires_at        TIMESTAMPTZ NOT NULL,
        used              BOOLEAN NOT NULL DEFAULT FALSE,
        ticked_challenges JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS liveness_attempts (
        user_id      VARCHAR(255) PRIMARY KEY,
        count        INTEGER NOT NULL DEFAULT 0,
        window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE liveness_nonces
        ADD COLUMN IF NOT EXISTS ticked_challenges JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    logger.info("Liveness tables ready");
  } catch (err) {
    logger.warn({ err }, "Liveness migration warning (non-fatal if tables already exist)");
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set, skipping Stripe initialization");
    return;
  }
  try {
    await runMigrations({ databaseUrl });
    const stripeSync = await getStripeSync();
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    await stripeSync.syncBackfill();
    logger.info("Stripe initialized successfully");
  } catch (err) {
    logger.warn({ err }, "Stripe initialization failed (non-fatal)");
  }
}

const httpServer = createServer(app);
setupSocketIO(httpServer);

httpServer.listen(port, async (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  await runLivenessMigrations();
  await initStripe();
});

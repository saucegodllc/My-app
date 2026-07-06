import { createServer } from "http";
import app from "./app";
import { setupSocketIO } from "./socket";
import { logger } from "./lib/logger";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { startEventsBackgroundRefresh } from "./routes/events";
import { restoreSocialStore, startSocialStoreBackup } from "./lib/socialStorePersistence";
import { assertProductionLaunchSafety, shouldUseLocalDbFallback } from "./launchGuards";

const rawPort = process.env["PORT"];

assertProductionLaunchSafety();

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

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

const httpServer = createServer(app);
setupSocketIO(httpServer);

httpServer.listen(port, async (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  // Start Ticketmaster 24h background refresh immediately
  startEventsBackgroundRefresh();

  if (shouldUseLocalDbFallback()) {
    logger.warn("DATABASE_URL not set; running JSON-backed routes without Postgres startup tasks");
    return;
  }
  // Restore db.json (plans, interests, push tokens…) from its Postgres
  // snapshot before anything mutates it — Render's disk is wiped on deploy.
  await restoreSocialStore();
  startSocialStoreBackup();
  await runLivenessMigrations();
});

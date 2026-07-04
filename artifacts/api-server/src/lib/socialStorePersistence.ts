/**
 * socialStorePersistence — keeps the JSON social store (db.json) alive across
 * deploys and restarts.
 *
 * Problem: routes (friends, dating, events, notifications, …) read/write
 * db.json synchronously on Render's EPHEMERAL disk. Every deploy or restart
 * wiped users' plans, plan members, event interests, and push tokens.
 *
 * Fix (no route changes required):
 *   1. On boot   → if db.json is missing/empty and Postgres has a snapshot,
 *                  restore the file from the `social_store` table.
 *   2. Every 30s → if the file changed since the last snapshot, upsert it
 *                  into Postgres (cheap string compare, no-op when idle).
 *   3. On SIGTERM/SIGINT (Render sends SIGTERM before replacing the instance)
 *                  → final synchronous-ish flush so the loss window is ~0.
 *
 * The table is created with CREATE TABLE IF NOT EXISTS so this works even
 * before `drizzle-kit push` has run (it is also in lib/db schema for push).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { socialStoreTable } from "@workspace/db/schema";
import { logger } from "./logger";

const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const dbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");

const STORE_ID = "main";
const BACKUP_INTERVAL_MS = Number(process.env.SOCIAL_STORE_BACKUP_INTERVAL_MS ?? 30_000);

let _lastBackedUp: string | null = null;
let _timer: NodeJS.Timeout | null = null;

function readFileRaw(): string | null {
  try {
    if (!existsSync(dbPath)) return null;
    const raw = readFileSync(dbPath, "utf-8").trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/** Treat "{}" / "{}\n" as empty so a fresh boot still restores. */
function fileHasData(raw: string | null): raw is string {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(parsed).length > 0;
  } catch {
    return false;
  }
}

async function ensureTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS social_store (
      id         TEXT PRIMARY KEY,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Restore db.json from Postgres if the local file is missing or empty.
 * Call once at startup, before traffic mutates the file.
 */
export async function restoreSocialStore(): Promise<void> {
  try {
    await ensureTable();
    const local = readFileRaw();
    if (fileHasData(local)) {
      // Local file survived (dev machine / warm restart) — it is the source
      // of truth. Snapshot it so Postgres is at least as fresh.
      await backupNow(local);
      logger.info("[socialStore] Local db.json present; snapshot refreshed");
      return;
    }
    const rows = await db.select().from(socialStoreTable).where(eq(socialStoreTable.id, STORE_ID)).limit(1);
    const snapshot = rows[0]?.data;
    if (!snapshot) {
      logger.info("[socialStore] No Postgres snapshot yet; starting fresh");
      return;
    }
    const json = `${JSON.stringify(snapshot, null, 2)}\n`;
    mkdirSync(dirname(dbPath), { recursive: true });
    writeFileSync(dbPath, json);
    _lastBackedUp = json;
    logger.info("[socialStore] Restored db.json from Postgres snapshot");
  } catch (err) {
    logger.warn({ err }, "[socialStore] Restore failed (non-fatal; JSON routes still work)");
  }
}

async function backupNow(raw?: string | null): Promise<void> {
  const current = raw ?? readFileRaw();
  if (!fileHasData(current)) return;
  if (current === _lastBackedUp) return; // unchanged — skip
  const data = JSON.parse(current) as Record<string, unknown>;
  await db
    .insert(socialStoreTable)
    .values({ id: STORE_ID, data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: socialStoreTable.id,
      set: { data, updatedAt: new Date() },
    });
  _lastBackedUp = current;
}

/**
 * Start the periodic backup loop + shutdown flush.
 * Call once at startup (after restoreSocialStore).
 */
export function startSocialStoreBackup(): void {
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => {
    void backupNow().catch((err) => {
      logger.warn({ err }, "[socialStore] Periodic backup failed");
    });
  }, BACKUP_INTERVAL_MS);
  // Don't hold the event loop open just for backups.
  _timer.unref();

  const flushAndExit = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "[socialStore] Shutdown flush");
    backupNow()
      .catch((err) => logger.warn({ err }, "[socialStore] Shutdown flush failed"))
      .finally(() => process.exit(0));
  };
  process.once("SIGTERM", flushAndExit);
  process.once("SIGINT", flushAndExit);

  logger.info(`[socialStore] Backup loop started (every ${Math.round(BACKUP_INTERVAL_MS / 1000)}s)`);
}

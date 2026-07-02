import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Durable backup of the api-server's JSON social store (db.json: plans,
 * plan members, join requests, event interests, push tokens, messages…).
 *
 * Render's disk is ephemeral — every deploy/restart wipes db.json. The API
 * snapshots the file into this table (see api-server/src/lib/socialStorePersistence.ts)
 * and restores it on boot, so social data survives deploys.
 *
 * Single-row table: id is always "main".
 */
export const socialStoreTable = pgTable("social_store", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SocialStoreRow = typeof socialStoreTable.$inferSelect;

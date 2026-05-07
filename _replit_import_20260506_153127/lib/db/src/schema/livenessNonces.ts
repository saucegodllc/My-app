import { pgTable, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const livenessNoncesTable = pgTable("liveness_nonces", {
  id:               varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nonce:            varchar("nonce", { length: 36 }).notNull().unique(),
  userId:           varchar("user_id", { length: 255 }).notNull(),
  expiresAt:        timestamp("expires_at", { withTimezone: true }).notNull(),
  used:             boolean("used").notNull().default(false),
  // JSON array of challenge indices that have been ticked (to prevent double-tick)
  tickedChallenges: jsonb("ticked_challenges").notNull().default(sql`'[]'::jsonb`),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const livenessAttemptsTable = pgTable("liveness_attempts", {
  userId:      varchar("user_id", { length: 255 }).primaryKey(),
  count:       integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

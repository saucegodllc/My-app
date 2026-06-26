import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const discoveryActionUsageTable = pgTable(
  "discovery_action_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    dateKey: text("date_key").notNull(),
    actionBucket: text("action_bucket").notNull(),
    count: integer("count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("discovery_action_usage_user_date_bucket_idx").on(
      table.userId,
      table.dateKey,
      table.actionBucket,
    ),
  ],
);

export const insertDiscoveryActionUsageSchema = createInsertSchema(discoveryActionUsageTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertDiscoveryActionUsage = z.infer<typeof insertDiscoveryActionUsageSchema>;
export type DiscoveryActionUsage = typeof discoveryActionUsageTable.$inferSelect;

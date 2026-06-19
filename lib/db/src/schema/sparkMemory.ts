import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const sparkMemoryTable = pgTable("spark_memory", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SparkMemory = typeof sparkMemoryTable.$inferSelect;

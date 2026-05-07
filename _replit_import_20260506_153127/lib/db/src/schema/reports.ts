import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportsTable = pgTable("reports", {
  id: text("id").primaryKey(),
  reporterUserId: text("reporter_user_id").notNull(),
  reportedUserId: text("reported_user_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  isReviewed: boolean("is_reviewed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blocksTable = pgTable("blocks", {
  id: text("id").primaryKey(),
  blockerUserId: text("blocker_user_id").notNull(),
  blockedUserId: text("blocked_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;

export const insertBlockSchema = createInsertSchema(blocksTable).omit({ createdAt: true });
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocksTable.$inferSelect;

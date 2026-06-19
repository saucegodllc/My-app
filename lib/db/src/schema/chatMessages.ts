import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { matchesTable } from "./matches";

export const messagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  matchId: text("match_id")
    .notNull()
    .references(() => matchesTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});

export type ChatMessage = typeof messagesTable.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

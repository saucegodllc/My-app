import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    token: text("token").notNull(),
    platform: text("platform"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userTokenIdx: uniqueIndex("push_tokens_user_token_idx").on(table.userId, table.token),
  }),
);

export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokens.$inferSelect;

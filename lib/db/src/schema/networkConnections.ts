import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const networkConnectionsTable = pgTable(
  "network_connections",
  {
    id: text("id").primaryKey(),
    requesterId: text("requester_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("network_connections_pair_idx").on(table.requesterId, table.recipientId),
  ]
);

export type NetworkConnection = typeof networkConnectionsTable.$inferSelect;

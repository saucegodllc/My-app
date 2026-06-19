import { pgTable, text, timestamp, real, uniqueIndex } from "drizzle-orm/pg-core";

export const savedVenuesTable = pgTable(
  "user_saved_venues",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    placeId: text("place_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    address: text("address").notNull().default(""),
    photoUrl: text("photo_url").notNull().default(""),
    priceTier: text("price_tier").notNull().default("$$"),
    latitude: real("latitude").notNull().default(0),
    longitude: real("longitude").notNull().default(0),
    rating: real("rating"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("saved_venues_user_place_idx").on(table.userId, table.placeId)]
);

export type SavedVenue = typeof savedVenuesTable.$inferSelect;

import { pgTable, text, integer, boolean, timestamp, json, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  birthDate: text("birth_date"),
  gender: text("gender"),
  location: text("location"),
  country: text("country"),
  intent: text("intent").notNull().default("all"),
  interests: json("interests").$type<string[]>().default([]),
  languages: json("languages").$type<string[]>().default([]),
  photos: json("photos").$type<string[]>().default([]),
  role: text("role"),
  profession: text("profession"),
  // Connection subtype selected during onboarding (e.g. "1-on-1", "Activity Partner", "Find a Mentor")
  connectionSubtype: text("connection_subtype"),
  // Mode-switcher: dating/networking/friends specific responses
  modeData: jsonb("mode_data").$type<Record<string, unknown>>().default({}),
  // Fuzzy location (±500m jitter applied client-side before save)
  latitude: real("latitude"),
  longitude: real("longitude"),
  // 'hidden' | 'fuzzy' | 'active'
  locationVisibility: text("location_visibility").notNull().default("fuzzy"),
  // Miami Community Code acceptance audit timestamp
  communityCodeAcceptedAt: timestamp("community_code_accepted_at"),
  isPremium: boolean("is_premium").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  profileViews: integer("profile_views").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;

import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  theme: text("theme").notNull().default("system"),
  glass: text("glass").notNull().default("standard"),
  wallpaper: text("wallpaper").notNull().default("mountain"),
  wallpaperOrder: text("wallpaper_order").notNull().default("[]"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customWallpapers = sqliteTable(
  "custom_wallpapers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    objectKey: text("object_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_custom_wallpapers_user_id").on(table.userId)],
);

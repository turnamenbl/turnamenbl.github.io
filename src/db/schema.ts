import {
  pgTable,
  varchar,
  text,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Local settings table (single row) that stores Supabase credentials.
// All actual tournament/player/match data lives in Supabase.
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  supabaseUrl: text("supabase_url"),
  supabaseAnonKey: text("supabase_anon_key"),
  updatedAt: varchar("updated_at", { length: 40 }),
});

// NOTE: tournaments, players, matches now live in Supabase.
// The SQL to create those tables in Supabase is displayed in the admin panel.

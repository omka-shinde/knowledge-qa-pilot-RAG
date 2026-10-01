import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

/**
 * Drizzle Kit config for knowledge-base migrations.
 * Loads DATABASE_URL from `.env.local` when present.
 */
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});

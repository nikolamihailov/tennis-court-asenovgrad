import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local; plain `dotenv/config` only reads .env. Load both so the CLI
// and the app agree on the connection string. dotenv does not overwrite already-set
// variables, so .env.local wins and real environment variables (CI, Vercel) win over both.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * Config for the Prisma CLI (migrate / db / studio / seed) only.
 *
 * The URL here is deliberately the *direct*, unpooled connection: migrations take
 * advisory locks and create a shadow database, and neither survives a transaction
 * pooler like Neon's pgbouncer endpoint. The application runtime is separate — it
 * builds its client from the pooled DATABASE_URL in src/lib/db.ts.
 *
 * `shadowDatabaseUrl` is intentionally not set. Prisma treats that database as
 * disposable and resets it; letting Prisma create and drop its own shadow database on
 * the direct connection is both safer and what Neon supports.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // DATABASE_URL_UNPOOLED is what Neon's Vercel integration injects for the direct
    // connection, so it is picked up automatically and DIRECT_URL only has to be set
    // by hand on other hosts. DATABASE_URL is the last resort: it works for a plain
    // local Postgres, which has no pooler to be defeated by.
    url:
      process.env["DIRECT_URL"] ??
      process.env["DATABASE_URL_UNPOOLED"] ??
      process.env["DATABASE_URL"],
  },
});

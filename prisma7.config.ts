import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

import { requireMigrationUrl } from "./prisma/database-url";

// Next.js reads .env.local; plain `dotenv/config` only reads .env. Load both so the CLI
// and the app agree on the connection string. dotenv does not overwrite already-set
// variables, so .env.local wins and real environment variables (CI, Vercel) win over both.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * Config for the Prisma CLI (migrate / db / studio / seed) only.
 *
 * The URL is resolved to the *direct*, unpooled endpoint — see prisma/database-url.ts for
 * why a pooled connection cannot run migrations. The application runtime is separate: it
 * uses the pooled DATABASE_URL via src/lib/db.ts, which is the right choice there.
 *
 * `shadowDatabaseUrl` is intentionally not set. Prisma treats that database as disposable
 * and resets it; letting Prisma create and drop its own shadow database on the direct
 * connection is both safer and what Neon supports.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: requireMigrationUrl(),
  },
});

/**
 * Works out which connection string Prisma Migrate should use.
 *
 * Migrations take a session-level advisory lock. Neon's pooled endpoint runs pgbouncer
 * in transaction mode, where such a lock cannot be held, so `migrate deploy` against it
 * fails with `P1002: Timed out trying to acquire a postgres advisory lock` — reliably,
 * not intermittently. Migrations must go through the direct endpoint.
 *
 * Finding that endpoint is fiddly because Vercel's Neon integration lets you prefix the
 * variables it injects, so the unpooled URL can arrive as DATABASE_URL_UNPOOLED,
 * POSTGRES_URL_NON_POOLING, or those names with a prefix bolted on. Rather than guess,
 * this looks for an explicit DIRECT_URL, then any variable whose name marks it as the
 * unpooled one, and finally falls back to the pooled URL with the pooler host rewritten.
 *
 * That last step is what makes this safe on any host: a Neon pooled host is the direct
 * host with `-pooler` inserted, so dropping it yields the direct endpoint.
 */

/** Neon's pooled host is the direct host plus `-pooler`. Remove it if present. */
function withoutPooler(url: string): string {
  return url.replace("-pooler.", ".");
}

function isUnpooledName(name: string): boolean {
  return name.endsWith("URL_UNPOOLED") || name.endsWith("URL_NON_POOLING");
}

function isPooledName(name: string): boolean {
  return name.endsWith("DATABASE_URL") || name === "POSTGRES_URL";
}

export type ResolvedDatabaseUrl = {
  url: string;
  /** Which environment variable it came from — safe to log, unlike the value. */
  source: string;
  /** True when a `-pooler` host had to be rewritten. */
  rewritten: boolean;
};

export function resolveMigrationUrl(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedDatabaseUrl | null {
  const named = (name: string): ResolvedDatabaseUrl | null => {
    const value = env[name];
    if (!value) return null;
    const url = withoutPooler(value);
    return { url, source: name, rewritten: url !== value };
  };

  // 1. An explicit override always wins.
  const direct = named("DIRECT_URL");
  if (direct) return direct;

  // 2. Any variable that advertises itself as the unpooled connection.
  const unpooled = Object.keys(env).filter(isUnpooledName).sort();
  for (const name of unpooled) {
    const resolved = named(name);
    if (resolved) return resolved;
  }

  // 3. The pooled URL, with the pooler host stripped back to the direct one.
  const pooled = Object.keys(env).filter(isPooledName).sort();
  for (const name of pooled) {
    const resolved = named(name);
    if (resolved) return resolved;
  }

  return null;
}

/**
 * Same as resolveMigrationUrl, but throws with an actionable message and logs which
 * variable was chosen. The log goes into the deploy output, where a wrong pick is
 * otherwise invisible until migrations mysteriously hang.
 */
export function requireMigrationUrl(env: NodeJS.ProcessEnv = process.env): string {
  const resolved = resolveMigrationUrl(env);

  if (!resolved) {
    throw new Error(
      "No database connection string found. Set DIRECT_URL, or DATABASE_URL, or let " +
        "the Neon integration inject DATABASE_URL_UNPOOLED.",
    );
  }

  console.log(
    `[prisma] migrating via ${resolved.source}` +
      (resolved.rewritten ? " (rewrote -pooler host to the direct endpoint)" : ""),
  );

  return resolved.url;
}

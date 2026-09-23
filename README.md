# Тенис клуб Асеновград

Court booking platform for a tennis club in Asenovgrad, Bulgaria. Customers book courts
online — as a guest or with a Google account — and staff manage courts, bookings and
users from an admin panel on the same deployment.

See [ROADMAP.md](./ROADMAP.md) for what shipped in each version and what was deferred.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript
- Tailwind CSS 4
- Prisma 7 + PostgreSQL (Neon)
- Auth.js v5 (NextAuth) — Google SSO
- Brevo for transactional email
- Zod for input validation

## Layout

```
prisma/
  schema.prisma         models + the Auth.js tables
  migrations/           includes the hand-written overlap constraint
  seed.ts               courts, and the first admin
src/
  app/
    (site)/             public customer site
    admin/              staff panel, ADMIN role only
    api/auth/           Auth.js route handler
  components/           UI, split site / booking / admin
  lib/                  db, dal (auth gates), mail, time, validation
  server/               domain services + Server Actions
  auth.ts               Auth.js config
  proxy.ts              optimistic /admin gate (Next 16's Middleware)
```

Two audiences, one app. The customer site and the admin panel share the Prisma client,
the auth config and the domain types rather than being two deployments that drift apart.

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill it in
```

You need a Postgres instance. For local development:

```bash
docker run -d --name tennis-pg \
  -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=tennis \
  -p 55432:5432 postgres:17-alpine
```

Then point both `DATABASE_URL` and `DIRECT_URL` at
`postgresql://dev:devpass@localhost:55432/tennis?schema=public` and run:

```bash
npm run db:migrate     # create the schema
npm run db:seed        # three courts; set SEED_ADMIN_EMAIL first to create an admin
npm run dev
```

Open http://localhost:3000.

> The migration that prevents double bookings creates the `btree_gist` extension, which
> needs superuser rights the first time. The Docker image above runs as superuser, and
> Neon allows it.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` → `next build`. Needs no database. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Seed courts, and the admin from `SEED_ADMIN_EMAIL` |
| `npm run db:studio` | Prisma Studio |

## Admin access

Admins sign in with Google like everyone else; the `ADMIN` role on their `User` row is
what grants access. To create the first one, set `SEED_ADMIN_EMAIL` and run
`npm run db:seed`, then sign in with that Google account.

Access is checked in two places, and both matter:

- `src/proxy.ts` redirects non-admins away from `/admin` before it renders. This reads
  the session cookie only — it is UX, not the security boundary.
- `requireAdmin()` in `src/lib/dal.ts` is the real gate, called by every admin page and
  every Server Action. Server Actions accept direct POSTs that never render a page, so
  they cannot rely on the proxy or the layout.

## Deployment

The app deploys to Vercel. Add a Neon database from the project's **Storage** tab — it
injects `DATABASE_URL` automatically. Add `DIRECT_URL` (Neon's *unpooled* string) and the
rest of the variables from `.env.example` yourself.

### Migrations are not run by the build

The build is `prisma generate && next build` and never touches the database. Apply
migrations yourself, from a machine that can reach the database:

```bash
# PowerShell
$env:DIRECT_URL="postgresql://...neon.tech/neondb?sslmode=require"
npm run db:deploy
```

This is deliberate. Running `migrate deploy` inside the build couples every deploy to
database availability, so an unrelated hiccup blocks shipping app-only changes — and when
two deploys build at once, they race for Prisma's migration advisory lock and one fails
with `P1002`. Migrations are also a change you want to make on purpose, not as a side
effect of pushing.

Order matters when a release contains a migration: apply it **before** the new code is
live if the change is additive, and see [ROADMAP.md](./ROADMAP.md#deploying-the-database)
for the full checklist.

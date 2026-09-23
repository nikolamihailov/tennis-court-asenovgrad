# Roadmap — Тенис клуб Асеновград

Tracking document for the platform. Every release gets a section here: what shipped,
what the data model looks like, and what was deliberately deferred. Update this file in
the same commit as the work it describes, and bump `version` in `package.json` to match.

| Version | Status | Scope |
| --- | --- | --- |
| [0.1.0](#010--booking-backend) | ✅ shipped | Postgres + Prisma, courts/users/bookings, Google + guest booking, admin panel, confirmation email |
| [0.1.1](#011--euro-pricing-and-booking-extras) | ✅ shipped | Euro pricing, rentable rackets, floodlight surcharge, embedded map |
| [0.2.0](#020--planned) | 📋 planned | Customer account area, cancellation by customer, recurring slots |
| [0.3.0](#030--planned) | 📋 planned | Payments (Stripe), SMS reminders |

---

## 0.1.0 — Booking backend

First version with a real backend. Before this, the site was a static marketing page with
a non-functional booking widget.

### Architecture

One Next.js app, two audiences, split by route group:

```
src/app/
  (site)/      public customer site  — /, /booking, /booking/[reference]
  admin/       staff panel           — /admin/**  (ADMIN role only)
  api/         auth + availability endpoints
```

The split is by route group rather than by repo so that the Prisma client, the Auth.js
config, the domain types and the validation schemas have exactly one definition. Admin is
gated in two independent places (see [Authorization](#authorization)).

### Data model

Three domain tables plus the three tables Auth.js requires.

**`Court`** — a bookable court. Opening hours are per-court integers (e.g. 8 → 22) so the
slot generator does not need a separate schedule table yet.

**`User`** — one row per person, whether or not they ever log in.

**`Booking`** — one row per reservation. `userId` is **never null**.

#### Guest bookings

A guest who books gets a real `User` row with `isGuest = true` and no linked OAuth account.
Booking again with the same email reuses that row. The consequences, which are the reason
this was chosen over a nullable `Booking.userId`:

- Admin's Users screen shows guests alongside registered users, with full history.
- Analytics group by person without an email-based join.
- If a guest later signs in with Google using the same address, their past bookings are
  already attached to the row that sign-in claims.

That last point requires `allowDangerousEmailAccountLinking: true` on the Google provider.
It is safe **only** because Google verifies email ownership — do not copy this setting onto
a provider that does not. See `src/auth.ts`.

#### Double-booking prevention

Overlap is prevented by the database, not by application code. A `btree_gist` exclusion
constraint rejects any two `CONFIRMED` bookings on the same court whose time ranges
intersect:

```sql
EXCLUDE USING gist (
  "courtId" WITH =,
  tstzrange("startsAt", "endsAt") WITH &&
) WHERE (status = 'CONFIRMED')
```

Prisma's schema language cannot express this, so it lives in a hand-written migration
(`prisma/migrations/*_booking_overlap_exclusion/migration.sql`). Application code still
checks availability first for a friendly error message; the constraint is what makes it
correct under concurrent requests. A violation surfaces as Postgres error `23P01` and is
translated into "този час вече е зает".

### Authorization

Admin access is checked twice, on purpose:

1. **`src/proxy.ts`** (Next 16 renamed Middleware → Proxy) does an *optimistic* check — it
   reads the role from the JWT session cookie and redirects non-admins away from `/admin`.
   This is UX, not security; it never touches the database.
2. **`requireAdmin()` in `src/lib/dal.ts`** is the real gate. Every admin page, Server
   Action and Route Handler calls it. It re-reads the session and verifies `role === ADMIN`.

The layout is deliberately *not* the gate. Next.js layouts do not re-render on client-side
navigation and do not control whether nested segments render, so a check there is bypassable.

Sessions use the JWT strategy (not database sessions) so the proxy can read the role
without a query on every request.

### Shipped

- [x] Postgres on Neon, provisioned through the Vercel Marketplace integration
- [x] Prisma schema, migrations, and a seed script for the three existing courts
- [x] Auth.js v5 with Google SSO; `role` and `isGuest` exposed on the session
- [x] Booking as a logged-in user (identity taken from the session, not the form)
- [x] Booking as a guest (first name, last name, email required; phone optional)
- [x] Live availability — the booking widget queries real free slots instead of `console.log`
- [x] Confirmation email via Resend, in Bulgarian, with the booking reference
- [x] `/my-bookings` — a signed-in customer's own upcoming and past bookings, read-only
- [x] Admin: courts CRUD (create, edit, price, opening hours, activate/deactivate)
- [x] Admin: bookings list with filters and search, plus cancelling to free the court
- [x] Admin: users list, including guests, with booking counts
- [x] Admin: analytics — bookings, revenue, occupancy rate, busiest hours, top courts
- [x] Database-level double-booking prevention

### Verified

Checked against a real Postgres 17 instance while building, not just typechecked:

- The exclusion constraint rejects identical and partially overlapping slots, allows
  adjacent ones (`11:00–12:00` after `10:00–11:00`), ignores `CANCELLED` rows, and scopes
  per court.
- A losing race surfaces as Postgres `23P01`, which `createBooking` translates into
  "този час вече е зает" rather than a 500.
- Europe/Sofia conversion is correct on both 2026 DST transition days, and a 23:00 local
  slot does not roll over to the next calendar date.
- Guest booking creates a `User` row; booking again with the same email reuses it.
- Cancelling frees the slot and the same hour can be rebooked.
- Unauthenticated requests to every `/admin/*` route redirect to `/login` with the
  correct `callbackUrl`.

### Notable version differences

Both of these differ from older tutorials and from what most tooling assumes:

- **Next.js 16** renamed Middleware to **Proxy** — the file is `src/proxy.ts`, not
  `middleware.ts`. `forbidden()` exists but is still behind the experimental
  `authInterrupts` flag, so the admin gate redirects rather than rendering a 403.
- **Prisma 7** generates the client to a path you choose (`src/generated/prisma`) instead
  of `@prisma/client`, requires a driver adapter (`@prisma/adapter-pg`), takes its
  connection string from `prisma7.config.ts` rather than the `datasource` block, and no
  longer runs seeds automatically after `migrate dev`.

### Deferred

Not bugs — decisions to keep 0.1.0 shippable:

- **Customers cannot cancel their own booking.** They contact the club; an admin cancels it.
  → 0.2.0
- **No payments.** `Booking.totalPrice` is recorded for analytics; money is collected on
  site. The Stripe env vars in `.env.example` are unused. → 0.3.0
- **No SMS.** Twilio env vars are unused. → 0.3.0
- **Admins are promoted by SQL/seed, not through the UI.** There is no "make this person an
  admin" screen. Run `npm run db:seed` with `SEED_ADMIN_EMAIL` set.
- **No per-court schedule exceptions** (holidays, maintenance windows, seasonal hours).
  Opening hours are two integers per court.
- **Bookings are whole hours** aligned to the hour. No 90-minute or half-hour slots.
- **Times are handled in `Europe/Sofia`** and stored as UTC `timestamptz`. There is no
  multi-timezone support and none is wanted.
- **`/booking/<reference>` is public and unthrottled.** Anyone holding a reference can see
  that booking's court, time, and the customer's name and email — that is what makes the
  link in the confirmation email work without an account. References are random over a
  ~1×10⁹ space, so guessing one is impractical, but there is no rate limiting to stop
  someone grinding through the space. Add throttling, or require the email address
  alongside the reference, before treating the page as private. → 0.2.0
- **Guest bookings trust an unverified email.** Typing a registered member's address
  attaches the booking to their account and sends them the confirmation. Profile details
  are never overwritten for a non-guest row, which limits the damage, but the underlying
  trade-off is inherent to identifying people by email alone. Verifying the address with
  a one-time code before confirming would close it. → 0.2.0
- **No automated test suite.** The behaviour listed under [Verified](#verified) was
  checked with throwaway scripts against a real database during development, not with
  committed tests. The overlap constraint and the time-zone conversion are the two things
  most worth pinning down first if tests get added.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon **pooled** connection string. Injected by the Vercel integration. |
| `DIRECT_URL` | yes | Neon **direct** (unpooled) string. Migrations only — pgbouncer cannot run them. |
| `AUTH_SECRET` | yes | `npx auth secret`, or `openssl rand -base64 32`. |
| `AUTH_URL` | prod only | e.g. `https://your-domain.com`. Vercel usually infers this. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes | Google Cloud Console → OAuth client. |
| `RESEND_API_KEY` | no | Without it, emails are logged to the console instead of sent. |
| `RESEND_FROM_EMAIL` | no | Defaults to Resend's `onboarding@resend.dev` sandbox sender. |
| `SEED_ADMIN_EMAIL` | no | Seeding with this set creates/promotes that account to `ADMIN`. |

#### Google OAuth redirect URIs

Add both to the Google OAuth client, or sign-in fails with `redirect_uri_mismatch`:

```
http://localhost:3000/api/auth/callback/google
https://<your-vercel-domain>/api/auth/callback/google
```

### Deploying the database

Neon is Vercel's own Postgres offering, so it needs no separate account:

1. Vercel dashboard → the project → **Storage** → **Create Database** → **Neon**.
2. Vercel injects `DATABASE_URL` (and related vars) into all environments automatically.
3. Add `DIRECT_URL` manually — copy the **unpooled** string from the Neon dashboard.
4. Add the remaining variables from the table above.
5. `prisma migrate deploy` runs as part of the Vercel build (see the `build` script), so
   deploying the app also applies pending migrations.

For local development, `.env.local` can point at the same Neon branch or a local Postgres.
The exclusion constraint needs the `btree_gist` extension, which the first migration
enables; on a local instance this requires superuser rights the first time.

---

## 0.1.1 — Euro pricing and booking extras

### Currency

Bulgaria is on the euro, so every price is now in euro and formatted with
`Intl.NumberFormat("bg-BG", { currency: "EUR" })` — which produces `10,00 €`, with a comma
decimal separator and a trailing symbol, per Bulgarian convention.

Existing court prices were **converted, not relabelled**: the fixed rate is 1.95583, so
20 лв. → €10.23 and 25 лв. → €12.78, rounded to €10 and €13. The real price customers pay
is unchanged. Had the numbers simply been relabelled, every court would have roughly
doubled in price.

`src/lib/pricing.ts` holds the rates, the total calculation and the formatter. It is
deliberately free of `server-only` and of any database import, because the booking form
computes a live preview in the browser while the server computes the authoritative total —
sharing one module is what stops those two from drifting apart.

### Booking extras

Two optional add-ons, both priced per booking rather than per hour:

| Extra | Price | Availability |
| --- | --- | --- |
| Rented racket | €1 each, max 4 | Any court |
| Floodlights | €4 | Outdoor courts only |

`Booking` gained `racketCount` and `lighting`, and `totalPrice` is now a computed sum
rather than a copy of the court's hourly rate. It is still **stored**, not derived on
read: repricing a court later must not silently rewrite what past customers were charged.

The server recomputes the total from the court's own record and never trusts the form —
the browser's running total is only a preview. Racket counts are clamped to 0–4 server
side, and asking for lighting on the indoor court is rejected rather than silently
charged.

### Also

- Footer copyright year is read from the clock instead of being hardcoded to 2025.
- The contact section embeds a Google Map of the club, lazily loaded so Google's script
  and cookies stay off the initial page load.

### Verified

- €10 court + 2 rackets + lighting = €16, and all three values persist.
- Indoor court rejects a lighting request instead of charging for it.
- A form claiming 99 rackets is clamped to 4 (€14, not €109); a negative count floors at 0.
- The client-side preview and the server-side total agree for the same inputs.

---

## 0.2.0 — Planned

- Customer account area at `/account` — booking history, upcoming reservations
- Customer-initiated cancellation, with a cut-off window (e.g. no later than 12h before)
- Recurring / season bookings for club members
- Per-court schedule exceptions: holidays, maintenance, seasonal opening hours
- Admin-created bookings on behalf of a walk-in customer

## 0.3.0 — Planned

- Stripe payment on booking, with deposit vs. pay-on-site as a per-court setting
- Refund handling on cancellation
- SMS reminders via Twilio, 24h before the slot
- Email reminders and a post-match review request

# Тенис клуб Асеновград

Court booking platform for a tennis club in Asenovgrad, Bulgaria. Customers book courts
online — as a guest or with a Google account — and staff manage courts, bookings and
users from an admin panel on the same deployment.

See [ROADMAP.md](./ROADMAP.md) for what shipped in each version and what was deferred.

### Live Demo: 
[<img alt="Play Button" src="https://user-images.githubusercontent.com/114406139/211439129-37c7a037-dde4-49d6-bf62-4ffc4f315fa9.PNG" />](https://tennis-court-asenovgrad.vercel.app/)

## Screenshots

> Taken against a local database filled with demo data — names, phone numbers and
> bookings are made up.

### Customer site

**Home page** — hero, contact details and the quick availability search.

![Home page](docs/screenshots/01-home.jpg)

**Booking a court** — pick a date, duration and optional trainer. The slot grid shows
only times when both the court and the trainer are free, and the summary prices court,
trainer, rackets and floodlights.

![Booking page with a trainer and a selected slot](docs/screenshots/02-booking.png)

**Confirmation** — the booking reference, details and total, with a link to change it.

![Booking confirmation](docs/screenshots/03-confirmation.png)

**Reschedule or cancel** — customers can move or cancel a booking up to 2 hours before
it starts, from their profile or the link in the confirmation email.

![Rescheduling a booking](docs/screenshots/04-reschedule.png)

**Profile** — personal details plus upcoming and past bookings.

![Customer profile with booking history](docs/screenshots/05-profile.png)

**Mobile** — the whole site is responsive.

<p>
  <img src="docs/screenshots/13-mobile-home.jpg" alt="Home page on mobile" width="300" />
  &nbsp;
  <img src="docs/screenshots/14-mobile-booking.png" alt="Booking page on mobile" width="300" />
</p>

### Admin panel

**Dashboard** — bookings, revenue, occupancy and clients for the last 7 / 30 / 90 days,
bookings per day, busiest hours, per-court totals and the next bookings.

![Admin dashboard](docs/screenshots/06-admin-dashboard.png)

**Bookings** — filter by status and court, search by reference, name or email, and
cancel (the customer is emailed).

![Admin bookings list](docs/screenshots/07-admin-bookings.png)

**Courts** — add, edit and deactivate courts; set surface, opening hours and the 60 / 90 /
120-minute prices.

![Editing a court](docs/screenshots/08-admin-courts.png)

**Users** — everyone who has booked, guests included. Promote a registered user to
trainer and set their hourly rate.

![Admin users list](docs/screenshots/09-admin-users.png)

### Trainer dashboard

**Overview** — upcoming sessions, hours and fees, and a timeline of the next seven days
against working hours.

![Trainer dashboard](docs/screenshots/10-trainer-dashboard.png)

**Schedule** — weekly working hours (several windows per day), blocked time off, and the
bio customers see.

![Trainer schedule editor](docs/screenshots/11-trainer-schedule.png)

**New session** — book a court for a student who phoned in; only a name and a phone or
email are needed.

![Trainer booking a session for a student](docs/screenshots/12-trainer-book.png)

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
  migrations/           includes the hand-written overlap constraints
  seed.ts               courts, and the first admin
src/
  app/
    (site)/             public customer site
    admin/              staff panel, ADMIN role only
    trainer/            trainer dashboard, TRAINER role only
    api/auth/           Auth.js route handler
  components/           UI, split site / booking / admin / trainer
  lib/                  db, dal (auth gates), mail, time, validation
  server/               domain services + Server Actions
  auth.ts               Auth.js config
  proxy.ts              optimistic /admin and /trainer gate (Next 16's Middleware)
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

## Trainers

A trainer is a registered customer account that an admin promotes from **Потребители →
Направи треньор**, setting an hourly rate. They get an email, and on their next sign-in
land on `/trainer`, where they:

- set weekly working hours and block out time off (**График**),
- see the next seven days of sessions and free time (**Табло**),
- list and cancel their sessions (**Тренировки**) — cancelling cancels the whole
  booking, court included, and emails the customer.

Customers pick a trainer on the booking page; the slot grid then shows only times when
both the court and the trainer are free, and the trainer's fee (rate × length) is added
to the total. A second exclusion constraint, `Booking_trainer_no_overlap`, stops a
trainer being double-booked across courts, the same way `Booking_no_overlap` guards a
court.

`requireTrainer()` re-reads the role from the database on every request rather than
trusting the session, so revoking the role takes effect immediately. Revoking is refused
while the trainer still has upcoming sessions.

## Deployment

The app deploys to Vercel. Add a Neon database from the project's **Storage** tab — it
injects `DATABASE_URL` automatically. Add `DIRECT_URL` (Neon's *unpooled* string) and the
rest of the variables from `.env.example` yourself.

Court photos are uploaded from **Кортове** in the admin panel and stored in Vercel Blob.
Create a Blob store from the same **Storage** tab and connect it to the project; it
injects `BLOB_READ_WRITE_TOKEN`. To upload while developing locally, copy that token into
`.env.local`. Without it the form refuses uploads and courts show the bundled default
photo. Replacing or removing a photo deletes the old file from the store.

### Migrations run from GitHub Actions, not the build

The build is `prisma generate && next build` and never touches the database. Instead,
[`.github/workflows/migrate.yml`](./.github/workflows/migrate.yml) runs `npm run db:deploy`
on every push to `main`, alongside the Vercel build. It needs one repository secret,
`DIRECT_URL` — Neon's **unpooled** connection string (GitHub → Settings → Secrets and
variables → Actions).

Why not in the build: running `migrate deploy` there coupled every deploy to database
availability, and when two deploys built at once they raced for Prisma's migration
advisory lock and one failed with `P1002`. The workflow runs only for `main`, and its
concurrency group queues runs instead of overlapping them, so there is never more than one
migration in flight.

The workflow and the Vercel build start together, and the migration normally finishes
first. To make that a guarantee, add the `migrate` check under Vercel → Settings →
Deployment Checks, so a production deployment is only promoted after it passes. A failed
run can be retried from the Actions tab (**Run workflow**), or by hand:

```bash
# PowerShell
$env:DIRECT_URL="postgresql://...neon.tech/neondb?sslmode=require"
npm run db:deploy
```

Keep migrations additive (new nullable columns, new tables) so the running code keeps
working while they apply. See [ROADMAP.md](./ROADMAP.md#deploying-the-database) for the
full checklist.

## License

Proprietary — © 2026 Nikola Mihaylov. All rights reserved. No use, copying, modification
or distribution is permitted without written permission. See [LICENSE](./LICENSE).

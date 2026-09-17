# Тенис клуб Асеновград

Next.js website for a tennis court booking platform in Asenovgrad, Bulgaria.

## Stack
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4
- Prisma + PostgreSQL (to be added)
- Auth.js (NextAuth) for registered users + Google SSO (to be added)
- Stripe for payments (to be added)
- Resend / Twilio for email + SMS notifications (to be added)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values as each integration is added.

```bash
cp .env.example .env.local
```

import NextAuth, { type Profile } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import type { Role } from "@/generated/prisma/enums";

/** How long a role claim in the JWT may go unchecked against the database. */
const ROLE_REFRESH_MS = 5 * 60 * 1000;

/**
 * A real bcrypt hash of a value nobody can supply, compared against when no account
 * matches so that sign-in takes the same time whether or not the email exists. Without
 * it, the timing difference alone reveals which addresses are registered.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEeO3ZPRy5BUQ2Q1kK2sQhEkFhKtLoVvLPy";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter's types are written against the PrismaClient that Prisma 6 exported from
  // `@prisma/client`. Prisma 7 generates the client into src/generated instead, so the
  // structurally-compatible client has a different type identity and needs a cast. This
  // casts to whatever PrismaAdapter accepts rather than naming a type that no longer
  // exists, so it keeps working if the adapter's signature changes.
  adapter: PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]),

  session: {
    // JWT rather than database sessions, so src/proxy.ts can read the role from the
    // cookie without a query on every request. Switching to "database" would work too —
    // the Session table exists — but would make the proxy check cost a round trip.
    strategy: "jwt",
  },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      // A guest who booked earlier already has a User row with their email and no linked
      // account. Without this, signing in with that same address fails with
      // OAuthAccountNotLinked instead of claiming the row and its booking history.
      //
      // This is only safe because Google verifies email ownership before asserting it.
      // Do NOT copy this onto a provider that does not.
      allowDangerousEmailAccountLinking: true,
    }),

    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Имейл", type: "email" },
        password: { label: "Парола", type: "password" },
      },

      /**
       * Returning null is the only way to reject, and Auth.js turns every null into the
       * same generic error — which is what we want. Distinguishing "no such account" from
       * "wrong password" would let anyone enumerate which emails are registered.
       */
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, passwordHash: true },
        });

        // No hash means a guest row or a Google-only account. Still run a comparison
        // against a dummy hash so the response takes the same time either way: returning
        // early here would make a missing account measurably faster to probe than a wrong
        // password.
        const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
        const ok = await bcrypt.compare(parsed.data.password, hash);

        if (!ok || !user?.passwordHash) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user, account, profile, trigger }) {
      // `user` is only present on initial sign-in.
      if (user?.id) token.sub = user.id;
      if (!token.sub) return token;

      // Re-read the role periodically rather than only at sign-in. The role lives in a
      // JWT that is valid for 30 days, so without this, revoking someone's ADMIN would
      // not take effect until their token expired. Refreshing on a timer keeps that
      // window to minutes without adding a query to every single request.
      const lastSyncedAt = typeof token.syncedAt === "number" ? token.syncedAt : 0;
      const isStale = Date.now() - lastSyncedAt > ROLE_REFRESH_MS;

      if (user || trigger === "update" || isStale) {
        const select = {
          role: true,
          firstName: true,
          lastName: true,
          phone: true,
          image: true,
        } as const;

        // The Google sync has to happen here, not in `events.signIn`: Auth.js runs this
        // callback *before* that event, so a token built from the row and then synced
        // afterwards carried no name or picture — the navbar showed email initials for
        // the next five minutes while the profile page, reading the row, looked right.
        const dbUser =
          user && account?.provider === "google" && profile
            ? await db.user.update({
                where: { id: token.sub },
                data: googleProfileData(profile, user.name),
                select,
              })
            : await db.user.findUnique({ where: { id: token.sub }, select });

        // A token for a user row that no longer exists keeps its old claims otherwise.
        // Dropping to USER means a deleted account cannot retain admin access.
        token.role = dbUser?.role ?? "USER";
        token.firstName = dbUser?.firstName ?? null;
        token.lastName = dbUser?.lastName ?? null;
        token.phone = dbUser?.phone ?? null;
        // Refreshed on the same timer as the rest, so a picture changed on Google reaches
        // the navbar without a full re-login.
        token.picture = dbUser?.image ?? null;
        token.syncedAt = Date.now();
      }

      return token;
    },

    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = (token.role as Role) ?? "USER";
      session.user.firstName = (token.firstName as string | null) ?? null;
      session.user.lastName = (token.lastName as string | null) ?? null;
      session.user.phone = (token.phone as string | null) ?? null;
      // Auth.js fills session.user.image from token.picture already, but only when the
      // token had one at sign-in. Setting it explicitly keeps it in step with the
      // refresh above, including when it goes from absent to present.
      session.user.image = (token.picture as string | null) ?? null;
      return session;
    },
  },

});

/**
 * The columns a Google-backed row takes from the Google profile, on every sign-in.
 *
 * Google owns the name for these accounts — the profile page shows it read-only and
 * refuses to edit it — so it has to be re-read rather than filled in once. Doing this
 * only when the fields were empty left stale values in place: the seeded admin row
 * carried the literal name "Администратор" and kept it forever, because there was
 * nothing missing to fill.
 *
 * `given_name` and `family_name` come straight from the OAuth profile, which splits the
 * name properly instead of guessing at the first space — that guess mangles
 * double-barrelled surnames and names written family-name-first.
 */
function googleProfileData(profile: Profile, fallbackName: string | null | undefined) {
  const given = typeof profile.given_name === "string" ? profile.given_name : null;
  const family = typeof profile.family_name === "string" ? profile.family_name : null;

  // Fall back to splitting the display name only when Google omits the parts.
  const [fallbackFirst, ...fallbackRest] = (profile.name ?? fallbackName ?? "")
    .trim()
    .split(/\s+/);

  const firstName = given || fallbackFirst || null;
  const lastName = family || (fallbackRest.length > 0 ? fallbackRest.join(" ") : null);

  // The adapter sets `image` when it creates a row, but rows that predate the first
  // Google sign-in — a guest who booked, or the seeded admin — never had one. Syncing it
  // here covers those, and keeps the picture current when someone changes it.
  const picture = typeof profile.picture === "string" ? profile.picture : null;

  return {
    isGuest: false,
    firstName,
    lastName,
    name:
      (typeof profile.name === "string" ? profile.name : null) ??
      [firstName, lastName].filter(Boolean).join(" ") ??
      undefined,
    ...(picture ? { image: picture } : {}),
  };
}

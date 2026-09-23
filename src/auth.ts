import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

/** How long a role claim in the JWT may go unchecked against the database. */
const ROLE_REFRESH_MS = 5 * 60 * 1000;

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
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user, trigger }) {
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
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          select: {
            role: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        });

        // A token for a user row that no longer exists keeps its old claims otherwise.
        // Dropping to USER means a deleted account cannot retain admin access.
        token.role = dbUser?.role ?? "USER";
        token.firstName = dbUser?.firstName ?? null;
        token.lastName = dbUser?.lastName ?? null;
        token.phone = dbUser?.phone ?? null;
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
      return session;
    },
  },

  events: {
    /**
     * The Auth.js adapter only writes name/email/emailVerified/image. Split the Google
     * display name into the first/last name the booking flow needs, and clear isGuest —
     * this person now has a real account.
     */
    async createUser({ user }) {
      if (!user.id) return;

      const [firstName, ...rest] = (user.name ?? "").trim().split(/\s+/);

      await db.user.update({
        where: { id: user.id },
        data: {
          isGuest: false,
          firstName: firstName || null,
          lastName: rest.length > 0 ? rest.join(" ") : null,
        },
      });
    },

    /**
     * A Google sign-in claiming a row that already existed — either a guest who booked
     * before, or an admin created by the seed. `createUser` does not fire in either case,
     * so the row is promoted here instead.
     *
     * Names are filled in whenever they are missing, not only for guests, so a seeded
     * admin ends up with their real name rather than a blank one. Existing values are
     * never overwritten.
     */
    async linkAccount({ user }) {
      if (!user.id) return;

      const existing = await db.user.findUnique({
        where: { id: user.id },
        select: { isGuest: true, firstName: true, lastName: true, name: true },
      });

      if (!existing) return;

      const [firstName, ...rest] = (user.name ?? existing.name ?? "")
        .trim()
        .split(/\s+/);

      const patch: {
        isGuest?: boolean;
        name?: string;
        firstName?: string;
        lastName?: string;
      } = {};

      if (existing.isGuest) patch.isGuest = false;
      if (!existing.name && user.name) patch.name = user.name;
      if (!existing.firstName && firstName) patch.firstName = firstName;
      if (!existing.lastName && rest.length > 0) patch.lastName = rest.join(" ");

      if (Object.keys(patch).length > 0) {
        await db.user.update({ where: { id: user.id }, data: patch });
      }
    },
  },
});

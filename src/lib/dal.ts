import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  role: Role;
  email: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  image: string | null;
};

/**
 * The current user, or null.
 *
 * Wrapped in React's `cache` so that several components in one render pass share a single
 * session read instead of each doing their own.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    role: session.user.role ?? "USER",
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    firstName: session.user.firstName ?? null,
    lastName: session.user.lastName ?? null,
    phone: session.user.phone ?? null,
    image: session.user.image ?? null,
  };
});

/** Require any signed-in user. Redirects to the login page when there is none. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The real admin gate.
 *
 * Every admin page, Server Action and Route Handler must call this. src/proxy.ts also
 * redirects non-admins away from /admin, but that check reads an unverified cookie claim
 * and exists only to avoid rendering a page the user cannot use — it is not the
 * authorization boundary. Server Actions in particular are reachable by direct POST
 * without ever passing through a page render.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) redirect("/login?callbackUrl=%2Fadmin");

  // Signed in, but not staff. `forbidden()` would render a truer 403, but it is still
  // gated behind the experimental `authInterrupts` flag, which is not worth enabling for
  // a single screen. The login page explains this error code.
  if (user.role !== "ADMIN") redirect("/login?error=forbidden");

  return user;
}

/**
 * The trainer gate, for every /trainer page and trainer Server Action.
 *
 * Unlike requireAdmin(), this re-reads the role from the database instead of trusting the
 * session. The JWT's copy can be up to five minutes stale, and a trainer whose role was
 * just revoked must not keep cancelling customers' sessions in that window. It costs one
 * indexed lookup per request in a section only a handful of people use.
 */
export async function requireTrainer(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) redirect("/login?callbackUrl=%2Ftrainer");

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true, trainerProfile: { select: { isActive: true } } },
  });

  if (row?.role !== "TRAINER" || !row.trainerProfile?.isActive) {
    redirect("/login?error=forbidden");
  }

  return { ...user, role: "TRAINER" };
}

/** Non-redirecting variant, for deciding whether to render an admin-only link. */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
}

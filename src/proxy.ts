import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Proxy — what Next.js called Middleware before 16.
 *
 * This is an *optimistic* check only. It reads the role claim from the session cookie so
 * that a non-admin is bounced before /admin renders, which is a UX nicety, not a security
 * boundary. It deliberately does no database work: the proxy runs on every matched
 * request including prefetches.
 *
 * The real gate is requireAdmin() in src/lib/dal.ts, which every admin page and Server
 * Action calls. Do not remove those checks on the strength of this file — Server Actions
 * accept direct POSTs that never pass through a page render.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    // next-auth v5 prefixes the cookie with __Secure- over HTTPS.
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (token.role !== "ADMIN") {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("error", "forbidden");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Static assets and the auth endpoints must stay reachable.
  matcher: ["/admin/:path*"],
};

/**
 * Sanitise a `callbackUrl` before it is redirected to.
 *
 * The value arrives from the query string and is handed straight to a redirect, so an
 * absolute URL would turn the login page into an open redirect — a phishing primitive
 * that borrows this site's domain for the link.
 *
 * Only a single leading "/" followed by a non-slash is accepted. That rejects
 * `//evil.com` (protocol-relative) and `/\evil.com`, which browsers normalise to the
 * same thing; backslashes are refused outright rather than enumerated.
 */
export function safeCallbackUrl(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (value === "/") return "/";
  if (!/^\/[^/\\]/.test(value)) return fallback;
  if (value.includes("\\")) return fallback;
  return value;
}

/**
 * Where a customer manages (cancels or moves) a booking.
 *
 * The token is what authorises someone who is not signed in — it comes from the email.
 * Signed-in owners use the same page without one; see authorizeBookingAccess().
 */
export function manageBookingPath(reference: string, token?: string): string {
  const path = `/booking/${encodeURIComponent(reference)}/manage`;
  return token ? `${path}?t=${encodeURIComponent(token)}` : path;
}

/**
 * An absolute URL on this site, for links that leave the browser (emails).
 *
 * `SITE_URL` wins when set. Otherwise Vercel's production domain, which Vercel sets on
 * every deployment, so production works with no configuration. Local dev falls through to
 * localhost. Only read on the server — none of these are NEXT_PUBLIC_.
 */
export function absoluteUrl(path: string): string {
  const configured =
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");

  return `${configured.replace(/\/+$/, "")}${path}`;
}

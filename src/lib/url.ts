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

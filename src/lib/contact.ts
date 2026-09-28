/**
 * Students without an email address.
 *
 * Every person is one User row keyed by a unique, required email (see the User docblock
 * in schema.prisma). A trainer booking for someone who phoned them may only have a phone
 * number, so such a student gets a placeholder address derived from that number instead.
 *
 * Why not make `email` nullable: the Auth.js adapter, the guest flow and every email and
 * admin view assume it is present, and a null would have to be handled in all of them. A
 * placeholder keeps the one-row-per-person rule — the same phone always maps to the same
 * row, so a student's history accumulates — while the `.invalid` TLD (reserved by RFC
 * 2606, guaranteed never to resolve) means nothing can ever be delivered to it or sign in
 * with it.
 *
 * Anything that sends or shows an email must pass it through these helpers. Client-safe:
 * no server imports.
 */

const PLACEHOLDER_DOMAIN = "no-email.invalid";

/** Digits only, in international form: "0888 123 456" and "+359888123456" both → "359888123456". */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `359${digits.slice(1)}` : digits;
}

export function placeholderEmailForPhone(phone: string): string {
  return `tel.${normalizePhone(phone)}@${PLACEHOLDER_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`);
}

/** The email to show a person, or null when they only have a placeholder. */
export function displayEmail(email: string | null | undefined): string | null {
  return email && !isPlaceholderEmail(email) ? email : null;
}

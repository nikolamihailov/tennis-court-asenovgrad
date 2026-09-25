import Image from "next/image";

/**
 * Profile picture, with initials as the fallback.
 *
 * Only Google accounts have a picture — someone who registered with email and password
 * never supplies one — so the fallback is the normal case rather than an edge case, and
 * is styled to look deliberate instead of like a missing image.
 */
export default function Avatar({
  src,
  firstName,
  lastName,
  email,
  size = 40,
  className = "",
}: {
  src: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  size?: number;
  className?: string;
}) {
  const label = [firstName, lastName].filter(Boolean).join(" ") || email || "Профил";

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        // Google returns a square image; object-cover guards against anything else.
        className={`shrink-0 rounded-full object-cover ring-1 ring-white/10 ${className}`}
        style={{ width: size, height: size }}
        // Avatars are small and already optimised by Google. Routing them through the
        // image optimiser would add a round trip for no saving.
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={label}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={`flex shrink-0 select-none items-center justify-center rounded-full bg-brand-500/15 font-semibold uppercase text-brand-400 ring-1 ring-brand-500/25 ${className}`}
    >
      {initials(firstName, lastName, email)}
    </span>
  );
}

/**
 * One letter from each of the given and family name, or the first two characters of the
 * email when no name is on file — a guest row that has never been filled in.
 */
function initials(
  firstName: string | null,
  lastName: string | null,
  email: string | null,
): string {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";

  if (first || last) return `${first}${last}`;
  return (email ?? "?").slice(0, 2);
}

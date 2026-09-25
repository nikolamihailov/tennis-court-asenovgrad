const TONES = {
  neutral: "bg-white/10 text-white/60",
  brand: "bg-brand-500/15 text-brand-400",
  danger: "bg-red-500/15 text-red-300",
} as const;

/**
 * The small pill used throughout the admin tables.
 *
 * Shared so the same idea reads the same everywhere — an account type in the users table
 * and a booking's login type were drifting apart into two sets of hand-written classes.
 */
export default function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

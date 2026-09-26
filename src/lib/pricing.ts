/**
 * Prices, extras and money formatting.
 *
 * Deliberately free of `server-only` and of any database import: the booking form needs
 * to show a running total in the browser, and the server needs to compute the real one.
 * Both import from here so the two can never disagree.
 *
 * The figure the server calculates is the one that gets charged — the client total is
 * only a preview. See `createBooking` in src/server/bookings.ts.
 */

/** Price per racket, per booking, in euro. */
export const RACKET_PRICE = 1;

/** Floodlight surcharge for one outdoor booking, in euro. */
export const LIGHTING_PRICE = 4;

/** Most rackets a customer can add to a single booking. */
export const MAX_RACKETS = 4;

/** The game lengths customers can book, in minutes. Each has its own price per court. */
export const BOOKING_DURATIONS = [60, 90, 120] as const;

export type BookingDuration = (typeof BOOKING_DURATIONS)[number];

/** A court's price for each game length, in euro. */
export type CourtPrices = Record<BookingDuration, number>;

export function isBookingDuration(value: number): value is BookingDuration {
  return (BOOKING_DURATIONS as readonly number[]).includes(value);
}

/** e.g. "90 мин" — short enough for a chip or a price suffix. */
export function formatDuration(minutes: number): string {
  return `${minutes} мин`;
}

export type BookingExtras = {
  racketCount: number;
  lighting: boolean;
};

/**
 * Total for one booking.
 *
 * `courtPrice` is the court's price for the chosen duration, not an hourly rate — the
 * admin prices each length, so a 90-minute game is not simply 1.5 × the hour. Extras are
 * charged per booking whatever its length.
 *
 * Lighting is only chargeable on outdoor courts — the indoor court is lit anyway — so
 * `isIndoor` is required here rather than trusting the caller to have checked.
 */
export function bookingTotal({
  courtPrice,
  racketCount,
  lighting,
  isIndoor,
}: BookingExtras & { courtPrice: number; isIndoor: boolean }): number {
  const rackets = clampRackets(racketCount) * RACKET_PRICE;
  const floodlights = lighting && !isIndoor ? LIGHTING_PRICE : 0;

  return courtPrice + rackets + floodlights;
}

/** Force a racket count into the allowed range. */
export function clampRackets(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(MAX_RACKETS, Math.max(0, Math.trunc(count)));
}

const EUR = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** e.g. "10,00 €" — Bulgarian convention is a comma decimal and a trailing symbol. */
export function formatEur(amount: number): string {
  return EUR.format(amount);
}

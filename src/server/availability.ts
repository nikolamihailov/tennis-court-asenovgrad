import "server-only";

import { db } from "@/lib/db";
import { BOOKING_DURATIONS, type BookingDuration } from "@/lib/pricing";
import {
  addDaysToIsoDate,
  clubDateHourToUtc,
  clubDateMinuteToUtc,
  clubDateParts,
  formatMinuteOfDay,
  toClubIsoDate,
} from "@/lib/time";
import { listActiveCourts, type CourtDTO } from "./courts";

/** How far ahead customers may book. */
export const BOOKING_HORIZON_DAYS = 60;

/**
 * Every start time sits on this grid. All durations are multiples of it, so the gap a
 * booking leaves behind is always one too.
 */
export const SLOT_STEP_MINUTES = 30;

export type Slot = {
  /** Minutes since club-local midnight that the slot starts, e.g. 570 for 09:30. */
  start: number;
  duration: BookingDuration;
  /** "09:30 – 11:00", club-local. */
  label: string;
  available: boolean;
  /** Why the slot cannot be booked. `null` when it can. */
  reason: "booked" | "past" | null;
};

export type CourtAvailability = {
  court: CourtDTO;
  /** The start times offered for each game length. */
  slots: Record<BookingDuration, Slot[]>;
};

type BookedInterval = { startsAt: Date; endsAt: Date };

/** Minutes since club-local midnight for an instant on `isoDate`, or null on another day. */
function minuteOfDayOn(isoDate: string, instant: Date): number | null {
  if (toClubIsoDate(instant) !== isoDate) return null;
  const { hour, minute } = clubDateParts(instant);
  return hour * 60 + minute;
}

/**
 * The start times offered on one court, for one day and one game length.
 *
 * Every full hour is always listed — booked or past ones included, struck through — so
 * the grid keeps its familiar shape. Half-hour starts are added only where they rescue
 * time that would otherwise be lost, and only while they are free:
 *
 * - right after a booking that ends on the half hour (08:00–09:30 frees 09:30),
 * - so a game ends exactly when the next booking starts,
 * - so a game ends exactly at closing (a 90-minute 20:30–22:00).
 *
 * Offering every half hour instead would double the number of buttons and invite
 * bookings that strand 30 minutes between two games.
 *
 * This is the single definition of a bookable slot: createBooking() rejects any start
 * this function does not return as available, so a hand-crafted request cannot book an
 * off-grid time.
 */
export function buildSlots({
  court,
  isoDate,
  duration,
  bookings,
  now,
}: {
  court: Pick<CourtDTO, "openingHour" | "closingHour">;
  isoDate: string;
  duration: BookingDuration;
  bookings: BookedInterval[];
  now: Date;
}): Slot[] {
  const open = court.openingHour * 60;
  const lastStart = court.closingHour * 60 - duration;
  if (lastStart < open) return [];

  const evaluate = (start: number): Slot => {
    const startsAt = clubDateMinuteToUtc(isoDate, start).getTime();
    const endsAt = startsAt + duration * 60_000;

    const overlaps = bookings.some(
      (booking) =>
        booking.startsAt.getTime() < endsAt && booking.endsAt.getTime() > startsAt,
    );

    const reason = overlaps
      ? ("booked" as const)
      : startsAt <= now.getTime()
        ? ("past" as const)
        : null;

    return {
      start,
      duration,
      label: `${formatMinuteOfDay(start)} – ${formatMinuteOfDay(start + duration)}`,
      available: reason === null,
      reason,
    };
  };

  const slots: Slot[] = [];
  for (let start = open; start <= lastStart; start += 60) {
    slots.push(evaluate(start));
  }

  const gapStarts = new Set<number>([lastStart]);
  for (const booking of bookings) {
    const end = minuteOfDayOn(isoDate, booking.endsAt);
    if (end !== null) gapStarts.add(end);

    const begin = minuteOfDayOn(isoDate, booking.startsAt);
    if (begin !== null) gapStarts.add(begin - duration);
  }

  for (const start of gapStarts) {
    // Full hours are already listed; anything off the grid is not a start we offer.
    if (start % 60 === 0 || start % SLOT_STEP_MINUTES !== 0) continue;
    if (start < open || start > lastStart) continue;

    const slot = evaluate(start);
    if (slot.available) slots.push(slot);
  }

  return slots.sort((a, b) => a.start - b.start);
}

/**
 * Confirmed bookings touching a club-local date, grouped by court.
 *
 * One query covers all courts for the day rather than one per court. The overlap test is
 * `startsAt < dayEnd AND endsAt > dayStart`, which also catches a booking that starts
 * before midnight and runs into the day.
 *
 * `excludeBookingId` leaves one booking out — the one being rescheduled, so its current
 * time reads as free and it can be shifted by half an hour into its own slot.
 */
export async function loadDayBookings(
  courtIds: string[],
  isoDate: string,
  excludeBookingId?: string,
): Promise<Map<string, BookedInterval[]>> {
  // The end of the day is midnight on the *next calendar date*, not start + 24h. On the
  // two DST days a club-local day is 23 or 25 hours long, and the naive version either
  // cut the last hour off (missing a 23:00 booking, so the slot looked free until the
  // database rejected it) or spilled into the following day.
  const dayStart = clubDateHourToUtc(isoDate, 0);
  const dayEnd = clubDateHourToUtc(addDaysToIsoDate(isoDate, 1), 0);

  const bookings = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      courtId: { in: courtIds },
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { courtId: true, startsAt: true, endsAt: true },
  });

  const byCourt = new Map<string, BookedInterval[]>();
  for (const { courtId, ...interval } of bookings) {
    const list = byCourt.get(courtId) ?? [];
    list.push(interval);
    byCourt.set(courtId, list);
  }

  return byCourt;
}

/**
 * Availability for every active court on a club-local date, for every game length.
 *
 * All three lengths are computed up front so switching between them on the booking page
 * is instant and needs no round trip — it is the same bookings, sliced three ways.
 */
export async function getAvailability(
  isoDate: string,
  options: { courtId?: string; now?: Date; excludeBookingId?: string } = {},
): Promise<CourtAvailability[]> {
  const now = options.now ?? new Date();

  const allCourts = await listActiveCourts();
  const courts = options.courtId
    ? allCourts.filter((court) => court.id === options.courtId)
    : allCourts;

  if (courts.length === 0) return [];

  const bookingsByCourt = await loadDayBookings(
    courts.map((court) => court.id),
    isoDate,
    options.excludeBookingId,
  );

  return courts.map((court) => {
    const bookings = bookingsByCourt.get(court.id) ?? [];

    const slots = Object.fromEntries(
      BOOKING_DURATIONS.map((duration) => [
        duration,
        buildSlots({ court, isoDate, duration, bookings, now }),
      ]),
    ) as Record<BookingDuration, Slot[]>;

    return { court, slots };
  });
}

import "server-only";

import { db } from "@/lib/db";
import { addDaysToIsoDate, clubDateHourToUtc, clubDateParts } from "@/lib/time";
import { listActiveCourts, type CourtDTO } from "./courts";

/** How far ahead customers may book. */
export const BOOKING_HORIZON_DAYS = 60;

/** Every booking is exactly one hour. */
export const SLOT_DURATION_HOURS = 1;

export type Slot = {
  /** Club-local hour the slot starts, 0–23. */
  hour: number;
  /** "10:00 – 11:00", club-local. */
  label: string;
  available: boolean;
  /** Why the slot cannot be booked. `null` when it can. */
  reason: "booked" | "past" | null;
};

export type CourtAvailability = {
  court: CourtDTO;
  slots: Slot[];
};

function slotLabel(hour: number): string {
  const end = (hour + SLOT_DURATION_HOURS) % 24;
  return `${String(hour).padStart(2, "0")}:00 – ${String(end).padStart(2, "0")}:00`;
}

/**
 * Hourly availability for every active court on a club-local date.
 *
 * One query covers all courts for the day rather than one query per court. The overlap
 * test is `startsAt < dayEnd AND endsAt > dayStart`, which catches a booking that starts
 * before midnight and runs into the day — not possible with whole-hour slots inside
 * opening hours today, but it stays correct if slot length ever changes.
 */
export async function getAvailability(
  isoDate: string,
  options: { courtId?: string; now?: Date } = {},
): Promise<CourtAvailability[]> {
  const now = options.now ?? new Date();

  const allCourts = await listActiveCourts();
  const courts = options.courtId
    ? allCourts.filter((court) => court.id === options.courtId)
    : allCourts;

  if (courts.length === 0) return [];

  // The end of the day is midnight on the *next calendar date*, not start + 24h. On the
  // two DST days a club-local day is 23 or 25 hours long, and the naive version either
  // cut the last hour off (missing a 23:00 booking, so the slot looked free until the
  // database rejected it) or spilled into the following day.
  const dayStart = clubDateHourToUtc(isoDate, 0);
  const dayEnd = clubDateHourToUtc(addDaysToIsoDate(isoDate, 1), 0);

  const bookings = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      courtId: { in: courts.map((court) => court.id) },
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
    },
    select: { courtId: true, startsAt: true, endsAt: true },
  });

  // courtId -> set of club-local hours already taken.
  const taken = new Map<string, Set<number>>();
  for (const booking of bookings) {
    const hours = taken.get(booking.courtId) ?? new Set<number>();

    for (
      let cursor = booking.startsAt.getTime();
      cursor < booking.endsAt.getTime();
      cursor += 60 * 60 * 1000
    ) {
      hours.add(clubDateParts(new Date(cursor)).hour);
    }

    taken.set(booking.courtId, hours);
  }

  return courts.map((court) => {
    const takenHours = taken.get(court.id) ?? new Set<number>();
    const slots: Slot[] = [];

    for (
      let hour = court.openingHour;
      hour + SLOT_DURATION_HOURS <= court.closingHour;
      hour += SLOT_DURATION_HOURS
    ) {
      const startsAt = clubDateHourToUtc(isoDate, hour);

      const reason = takenHours.has(hour)
        ? ("booked" as const)
        : startsAt.getTime() <= now.getTime()
          ? ("past" as const)
          : null;

      slots.push({
        hour,
        label: slotLabel(hour),
        available: reason === null,
        reason,
      });
    }

    return { court, slots };
  });
}

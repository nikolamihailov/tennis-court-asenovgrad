import "server-only";

import { db } from "@/lib/db";
import {
  addDaysToIsoDate,
  clubDateHourToUtc,
  clubDateParts,
  clubToday,
  isoWeekday,
  toClubIsoDate,
} from "@/lib/time";
import { listBookings, type BookingDTO } from "./bookings";
import { listTimeOffBetween, minuteWithinDay, type TrainerHours } from "./trainers";

/** How many days the dashboard agenda shows, today included. */
export const AGENDA_DAYS = 7;

export type AgendaDay = {
  date: string;
  weekday: number;
  isToday: boolean;
  /** Working windows from the weekly schedule, minutes since midnight. */
  windows: { start: number; end: number }[];
  sessions: BookingDTO[];
  /** Time off falling on this day, clipped to it. */
  timeOff: { id: string; start: number; end: number; reason: string | null }[];
};

export type TrainerOverview = {
  stats: {
    upcoming: number;
    weekSessions: number;
    weekMinutes: number;
    monthEarnings: number;
  };
  agenda: AgendaDay[];
  /** False until the trainer has set any weekly hours — customers cannot book them yet. */
  hasHours: boolean;
};

/**
 * Everything the trainer dashboard shows, in one call.
 *
 * Reads the clock, so it lives here rather than in the page (see listUserBookingsGrouped
 * for the same reasoning).
 */
export async function getTrainerOverview(
  trainerId: string,
  hours: TrainerHours[],
): Promise<TrainerOverview> {
  const today = clubToday();
  const from = clubDateHourToUtc(today, 0);
  const to = clubDateHourToUtc(addDaysToIsoDate(today, AGENDA_DAYS), 0);

  const { year, month } = clubDateParts(new Date());
  const monthStart = clubDateHourToUtc(`${year}-${String(month).padStart(2, "0")}-01`, 0);
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = clubDateHourToUtc(nextMonth, 0);

  const [sessions, timeOff, upcoming, monthFees] = await Promise.all([
    listBookings({ trainerId, status: "CONFIRMED", from, to, order: "asc" }),
    listTimeOffBetween(trainerId, from, to),
    db.booking.count({
      where: { trainerId, status: "CONFIRMED", startsAt: { gt: new Date() } },
    }),
    db.booking.aggregate({
      where: {
        trainerId,
        status: "CONFIRMED",
        startsAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { trainerFee: true },
    }),
  ]);

  const agenda: AgendaDay[] = Array.from({ length: AGENDA_DAYS }, (_, offset) => {
    const date = addDaysToIsoDate(today, offset);
    const weekday = isoWeekday(date);
    const dayStart = clubDateHourToUtc(date, 0).getTime();
    const dayEnd = clubDateHourToUtc(addDaysToIsoDate(date, 1), 0).getTime();

    return {
      date,
      weekday,
      isToday: offset === 0,
      windows: hours
        .filter((h) => h.weekday === weekday)
        .map((h) => ({ start: h.startMinute, end: h.endMinute })),
      sessions: sessions.filter((s) => toClubIsoDate(s.startsAt) === date),
      timeOff: timeOff
        .filter((t) => t.startsAt.getTime() < dayEnd && t.endsAt.getTime() > dayStart)
        .map((t) => ({
          id: t.id,
          start: minuteWithinDay(date, t.startsAt),
          end: minuteWithinDay(date, t.endsAt),
          reason: t.reason,
        })),
    };
  });

  return {
    stats: {
      upcoming,
      weekSessions: sessions.length,
      weekMinutes: sessions.reduce((total, s) => total + s.durationMinutes, 0),
      monthEarnings: Number(monthFees._sum.trainerFee?.toString() ?? 0),
    },
    agenda,
    hasHours: hours.length > 0,
  };
}

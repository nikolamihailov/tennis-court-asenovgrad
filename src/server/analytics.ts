import "server-only";

import { db } from "@/lib/db";
import { addDaysToIsoDate, clubDateParts, toClubIsoDate } from "@/lib/time";

export type AnalyticsRange = 7 | 30 | 90;

export type Analytics = {
  rangeDays: AnalyticsRange;
  totalBookings: number;
  cancelledBookings: number;
  revenue: number;
  uniqueCustomers: number;
  guestShare: number;
  occupancyRate: number;
  upcomingBookings: number;
  busiestHours: { hour: number; count: number }[];
  courtBreakdown: { courtId: string; name: string; bookings: number; revenue: number }[];
  dailyBookings: { date: string; count: number }[];
};

/**
 * Aggregate numbers for the admin dashboard.
 *
 * Everything is derived from the bookings in the window, so the figures describe slots
 * that were *booked* in that period, not money actually collected — there are no
 * payments in 0.1.0. `revenue` is the list price of confirmed bookings.
 */
export async function getAnalytics(rangeDays: AnalyticsRange = 30): Promise<Analytics> {
  const now = new Date();
  const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const [bookings, courts, upcomingBookings] = await Promise.all([
    db.booking.findMany({
      where: { startsAt: { gte: from, lte: now } },
      select: {
        id: true,
        courtId: true,
        userId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        totalPrice: true,
        bookedAsGuest: true,
        court: { select: { name: true, openingHour: true, closingHour: true } },
      },
    }),
    // All courts, not just active ones. The numerator below counts bookings on courts
    // that may since have been deactivated, so an active-only denominator could push
    // occupancy above 100%.
    db.court.findMany({
      select: { id: true, name: true, openingHour: true, closingHour: true },
    }),
    db.booking.count({
      where: { status: "CONFIRMED", startsAt: { gt: now } },
    }),
  ]);

  const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED");
  const cancelled = bookings.length - confirmed.length;

  const revenue = confirmed.reduce(
    (total, booking) => total + Number(booking.totalPrice.toString()),
    0,
  );

  const uniqueCustomers = new Set(confirmed.map((booking) => booking.userId)).size;

  const guestBookings = confirmed.filter((booking) => booking.bookedAsGuest).length;
  const guestShare = confirmed.length > 0 ? guestBookings / confirmed.length : 0;

  // Occupancy = booked hours / bookable hours across every court in the window.
  const bookableHoursPerDay = courts.reduce(
    (total, court) => total + Math.max(0, court.closingHour - court.openingHour),
    0,
  );
  const bookableHours = bookableHoursPerDay * rangeDays;

  const bookedHours = confirmed.reduce(
    (total, booking) =>
      total + (booking.endsAt.getTime() - booking.startsAt.getTime()) / 3_600_000,
    0,
  );

  const occupancyRate = bookableHours > 0 ? bookedHours / bookableHours : 0;

  const hourCounts = new Map<number, number>();
  for (const booking of confirmed) {
    const hour = clubDateParts(booking.startsAt).hour;
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  const busiestHours = [...hourCounts.entries()]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count || a.hour - b.hour)
    .slice(0, 5);

  const courtTotals = new Map<string, { name: string; bookings: number; revenue: number }>();
  for (const booking of confirmed) {
    const entry = courtTotals.get(booking.courtId) ?? {
      name: booking.court.name,
      bookings: 0,
      revenue: 0,
    };
    entry.bookings += 1;
    entry.revenue += Number(booking.totalPrice.toString());
    courtTotals.set(booking.courtId, entry);
  }

  const courtBreakdown = [...courtTotals.entries()]
    .map(([courtId, entry]) => ({ courtId, ...entry }))
    .sort((a, b) => b.bookings - a.bookings);

  // Seed every day in the window so the chart has no gaps where nothing was booked.
  //
  // Stepping by calendar date rather than by 24h: on the two DST days a club-local day
  // is 23 or 25 hours long, so fixed-millisecond stepping skips or repeats a date. A
  // skipped key made those bookings silently disappear from the chart while still
  // counting toward the headline total.
  const dayCounts = new Map<string, number>();
  const firstDay = toClubIsoDate(from);
  for (let index = 0; index <= rangeDays; index += 1) {
    const isoDate = addDaysToIsoDate(firstDay, index);
    if (isoDate > toClubIsoDate(now)) break;
    dayCounts.set(isoDate, 0);
  }

  for (const booking of confirmed) {
    const key = toClubIsoDate(booking.startsAt);
    if (dayCounts.has(key)) dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  return {
    rangeDays,
    totalBookings: confirmed.length,
    cancelledBookings: cancelled,
    revenue,
    uniqueCustomers,
    guestShare,
    occupancyRate,
    upcomingBookings,
    busiestHours,
    courtBreakdown,
    dailyBookings: [...dayCounts.entries()].map(([date, count]) => ({ date, count })),
  };
}

export type UserSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
  isGuest: boolean;
  createdAt: Date;
  bookingCount: number;
  lastBookingAt: Date | null;
};

/** Users for the admin list, with booking counts. */
export async function listUsers(search?: string): Promise<UserSummary[]> {
  const insensitive = { mode: "insensitive" as const };

  const users = await db.user.findMany({
    where: search
      ? {
          OR: [
            { email: { contains: search, ...insensitive } },
            { firstName: { contains: search, ...insensitive } },
            { lastName: { contains: search, ...insensitive } },
          ],
        }
      : undefined,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isGuest: true,
      createdAt: true,
      _count: { select: { bookings: true } },
      bookings: {
        orderBy: { startsAt: "desc" },
        take: 1,
        select: { startsAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    isGuest: user.isGuest,
    createdAt: user.createdAt,
    bookingCount: user._count.bookings,
    lastBookingAt: user.bookings[0]?.startsAt ?? null,
  }));
}

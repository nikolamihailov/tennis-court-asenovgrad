import "server-only";

import { db } from "@/lib/db";
import type { UserSelect } from "@/generated/prisma/models";
import { addDaysToIsoDate, clubDateHourToUtc, clubDateParts, isoWeekday, toClubIsoDate } from "@/lib/time";

/** One weekly window, e.g. Monday 16:00–20:00, in minutes since club-local midnight. */
export type TrainerHours = { weekday: number; startMinute: number; endMinute: number };

/**
 * A trainer as customers see them.
 *
 * No email or phone: this goes to the public booking page and the home page. The picture
 * is the Google one when the trainer signs in with Google, otherwise null and the Avatar
 * falls back to initials.
 */
export type TrainerDTO = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  bio: string | null;
  hourlyRate: number;
  hours: TrainerHours[];
};

/** "Иван Петров", or a neutral label for a row that somehow has no name. */
export function trainerDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  name?: string | null;
}): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.name?.trim() ||
    "Треньор"
  );
}

const trainerSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  image: true,
  trainerProfile: {
    select: {
      bio: true,
      hourlyRate: true,
      isActive: true,
      hours: {
        select: { weekday: true, startMinute: true, endMinute: true },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      },
    },
  },
} satisfies UserSelect;

type TrainerRow = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  trainerProfile: {
    bio: string | null;
    hourlyRate: { toString(): string };
    isActive: boolean;
    hours: TrainerHours[];
  } | null;
};

function toTrainerDTO(row: TrainerRow): TrainerDTO | null {
  if (!row.trainerProfile) return null;
  return {
    id: row.id,
    name: trainerDisplayName(row),
    firstName: row.firstName,
    lastName: row.lastName,
    image: row.image,
    bio: row.trainerProfile.bio,
    hourlyRate: Number(row.trainerProfile.hourlyRate.toString()),
    hours: row.trainerProfile.hours,
  };
}

/**
 * Where "is this person a bookable trainer" is decided: the TRAINER role *and* an active
 * profile. Both, because the role is what the admin grants and the flag is what survives
 * a revoke — either on its own could be stale.
 */
const bookableTrainer = {
  role: "TRAINER",
  trainerProfile: { is: { isActive: true } },
} as const;

/** Trainers customers can book, by name. */
export async function listActiveTrainers(): Promise<TrainerDTO[]> {
  const rows = await db.user.findMany({
    where: bookableTrainer,
    select: trainerSelect,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return rows.map(toTrainerDTO).filter((trainer): trainer is TrainerDTO => trainer !== null);
}

/** One bookable trainer, or null when the id is unknown, not a trainer, or revoked. */
export async function getActiveTrainer(trainerId: string): Promise<TrainerDTO | null> {
  const row = await db.user.findFirst({
    where: { id: trainerId, ...bookableTrainer },
    select: trainerSelect,
  });
  return row ? toTrainerDTO(row) : null;
}

type Interval = { startsAt: Date; endsAt: Date };

/** What limits a trainer on one club-local day: when they work, and when they are taken. */
export type TrainerDay = {
  /** Working windows for that weekday, minutes since midnight. Empty on a day off. */
  windows: { start: number; end: number }[];
  /** Confirmed sessions (on any court) and time off touching the day. */
  busy: Interval[];
};

/**
 * The trainer's constraints on `isoDate`.
 *
 * `excludeBookingId` leaves out the booking being rescheduled, as loadDayBookings() does
 * for courts, so a session can be nudged by half an hour into its own time.
 *
 * `anyHours` treats the whole day as a working window — for the trainer booking their own
 * student, who can agree any time with them. Sessions and time off still block: those are
 * real clashes, not a published preference.
 */
export async function loadTrainerDay(
  trainerId: string,
  isoDate: string,
  { excludeBookingId, anyHours = false }: { excludeBookingId?: string; anyHours?: boolean } = {},
): Promise<TrainerDay> {
  const dayStart = clubDateHourToUtc(isoDate, 0);
  const dayEnd = clubDateHourToUtc(addDaysToIsoDate(isoDate, 1), 0);
  const overlapsDay = { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } };

  const [hours, sessions, timeOffs] = await Promise.all([
    db.trainerWorkingHours.findMany({
      where: { trainerId, weekday: isoWeekday(isoDate) },
      select: { startMinute: true, endMinute: true },
      orderBy: { startMinute: "asc" },
    }),
    db.booking.findMany({
      where: {
        trainerId,
        status: "CONFIRMED",
        ...overlapsDay,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { startsAt: true, endsAt: true },
    }),
    db.trainerTimeOff.findMany({
      where: { trainerId, ...overlapsDay },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  return {
    windows: anyHours
      ? [{ start: 0, end: 24 * 60 }]
      : hours.map((h) => ({ start: h.startMinute, end: h.endMinute })),
    busy: [...sessions, ...timeOffs],
  };
}

// ---------------------------------------------------------------------------
// Trainer's own dashboard
// ---------------------------------------------------------------------------

export type TrainerProfileDTO = TrainerDTO & { isActive: boolean };

/** The trainer's own profile, including when inactive. Null if they never had one. */
export async function getTrainerProfile(trainerId: string): Promise<TrainerProfileDTO | null> {
  const row = await db.user.findUnique({ where: { id: trainerId }, select: trainerSelect });
  const dto = row ? toTrainerDTO(row) : null;
  return dto && row?.trainerProfile ? { ...dto, isActive: row.trainerProfile.isActive } : null;
}

export type TimeOffDTO = { id: string; startsAt: Date; endsAt: Date; reason: string | null };

/** Time off that has not ended yet, soonest first. */
export async function listUpcomingTimeOff(trainerId: string): Promise<TimeOffDTO[]> {
  return db.trainerTimeOff.findMany({
    where: { trainerId, endsAt: { gt: new Date() } },
    select: { id: true, startsAt: true, endsAt: true, reason: true },
    orderBy: { startsAt: "asc" },
    take: 50,
  });
}

/** Time off overlapping a UTC range, for the agenda. */
export async function listTimeOffBetween(
  trainerId: string,
  from: Date,
  to: Date,
): Promise<TimeOffDTO[]> {
  return db.trainerTimeOff.findMany({
    where: { trainerId, startsAt: { lt: to }, endsAt: { gt: from } },
    select: { id: true, startsAt: true, endsAt: true, reason: true },
    orderBy: { startsAt: "asc" },
  });
}

export class TrainerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrainerError";
  }
}

/**
 * Replace the trainer's whole week in one go.
 *
 * The editor submits the complete week, so a delete-and-insert in one transaction is both
 * simpler and more honest than diffing rows: what is saved is exactly what was on screen.
 * Existing sessions are untouched — narrowing the hours does not cancel anyone.
 */
export async function saveWeeklyHours(trainerId: string, hours: TrainerHours[]): Promise<void> {
  await db.$transaction([
    db.trainerWorkingHours.deleteMany({ where: { trainerId } }),
    db.trainerWorkingHours.createMany({
      data: hours.map((h) => ({ trainerId, ...h })),
    }),
  ]);
}

/**
 * Block out time. Refused while it would overlap a confirmed session: the customer has
 * been promised that hour, so the trainer has to cancel it first (which emails them)
 * rather than have it silently contradict their calendar.
 */
export async function addTimeOff(
  trainerId: string,
  { startsAt, endsAt, reason }: { startsAt: Date; endsAt: Date; reason?: string },
): Promise<void> {
  if (endsAt.getTime() <= Date.now()) {
    throw new TrainerError("Периодът вече е минал.");
  }

  const clashing = await db.booking.count({
    where: {
      trainerId,
      status: "CONFIRMED",
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });

  if (clashing > 0) {
    throw new TrainerError(
      clashing === 1
        ? "В този период имате 1 тренировка. Откажете я първо от „Тренировки“."
        : `В този период имате ${clashing} тренировки. Откажете ги първо от „Тренировки“.`,
    );
  }

  await db.trainerTimeOff.create({ data: { trainerId, startsAt, endsAt, reason } });
}

/** Scoped by trainer, so one trainer cannot delete another's time off by id. */
export async function deleteTimeOff(trainerId: string, id: string): Promise<void> {
  await db.trainerTimeOff.deleteMany({ where: { id, trainerId } });
}

export async function updateTrainerBio(trainerId: string, bio: string | null): Promise<void> {
  await db.trainerProfile.update({ where: { userId: trainerId }, data: { bio } });
}

// ---------------------------------------------------------------------------
// Admin: granting and revoking the role
// ---------------------------------------------------------------------------

/**
 * Make a registered user a trainer, or re-activate a former one.
 *
 * Guests cannot be promoted — they have no way to sign in and see the dashboard — and
 * admins are left alone, since one account holds one role and demoting an admin by
 * accident would lock them out of the panel.
 *
 * Returns the person, so the caller can send the "you are now a trainer" email.
 */
export async function grantTrainerRole(
  userId: string,
  hourlyRate: number,
): Promise<{ email: string; firstName: string | null; lastName: string | null }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isGuest: true, email: true, firstName: true, lastName: true },
  });

  if (!user) throw new TrainerError("Потребителят не е намерен.");
  if (user.isGuest) {
    throw new TrainerError("Гостите нямат профил за вход. Поканете ги първо да се регистрират.");
  }
  if (user.role === "ADMIN") throw new TrainerError("Администраторите не могат да бъдат треньори.");
  if (user.role === "TRAINER") throw new TrainerError("Потребителят вече е треньор.");

  await db.$transaction([
    db.trainerProfile.upsert({
      where: { userId },
      create: { userId, hourlyRate },
      update: { hourlyRate, isActive: true },
    }),
    db.user.update({ where: { id: userId }, data: { role: "TRAINER" } }),
  ]);

  return user;
}

/**
 * Take the role away. Refused while the trainer still has upcoming sessions — those
 * customers were promised a trainer, and quietly leaving the sessions in place would
 * point them at someone who can no longer see or manage them.
 */
export async function revokeTrainerRole(userId: string): Promise<void> {
  const upcoming = await db.booking.count({
    where: { trainerId: userId, status: "CONFIRMED", endsAt: { gt: new Date() } },
  });

  if (upcoming > 0) {
    throw new TrainerError(
      `Треньорът има ${upcoming} предстоящи тренировки. Откажете ги първо от „Резервации“.`,
    );
  }

  await db.$transaction([
    db.user.update({ where: { id: userId, role: "TRAINER" }, data: { role: "USER" } }),
    db.trainerProfile.updateMany({ where: { userId }, data: { isActive: false } }),
  ]);
}

export async function setTrainerRate(userId: string, hourlyRate: number): Promise<void> {
  await db.trainerProfile.update({ where: { userId }, data: { hourlyRate } });
}

/**
 * Minutes since club-local midnight of an instant, clamped to `isoDate`: anything before
 * the day reads as 0 and anything after as 1440. Used to draw a multi-day absence as
 * "all day" on each day it covers.
 */
export function minuteWithinDay(isoDate: string, instant: Date): number {
  const date = toClubIsoDate(instant);
  if (date < isoDate) return 0;
  if (date > isoDate) return 24 * 60;
  const { hour, minute } = clubDateParts(instant);
  return hour * 60 + minute;
}

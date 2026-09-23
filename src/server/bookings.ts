import "server-only";

import { db } from "@/lib/db";
import { clubDateHourToUtc, addDaysToIsoDate, clubToday } from "@/lib/time";
import { bookingTotal, clampRackets } from "@/lib/pricing";
import { BOOKING_HORIZON_DAYS, SLOT_DURATION_HOURS } from "./availability";
import type { BookingStatus } from "@/generated/prisma/enums";

/** Postgres SQLSTATE for an exclusion constraint violation. */
const EXCLUSION_VIOLATION = "23P01";

/** How many times to retry a booking insert that hit a duplicate reference. */
const REFERENCE_ATTEMPTS = 3;

export type BookingDTO = {
  id: string;
  reference: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  totalPrice: number;
  racketCount: number;
  lighting: boolean;
  notes: string | null;
  bookedAsGuest: boolean;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  court: { id: string; name: string; surface: string; isIndoor: boolean };
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    isGuest: boolean;
  };
};

const bookingInclude = {
  court: { select: { id: true, name: true, surface: true, isIndoor: true } },
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isGuest: true,
    },
  },
} as const;

type BookingRow = {
  totalPrice: { toString(): string };
} & Omit<BookingDTO, "totalPrice">;

function toBookingDTO(booking: BookingRow): BookingDTO {
  return { ...booking, totalPrice: Number(booking.totalPrice.toString()) };
}

/**
 * Human-facing booking reference, e.g. TK-7F3K9Q.
 *
 * Deliberately not sequential: the reference is what a customer quotes to look a booking
 * up, so one reference should not reveal another.
 */
function generateReference(): string {
  // No I/O/0/1 — those get misread when someone reads a code out over the phone.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (const byte of crypto.getRandomValues(new Uint8Array(6))) {
    code += alphabet[byte % alphabet.length];
  }
  return `TK-${code}`;
}

export class BookingError extends Error {
  constructor(
    message: string,
    readonly field: string = "form",
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type CreateBookingInput = {
  courtId: string;
  date: string;
  hour: number;
  notes?: string;
  bookedAsGuest: boolean;
  racketCount?: number;
  lighting?: boolean;
};

/**
 * Find or create the User row a booking hangs off.
 *
 * A guest gets a real row so their bookings attach to an identity rather than floating
 * free — see the User docblock in schema.prisma. Booking again with the same email
 * reuses the row and fills in details that were missing, but never overwrites a value
 * the person already has, and never touches `role` or `isGuest`: a customer who has
 * since registered must not be demoted back to a guest by booking again.
 */
export async function resolveGuestUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<{ id: string; email: string }> {
  const existing = await db.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isGuest: true,
    },
  });

  if (existing) {
    // Only fill in details for a row that is still a guest. The email on this form is
    // unverified — anyone can type a registered member's address — so it must not be
    // able to edit the profile of an account that someone actually signed in to.
    //
    // The booking itself still attaches to that account, which is the deliberate
    // consequence of keying people by email (see the User docblock in schema.prisma).
    if (existing.isGuest) {
      const patch: Record<string, string> = {};
      if (!existing.firstName) patch.firstName = input.firstName;
      if (!existing.lastName) patch.lastName = input.lastName;
      if (!existing.phone && input.phone) patch.phone = input.phone;

      if (Object.keys(patch).length > 0) {
        await db.user.update({ where: { id: existing.id }, data: patch });
      }
    }

    return { id: existing.id, email: existing.email };
  }

  return db.user.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      name: `${input.firstName} ${input.lastName}`.trim(),
      isGuest: true,
      role: "USER",
    },
    select: { id: true, email: true },
  });
}

/**
 * Create a booking, or throw a BookingError whose message is safe to show the customer.
 *
 * The availability check here exists to produce a readable message. It cannot be correct
 * on its own — two requests for the same slot can both pass it before either commits.
 * The `Booking_no_overlap` exclusion constraint is what actually prevents the double
 * booking; losing that race is caught below and reported as a taken slot.
 */
export async function createBooking(
  userId: string,
  input: CreateBookingInput,
): Promise<BookingDTO> {
  const court = await db.court.findUnique({
    where: { id: input.courtId },
    select: {
      id: true,
      isActive: true,
      isIndoor: true,
      openingHour: true,
      closingHour: true,
      pricePerHour: true,
    },
  });

  if (!court || !court.isActive) {
    throw new BookingError("Избраният корт не е достъпен.", "courtId");
  }

  // Extras are re-derived here from the court's own record. The browser shows a running
  // total, but it is only a preview — the form could claim any price, so nothing about
  // the amount charged is taken from the request.
  const racketCount = clampRackets(input.racketCount ?? 0);
  const lighting = Boolean(input.lighting) && !court.isIndoor;

  if (input.lighting && court.isIndoor) {
    throw new BookingError(
      "Закритият корт е с включено осветление.",
      "lighting",
    );
  }

  const totalPrice = bookingTotal({
    pricePerHour: Number(court.pricePerHour.toString()),
    racketCount,
    lighting,
    isIndoor: court.isIndoor,
  });

  if (
    input.hour < court.openingHour ||
    input.hour + SLOT_DURATION_HOURS > court.closingHour
  ) {
    throw new BookingError("Избраният час е извън работното време на корта.", "hour");
  }

  const today = clubToday();
  if (input.date < today) {
    throw new BookingError("Не може да резервирате в миналото.", "date");
  }

  if (input.date > addDaysToIsoDate(today, BOOKING_HORIZON_DAYS)) {
    throw new BookingError(
      `Може да резервирате най-много ${BOOKING_HORIZON_DAYS} дни напред.`,
      "date",
    );
  }

  const startsAt = clubDateHourToUtc(input.date, input.hour);
  const endsAt = new Date(startsAt.getTime() + SLOT_DURATION_HOURS * 60 * 60 * 1000);

  if (startsAt.getTime() <= Date.now()) {
    throw new BookingError("Този час вече е минал.", "hour");
  }

  // References are random, so a collision is possible even if unlikely. Retrying turns
  // a 1-in-a-billion unrecoverable 500 into a second attempt the customer never sees.
  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt += 1) {
    try {
      const booking = await db.booking.create({
        data: {
          reference: generateReference(),
          courtId: court.id,
          userId,
          startsAt,
          endsAt,
          status: "CONFIRMED",
          totalPrice,
          racketCount,
          lighting,
          notes: input.notes,
          bookedAsGuest: input.bookedAsGuest,
        },
        include: bookingInclude,
      });

      return toBookingDTO(booking);
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new BookingError("Този час вече е зает. Моля, изберете друг.", "hour");
      }
      if (isReferenceCollision(error) && attempt < REFERENCE_ATTEMPTS - 1) {
        continue;
      }
      throw error;
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new BookingError("Възникна грешка при запазването. Моля, опитайте отново.");
}

/** A unique-constraint violation on Booking.reference. */
function isReferenceCollision(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; meta?: { target?: unknown } };
  return (
    candidate.code === "P2002" &&
    JSON.stringify(candidate.meta?.target ?? "").includes("reference")
  );
}

/**
 * Whether an error is the overlap constraint firing.
 *
 * Prisma has no error code for a constraint it does not model. Verified against
 * Prisma 7.10 + @prisma/adapter-pg, the violation arrives as a
 * PrismaClientKnownRequestError with code `P2039` and the real SQLSTATE buried at
 * `meta.driverAdapterError.cause.code`. Rather than reach through that path — which is
 * adapter-specific and undocumented — this scans the serialised meta for the SQLSTATE
 * and falls back to the message, so an adapter or version change degrades to a correct
 * result instead of a silent 500.
 */
function isExclusionViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: string;
    meta?: Record<string, unknown>;
    cause?: unknown;
  };

  if (candidate.code === EXCLUSION_VIOLATION) return true;
  if (candidate.meta && JSON.stringify(candidate.meta).includes(EXCLUSION_VIOLATION)) {
    return true;
  }
  if (candidate.cause && isExclusionViolation(candidate.cause)) return true;

  const message = error instanceof Error ? error.message : "";
  return message.includes("Booking_no_overlap") || message.includes(EXCLUSION_VIOLATION);
}

export async function getBookingByReference(
  reference: string,
): Promise<BookingDTO | null> {
  const booking = await db.booking.findUnique({
    where: { reference },
    include: bookingInclude,
  });

  return booking ? toBookingDTO(booking) : null;
}

/** Cancel a booking, freeing the slot. The row is kept so admin still has the history. */
export async function cancelBooking(
  bookingId: string,
  reason?: string,
): Promise<BookingDTO> {
  const existing = await db.booking.findUnique({
    where: { id: bookingId },
    select: { status: true },
  });

  if (!existing) throw new BookingError("Резервацията не е намерена.");
  if (existing.status === "CANCELLED") {
    throw new BookingError("Резервацията вече е отказана.");
  }

  const booking = await db.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
    include: bookingInclude,
  });

  return toBookingDTO(booking);
}

export type BookingFilters = {
  status?: BookingStatus;
  courtId?: string;
  from?: Date;
  to?: Date;
  search?: string;
  take?: number;
  /**
   * Slot ordering. This interacts with `take`: listing *upcoming* bookings with "desc"
   * would make the limit pick the furthest-away ones, so a "next N bookings" query must
   * pass "asc".
   */
  order?: "asc" | "desc";
};

/** Bookings for the admin list, latest slot first by default. */
export async function listBookings(filters: BookingFilters = {}): Promise<BookingDTO[]> {
  const insensitive = { mode: "insensitive" as const };

  const bookings = await db.booking.findMany({
    where: {
      status: filters.status,
      courtId: filters.courtId,
      startsAt:
        filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
      ...(filters.search
        ? {
            OR: [
              { reference: { contains: filters.search, ...insensitive } },
              { user: { email: { contains: filters.search, ...insensitive } } },
              { user: { firstName: { contains: filters.search, ...insensitive } } },
              { user: { lastName: { contains: filters.search, ...insensitive } } },
            ],
          }
        : {}),
    },
    include: bookingInclude,
    orderBy: { startsAt: filters.order ?? "desc" },
    take: filters.take ?? 200,
  });

  return bookings.map(toBookingDTO);
}

/** One person's bookings, latest slot first. */
export async function listUserBookings(userId: string): Promise<BookingDTO[]> {
  const bookings = await db.booking.findMany({
    where: { userId },
    include: bookingInclude,
    orderBy: { startsAt: "desc" },
    take: 100,
  });

  return bookings.map(toBookingDTO);
}

/**
 * A person's bookings split into upcoming and past.
 *
 * The split reads the clock, which makes it impure — so it lives here rather than in the
 * page component, where calling `Date.now()` during render is a React purity violation.
 * Upcoming is returned soonest-first; past stays most-recent-first.
 */
export async function listUserBookingsGrouped(userId: string): Promise<{
  upcoming: BookingDTO[];
  past: BookingDTO[];
}> {
  const bookings = await listUserBookings(userId);
  const now = Date.now();

  const upcoming = bookings.filter(
    (booking) => booking.status === "CONFIRMED" && booking.startsAt.getTime() > now,
  );
  const upcomingIds = new Set(upcoming.map((booking) => booking.id));

  return {
    upcoming: upcoming.reverse(),
    past: bookings.filter((booking) => !upcomingIds.has(booking.id)),
  };
}

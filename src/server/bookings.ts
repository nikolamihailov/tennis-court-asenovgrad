import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { clubDateMinuteToUtc, addDaysToIsoDate, clubToday } from "@/lib/time";
import { bookingTotal, clampRackets, type BookingDuration } from "@/lib/pricing";
import { BOOKING_HORIZON_DAYS, buildSlots, loadDayBookings } from "./availability";
import { toCourtPrices } from "./courts";
import type { BookingStatus, CancelledBy } from "@/generated/prisma/enums";

/** Postgres SQLSTATE for an exclusion constraint violation. */
const EXCLUSION_VIOLATION = "23P01";

const TAKEN_MESSAGE = "Този час вече е зает. Моля, изберете друг.";

/** How many times to retry a booking insert that hit a duplicate reference. */
const REFERENCE_ATTEMPTS = 3;

/**
 * Customers may cancel or move a booking themselves until this long before it starts.
 * Past that, the club has little chance to refill the court, so they have to call.
 */
export const CUSTOMER_CHANGE_CUTOFF_MINUTES = 120;

const CUTOFF_MESSAGE =
  "Промени са възможни до 2 часа преди началото. Моля, свържете се с клуба.";

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
  /** True once the slot is over. Cancelling is refused past this point. */
  hasEnded: boolean;
  /** True while the customer may still cancel or move it themselves. */
  customerCanChange: boolean;
  /** Length in minutes, derived from the times. */
  durationMinutes: number;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  cancelledBy: CancelledBy | null;
  rescheduledAt: Date | null;
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
  manageTokenHash?: string | null;
} & Omit<BookingDTO, "totalPrice" | "hasEnded" | "customerCanChange" | "durationMinutes">;

/** Whether the customer may still cancel or move a booking themselves. */
function customerCanChange(
  booking: { status: BookingStatus; startsAt: Date },
  now = Date.now(),
): boolean {
  return (
    booking.status === "CONFIRMED" &&
    booking.startsAt.getTime() - now > CUSTOMER_CHANGE_CUTOFF_MINUTES * 60_000
  );
}

// The token hash is pulled out and dropped: DTOs reach pages and props, and the hash has
// no business anywhere outside the functions that check it.
function toBookingDTO(row: BookingRow): BookingDTO {
  const booking = { ...row };
  delete booking.manageTokenHash;

  return {
    ...booking,
    totalPrice: Number(booking.totalPrice.toString()),
    durationMinutes: Math.round(
      (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000,
    ),
    // Derived here rather than in the components that need it: reading the clock during
    // render is a React purity violation, and this keeps the rules that decide whether
    // cancelling is still possible next to the ones enforcing them below.
    hasEnded: booking.endsAt.getTime() <= Date.now(),
    customerCanChange: customerCanChange(booking),
  };
}

/**
 * A fresh secret for the "manage your booking" link, and the hash that gets stored.
 * 32 random bytes — unguessable, unlike the 6-character reference.
 */
function generateManageToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashManageToken(token) };
}

function hashManageToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison, so response timing reveals nothing about the stored hash. */
function manageTokenMatches(token: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const given = Buffer.from(hashManageToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
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
  /** Minutes since club-local midnight. */
  startMinute: number;
  duration: BookingDuration;
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
 *
 * Returns the raw manage token alongside the booking. It exists only in this return
 * value — the database keeps its hash — so the caller must put it in the email now.
 */
export async function createBooking(
  userId: string,
  input: CreateBookingInput,
): Promise<{ booking: BookingDTO; manageToken: string }> {
  const court = await db.court.findUnique({
    where: { id: input.courtId },
    select: {
      id: true,
      isActive: true,
      isIndoor: true,
      openingHour: true,
      closingHour: true,
      price60: true,
      price90: true,
      price120: true,
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
    courtPrice: toCourtPrices(court)[input.duration],
    racketCount,
    lighting,
    isIndoor: court.isIndoor,
  });

  const { startsAt, endsAt } = await assertSlotBookable(court, input);
  const manageToken = generateManageToken();

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
          manageTokenHash: manageToken.hash,
        },
        include: bookingInclude,
      });

      return { booking: toBookingDTO(booking), manageToken: manageToken.token };
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new BookingError(TAKEN_MESSAGE, "startMinute");
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

type SlotRequest = { date: string; startMinute: number; duration: BookingDuration };

/**
 * Throw a readable BookingError unless the slot can be booked, and return its instants.
 *
 * Shared by booking and rescheduling so both obey the same rules. The slot is checked
 * against the same generator the booking page renders from, so the only starts accepted
 * are the ones customers are actually shown — full hours, plus the half hours that fill
 * a gap. See buildSlots(). `excludeBookingId` is the booking being moved, which must not
 * count as blocking its own new time.
 */
async function assertSlotBookable(
  court: { id: string; openingHour: number; closingHour: number },
  request: SlotRequest,
  excludeBookingId?: string,
): Promise<{ startsAt: Date; endsAt: Date }> {
  if (
    request.startMinute < court.openingHour * 60 ||
    request.startMinute + request.duration > court.closingHour * 60
  ) {
    throw new BookingError(
      "Избраният час е извън работното време на корта.",
      "startMinute",
    );
  }

  const today = clubToday();
  if (request.date < today) {
    throw new BookingError("Не може да резервирате в миналото.", "date");
  }

  if (request.date > addDaysToIsoDate(today, BOOKING_HORIZON_DAYS)) {
    throw new BookingError(
      `Може да резервирате най-много ${BOOKING_HORIZON_DAYS} дни напред.`,
      "date",
    );
  }

  const dayBookings = await loadDayBookings([court.id], request.date, excludeBookingId);
  const slot = buildSlots({
    court,
    isoDate: request.date,
    duration: request.duration,
    bookings: dayBookings.get(court.id) ?? [],
    now: new Date(),
  }).find((candidate) => candidate.start === request.startMinute);

  if (slot?.reason === "past") {
    throw new BookingError("Този час вече е минал.", "startMinute");
  }
  if (slot?.reason === "booked") {
    throw new BookingError(TAKEN_MESSAGE, "startMinute");
  }
  if (!slot) {
    throw new BookingError(
      "Този начален час не се предлага. Моля, изберете от списъка.",
      "startMinute",
    );
  }

  const startsAt = clubDateMinuteToUtc(request.date, request.startMinute);
  const endsAt = new Date(startsAt.getTime() + request.duration * 60 * 1000);
  return { startsAt, endsAt };
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

/**
 * Cancel a booking, freeing the slot. The row is kept so admin still has the history.
 *
 * Staff may cancel until the slot ends. A customer only until the cut-off before it
 * starts — the caller says which, and must have already checked they may act on it
 * (see authorizeBookingAccess()).
 */
export async function cancelBooking(
  bookingId: string,
  { reason, by }: { reason?: string; by: CancelledBy },
): Promise<BookingDTO> {
  const existing = await db.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, startsAt: true, endsAt: true },
  });

  if (!existing) throw new BookingError("Резервацията не е намерена.");
  if (existing.status === "CANCELLED") {
    throw new BookingError("Резервацията вече е отказана.");
  }

  // Cancelling exists to free a court and warn the customer, and a finished slot can do
  // neither — it would only rewrite history and fire a pointless email. The cut-off is
  // the end of the slot rather than its start, so a no-show can still be cancelled while
  // the hour is running.
  if (existing.endsAt.getTime() <= Date.now()) {
    throw new BookingError("Не може да откажете приключила резервация.");
  }

  if (by === "CUSTOMER" && !customerCanChange(existing)) {
    throw new BookingError(CUTOFF_MESSAGE);
  }

  try {
    const booking = await db.booking.update({
      // Status in the filter too: if the booking was cancelled between the read above
      // and this write, the update matches nothing instead of cancelling it twice.
      where: { id: bookingId, status: "CONFIRMED" },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy: by,
      },
      include: bookingInclude,
    });

    return toBookingDTO(booking);
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new BookingError("Резервацията вече е отказана.");
    }
    throw error;
  }
}

/**
 * Move a customer's booking to another date, time or length, on the same court.
 *
 * Extras (rackets, lighting) carry over and the total is recomputed at today's price for
 * the new length — the same as booking afresh. The move is a single UPDATE, so the
 * exclusion constraint still guards it: if someone takes the new slot first, nothing
 * changes and the customer keeps their original time.
 *
 * The manage token is rotated, because the confirmation email for the new time carries a
 * new link. The raw token is returned for that email and not kept anywhere.
 */
export async function rescheduleBooking(
  bookingId: string,
  request: SlotRequest,
): Promise<{ booking: BookingDTO; manageToken: string }> {
  const existing = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      startsAt: true,
      endsAt: true,
      racketCount: true,
      lighting: true,
      court: {
        select: {
          id: true,
          isActive: true,
          isIndoor: true,
          openingHour: true,
          closingHour: true,
          price60: true,
          price90: true,
          price120: true,
        },
      },
    },
  });

  if (!existing) throw new BookingError("Резервацията не е намерена.");
  if (existing.status === "CANCELLED") {
    throw new BookingError("Резервацията е отказана и не може да бъде преместена.");
  }
  if (!customerCanChange(existing)) throw new BookingError(CUTOFF_MESSAGE);

  const { court } = existing;
  if (!court.isActive) {
    throw new BookingError(
      "Кортът в момента не приема резервации. Моля, свържете се с клуба.",
    );
  }

  const { startsAt, endsAt } = await assertSlotBookable(court, request, bookingId);

  if (
    startsAt.getTime() === existing.startsAt.getTime() &&
    endsAt.getTime() === existing.endsAt.getTime()
  ) {
    throw new BookingError("Това е текущият час на резервацията. Изберете друг.", "startMinute");
  }

  const totalPrice = bookingTotal({
    courtPrice: toCourtPrices(court)[request.duration],
    racketCount: existing.racketCount,
    lighting: existing.lighting,
    isIndoor: court.isIndoor,
  });

  const manageToken = generateManageToken();

  try {
    const booking = await db.booking.update({
      where: { id: bookingId, status: "CONFIRMED" },
      data: {
        startsAt,
        endsAt,
        totalPrice,
        manageTokenHash: manageToken.hash,
        rescheduledAt: new Date(),
      },
      include: bookingInclude,
    });

    return { booking: toBookingDTO(booking), manageToken: manageToken.token };
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new BookingError(TAKEN_MESSAGE, "startMinute");
    }
    if (isRecordNotFound(error)) {
      throw new BookingError("Резервацията е отказана и не може да бъде преместена.");
    }
    throw error;
  }
}

/**
 * The booking behind a manage link or profile button, if the caller may act on it.
 *
 * Two ways in: the secret token from the email (anyone holding the link — that is the
 * point of it), or being signed in as the person the booking belongs to. The reference
 * alone is never enough: it is short, printed on screens, and read out over the phone.
 *
 * Every page render *and* every action must call this. Server Actions accept direct
 * POSTs, so the page having checked proves nothing about the request in hand.
 */
export async function authorizeBookingAccess(
  reference: string,
  { token, userId }: { token?: string; userId?: string },
): Promise<BookingDTO | null> {
  const booking = await db.booking.findUnique({
    where: { reference },
    include: bookingInclude,
  });

  if (!booking) return null;

  const allowed =
    (token !== undefined && manageTokenMatches(token, booking.manageTokenHash)) ||
    (userId !== undefined && booking.userId === userId);

  return allowed ? toBookingDTO(booking) : null;
}

/** Prisma's "the row to update did not match", e.g. the status changed under us. */
function isRecordNotFound(error: unknown): boolean {
  return (
    !!error && typeof error === "object" && (error as { code?: string }).code === "P2025"
  );
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

import { z } from "zod";

import { isValidIsoDate } from "./time";
import { isPlaceholderEmail } from "./contact";
import { isBookingDuration, MAX_RACKETS, type BookingDuration } from "./pricing";

const isoDate = z
  .string()
  .trim()
  .refine(isValidIsoDate, { error: "Невалидна дата." });

/**
 * An optional free-text field coming from a `FormData`.
 *
 * `formData.get()` returns `null` for a missing field and `""` for one the user cleared,
 * and both mean "no value". Normalising them to `undefined` lets the write layer turn
 * them into an explicit SQL `NULL` — otherwise clearing a field would be indistinguishable
 * from not submitting it, and the old value would survive.
 */
const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .refine((value) => value.length <= max, {
      error: `Максимум ${max} символа.`,
    })
    .transform((value) => (value === "" ? undefined : value));

const personName = z
  .string()
  .trim()
  .min(2, { error: "Трябва да е поне 2 символа." })
  .max(60, { error: "Максимум 60 символа." });

// Placeholder addresses stand in for students with no email (see src/lib/contact.ts).
// Nobody may type one: registering with it would claim that student's booking history.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Невалиден имейл адрес." }))
  .refine((value) => !isPlaceholderEmail(value), { error: "Невалиден имейл адрес." });

// Bulgarian mobile numbers, with or without the +359 country code. Optional field.
const phone = z
  .string()
  .trim()
  .regex(/^(\+359|0)[0-9\s-]{8,12}$/, { error: "Невалиден телефонен номер." })
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Query for the availability endpoint / booking page. */
export const availabilityQuerySchema = z.object({
  date: isoDate,
  courtId: z.string().trim().min(1).optional(),
});

/** Minutes since club-local midnight. Whether it is actually offered is checked later. */
const startMinute = z.coerce
  .number()
  .int({ error: "Невалиден час." })
  .min(0, { error: "Невалиден час." })
  .max(24 * 60 - 1, { error: "Невалиден час." });

const duration = z.coerce
  .number()
  .refine(isBookingDuration, { error: "Невалидна продължителност." })
  .transform((value) => value as BookingDuration);

/** Shared shape of a booking request, before we know who is booking. */
const bookingSlotSchema = z.object({
  courtId: z.string().trim().min(1, { error: "Изберете корт." }),
  date: isoDate,
  startMinute,
  duration,
  notes: optionalText(500),

  racketCount: z.coerce
    .number()
    .int({ error: "Невалиден брой ракети." })
    .min(0, { error: "Невалиден брой ракети." })
    .max(MAX_RACKETS, { error: `Максимум ${MAX_RACKETS} ракети.` })
    .default(0),

  // An unchecked checkbox is simply absent from the FormData, so anything other than
  // the checked value means "off".
  lighting: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value === "on" || value === "true"),

  // Optional: most bookings are a court alone. Whether the id is a bookable trainer is
  // checked against the database in createBooking().
  trainerId: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (value ? value.trim() : ""))
    .transform((value) => (value === "" ? undefined : value)),
});

/** A guest must identify themselves; there is no account to read the details from. */
export const guestBookingSchema = bookingSlotSchema.extend({
  firstName: personName,
  lastName: personName,
  email,
  phone,
});

/** A signed-in user's identity comes from the session, not the form. */
export const userBookingSchema = bookingSlotSchema.extend({
  phone,
});

const price = z.coerce
  .number({ error: "Въведете цена." })
  .positive({ error: "Цената трябва да е положително число." })
  .max(10000, { error: "Цената изглежда твърде висока." });

export const courtSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Трябва да е поне 2 символа." })
    .max(60, { error: "Максимум 60 символа." }),
  surface: z.enum(["CLAY", "HARD"], { error: "Изберете настилка." }),
  isIndoor: z.coerce.boolean(),
  price60: price,
  price90: price,
  price120: price,
  description: optionalText(500),
  imageUrl: optionalText(500),
  openingHour: z.coerce.number().int().min(0).max(23),
  closingHour: z.coerce.number().int().min(1).max(24),
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
})
  .refine((court) => court.closingHour > court.openingHour, {
    error: "Часът на затваряне трябва да е след часа на отваряне.",
    path: ["closingHour"],
  });

/**
 * Minimum 8 characters and nothing else.
 *
 * Composition rules (a digit, a symbol, mixed case) push people toward predictable
 * substitutions like "Password1!" and toward writing passwords down, without adding much
 * real entropy. Length is what matters. NIST dropped composition requirements for the
 * same reason.
 */
const password = z
  .string()
  .min(8, { error: "Паролата трябва да е поне 8 символа." })
  .max(200, { error: "Паролата е твърде дълга." });

export const registerSchema = z
  .object({
    firstName: personName,
    lastName: personName,
    email,
    phone,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Паролите не съвпадат.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  // Not `password` here: an existing account may predate any rule we set, and telling
  // someone their password is "too short" at sign-in leaks that it was accepted once.
  password: z.string().min(1, { error: "Въведете парола." }),
});

/** Editable profile fields. Email is identity and role is staff-only, so neither is here. */
export const profileSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone,
});

/**
 * What a Google-backed account may change.
 *
 * Their name comes from the Google profile and is re-read on every sign-in, so accepting
 * one here would be pointless — the next sign-in would overwrite it. The form renders
 * those fields read-only; this is what stops a hand-crafted POST from getting further.
 */
export const profilePhoneOnlySchema = z.object({ phone });

export const cancelBookingSchema = z.object({
  bookingId: z.string().trim().min(1),
  reason: optionalText(300),
});

/**
 * Which booking a customer is acting on, and how they prove they may.
 * `token` is the secret from the email link; absent when acting from the profile.
 */
const managedBooking = {
  reference: z.string().trim().min(1).max(40),
  token: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (value ? value.trim() : undefined)),
};

export const customerCancelSchema = z.object({
  ...managedBooking,
  reason: optionalText(300),
});

export const rescheduleSchema = z.object({
  ...managedBooking,
  date: isoDate,
  startMinute,
  duration,
});

// ---------------------------------------------------------------------------
// Trainers
// ---------------------------------------------------------------------------

const hourlyRate = z.coerce
  .number({ error: "Въведете ставка." })
  .min(0, { error: "Ставката не може да е отрицателна." })
  .max(1000, { error: "Ставката изглежда твърде висока." });

/** Admin: grant the role, or change the rate of an existing trainer. */
export const trainerRateSchema = z.object({
  userId: z.string().trim().min(1),
  hourlyRate,
});

/** A minute of the day on the 30-minute grid, 0..1440 inclusive (1440 = midnight after). */
const gridMinute = z.coerce
  .number()
  .int()
  .min(0)
  .max(24 * 60)
  .refine((value) => value % 30 === 0, { error: "Часовете са през 30 минути." });

const workingWindow = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7),
    startMinute: gridMinute,
    endMinute: gridMinute,
  })
  .refine((window) => window.endMinute > window.startMinute, {
    error: "Краят трябва да е след началото.",
  });

/**
 * The whole week from the hours editor, sent as one JSON field.
 *
 * Overlapping windows on the same day are refused rather than merged: they almost always
 * mean a typo, and silently merging would save something other than what was typed.
 */
export const weeklyHoursSchema = z
  .string()
  .transform((raw, context) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      context.addIssue({ code: "custom", message: "Невалиден график." });
      return z.NEVER;
    }
  })
  .pipe(z.array(workingWindow).max(35, { error: "Твърде много интервали." }))
  .refine(
    (windows) =>
      windows.every((a, i) =>
        windows.every(
          (b, j) =>
            i === j ||
            a.weekday !== b.weekday ||
            a.endMinute <= b.startMinute ||
            b.endMinute <= a.startMinute,
        ),
      ),
    { error: "Интервалите в един ден не трябва да се застъпват." },
  );

/** Time off: a date range, either whole days or from one time to another. */
export const timeOffSchema = z
  .object({
    fromDate: isoDate,
    toDate: isoDate,
    allDay: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((value) => value === "on" || value === "true"),
    fromMinute: gridMinute.optional(),
    toMinute: gridMinute.optional(),
    reason: optionalText(200),
  })
  .refine((data) => data.toDate >= data.fromDate, {
    error: "Крайната дата трябва да е след началната.",
    path: ["toDate"],
  })
  .refine(
    (data) =>
      data.allDay ||
      (data.fromMinute !== undefined &&
        data.toMinute !== undefined &&
        (data.toDate > data.fromDate || data.toMinute > data.fromMinute)),
    { error: "Краят трябва да е след началото.", path: ["toMinute"] },
  );

export const trainerBioSchema = z.object({ bio: optionalText(600) });

/**
 * A trainer booking for a student who phoned them. The student may have no email, so
 * either a phone or an email is enough — but one of them is required, or the club would
 * have no way to reach them. The surname is optional: over the phone "Иван" is often all
 * the trainer gets.
 */
export const trainerStudentBookingSchema = bookingSlotSchema
  .omit({ trainerId: true })
  .extend({
    firstName: personName,
    lastName: z
      .string()
      .trim()
      .max(60, { error: "Максимум 60 символа." })
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.union([z.literal(""), email]))
      .transform((value) => (value === "" ? undefined : value)),
    phone,
  })
  .refine((data) => data.email || data.phone, {
    error: "Въведете телефон или имейл на ученика.",
    path: ["phone"],
  });

export type GuestBookingInput = z.infer<typeof guestBookingSchema>;
export type UserBookingInput = z.infer<typeof userBookingSchema>;
export type CourtInput = z.infer<typeof courtSchema>;

/**
 * Collapse a ZodError into `{ field: "first message" }`.
 *
 * Only the first error per field is kept — the forms show one message under each input,
 * and showing a stack of them for a single field is noise.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}

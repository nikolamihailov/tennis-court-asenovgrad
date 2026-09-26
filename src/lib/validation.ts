import { z } from "zod";

import { isValidIsoDate } from "./time";
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

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Невалиден имейл адрес." }));

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

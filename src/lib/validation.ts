import { z } from "zod";

import { isValidIsoDate } from "./time";

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

/** Shared shape of a booking request, before we know who is booking. */
const bookingSlotSchema = z.object({
  courtId: z.string().trim().min(1, { error: "Изберете корт." }),
  date: isoDate,
  hour: z.coerce
    .number()
    .int({ error: "Невалиден час." })
    .min(0, { error: "Невалиден час." })
    .max(23, { error: "Невалиден час." }),
  notes: optionalText(500),
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

export const courtSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Трябва да е поне 2 символа." })
    .max(60, { error: "Максимум 60 символа." }),
  surface: z.enum(["CLAY", "HARD"], { error: "Изберете настилка." }),
  isIndoor: z.coerce.boolean(),
  pricePerHour: z.coerce
    .number({ error: "Въведете цена." })
    .positive({ error: "Цената трябва да е положително число." })
    .max(10000, { error: "Цената изглежда твърде висока." }),
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

export const cancelBookingSchema = z.object({
  bookingId: z.string().trim().min(1),
  reason: optionalText(300),
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

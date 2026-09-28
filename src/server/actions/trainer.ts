"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireTrainer } from "@/lib/dal";
import { placeholderEmailForPhone } from "@/lib/contact";
import { sendBookingConfirmation, sendTrainerCancellation } from "@/lib/mail";
import { absoluteUrl, manageBookingPath } from "@/lib/url";
import { addDaysToIsoDate, clubDateMinuteToUtc } from "@/lib/time";
import {
  cancelBookingSchema,
  fieldErrors,
  timeOffSchema,
  trainerBioSchema,
  trainerStudentBookingSchema,
  weeklyHoursSchema,
} from "@/lib/validation";
import {
  BookingError,
  cancelBooking,
  createBooking,
  resolveGuestUser,
} from "@/server/bookings";
import {
  addTimeOff,
  deleteTimeOff,
  saveWeeklyHours,
  TrainerError,
  updateTrainerBio,
} from "@/server/trainers";

export type TrainerFormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

/**
 * Every action here calls requireTrainer() first and acts only on the caller's own data.
 * The trainer id always comes from the session, never from the form, so a trainer cannot
 * edit another's hours or cancel another's sessions by changing a hidden field.
 */

function revalidateTrainerViews() {
  revalidatePath("/trainer", "layout");
  revalidatePath("/booking");
  revalidatePath("/");
}

export async function saveWeeklyHoursAction(
  _previous: TrainerFormState,
  formData: FormData,
): Promise<TrainerFormState> {
  const trainer = await requireTrainer();

  const parsed = weeklyHoursSchema.safeParse(String(formData.get("hours") ?? "[]"));
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Невалиден график." };
  }

  await saveWeeklyHours(trainer.id, parsed.data);

  revalidateTrainerViews();
  return { ok: true, message: "Графикът е запазен." };
}

export async function addTimeOffAction(
  _previous: TrainerFormState,
  formData: FormData,
): Promise<TrainerFormState> {
  const trainer = await requireTrainer();

  const parsed = timeOffSchema.safeParse({
    fromDate: formData.get("fromDate"),
    toDate: formData.get("toDate") || formData.get("fromDate"),
    allDay: formData.get("allDay"),
    fromMinute: formData.get("fromMinute") || undefined,
    toMinute: formData.get("toMinute") || undefined,
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { fromDate, toDate, allDay, fromMinute, toMinute, reason } = parsed.data;

  // Whole days run from midnight to the midnight after the last day — the next calendar
  // date, not +24h, so a DST day is covered completely.
  const startsAt = clubDateMinuteToUtc(fromDate, allDay ? 0 : (fromMinute ?? 0));
  const endsAt = allDay
    ? clubDateMinuteToUtc(addDaysToIsoDate(toDate, 1), 0)
    : clubDateMinuteToUtc(toDate, toMinute ?? 0);

  try {
    await addTimeOff(trainer.id, { startsAt, endsAt, reason });
  } catch (error) {
    if (error instanceof TrainerError) return { message: error.message };
    throw error;
  }

  revalidateTrainerViews();
  return { ok: true, message: "Периодът е блокиран." };
}

export async function deleteTimeOffAction(formData: FormData): Promise<void> {
  const trainer = await requireTrainer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await deleteTimeOff(trainer.id, id);
  revalidateTrainerViews();
}

export async function updateBioAction(
  _previous: TrainerFormState,
  formData: FormData,
): Promise<TrainerFormState> {
  const trainer = await requireTrainer();

  const parsed = trainerBioSchema.safeParse({ bio: formData.get("bio") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await updateTrainerBio(trainer.id, parsed.data.bio ?? null);

  revalidateTrainerViews();
  return { ok: true, message: "Запазено." };
}

/**
 * The trainer cancels one of their sessions. The whole booking goes, court included —
 * the customer booked the two together — and the customer is emailed, as when the club
 * cancels. Same signature as the admin action so the same button component serves both.
 */
export async function trainerCancelBookingAction(
  _previous: TrainerFormState,
  formData: FormData,
): Promise<TrainerFormState> {
  const trainer = await requireTrainer();

  const parsed = cancelBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Ownership first: the id in the form says which booking, not whether this trainer may
  // touch it. A booking that is not theirs reads the same as one that does not exist.
  const owned = await db.booking.findFirst({
    where: { id: parsed.data.bookingId, trainerId: trainer.id },
    select: { id: true },
  });
  if (!owned) return { message: "Тренировката не е намерена." };

  try {
    const booking = await cancelBooking(owned.id, {
      reason: parsed.data.reason,
      by: "TRAINER",
    });
    await sendTrainerCancellation(booking);
  } catch (error) {
    if (error instanceof BookingError) return { message: error.message };

    console.error("[trainer] cancel failed:", error);
    return { message: "Възникна неочаквана грешка." };
  }

  revalidateTrainerViews();
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  revalidatePath("/profile");
  return { ok: true, message: "Тренировката е отказана." };
}

/**
 * The trainer books a session for a student — someone who phoned them and has no account
 * or no internet. The student is found or created by email, or by phone when there is no
 * email (see src/lib/contact.ts), and the session is always with this trainer: the id
 * comes from the session, never the form.
 *
 * Their weekly hours do not limit this — a trainer can agree any time with their own
 * student — but the court, their other sessions and their time off still do.
 *
 * Same shape as createBookingAction so the booking board drives both.
 */
export async function trainerCreateBookingAction(
  _previous: TrainerFormState,
  formData: FormData,
): Promise<TrainerFormState> {
  const trainer = await requireTrainer();

  const parsed = trainerStudentBookingSchema.safeParse({
    courtId: formData.get("courtId"),
    date: formData.get("date"),
    startMinute: formData.get("startMinute"),
    duration: formData.get("duration"),
    notes: formData.get("notes") || undefined,
    racketCount: formData.get("racketCount") ?? 0,
    lighting: formData.get("lighting"),
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { firstName, lastName, email, phone, ...slot } = parsed.data;

  let reference: string;

  try {
    // The refine guarantees one of the two; phone-only students get a placeholder.
    const student = await resolveGuestUser({
      email: email ?? placeholderEmailForPhone(phone!),
      firstName,
      lastName,
      phone,
    });

    const { booking, manageToken } = await createBooking(student.id, {
      ...slot,
      trainerId: trainer.id,
      bookedByTrainer: true,
      bookedAsGuest: true,
    });
    reference = booking.reference;

    // A student with a real email still gets the confirmation and the link to cancel or
    // move it themselves. For a placeholder, send() skips delivery.
    await sendBookingConfirmation(
      booking,
      absoluteUrl(manageBookingPath(booking.reference, manageToken)),
    );
  } catch (error) {
    if (error instanceof BookingError) {
      return { errors: { [error.field]: error.message }, message: error.message };
    }

    console.error("[trainer] booking for student failed:", error);
    return { message: "Възникна неочаквана грешка. Моля, опитайте отново." };
  }

  revalidateTrainerViews();
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  redirect(`/trainer/trainings?booked=${encodeURIComponent(reference)}`);
}

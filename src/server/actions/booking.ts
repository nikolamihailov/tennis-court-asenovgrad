"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { sendBookingConfirmation } from "@/lib/mail";
import { fieldErrors, guestBookingSchema, userBookingSchema } from "@/lib/validation";
import { BookingError, createBooking, resolveGuestUser } from "@/server/bookings";

export type BookingFormState = {
  errors?: Record<string, string>;
  message?: string;
};

/**
 * Create a booking from the public booking form.
 *
 * Handles both flows. A signed-in user's identity comes from the session and the form's
 * name/email fields are ignored entirely — otherwise anyone could book in someone else's
 * name by editing the payload. A guest must supply their details, and gets (or reuses) a
 * User row keyed on email.
 */
export async function createBookingAction(
  _previous: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const currentUser = await getCurrentUser();

  const raw = {
    courtId: formData.get("courtId"),
    date: formData.get("date"),
    hour: formData.get("hour"),
    notes: formData.get("notes") || undefined,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
  };

  let userId: string;
  let bookedAsGuest: boolean;
  let slot: { courtId: string; date: string; hour: number; notes?: string };

  if (currentUser) {
    const parsed = userBookingSchema.safeParse(raw);
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    userId = currentUser.id;
    bookedAsGuest = false;
    slot = parsed.data;

    // A registered user may not have a phone on file yet; keep what they typed so the
    // club can reach them, but never overwrite a number they already have.
    if (parsed.data.phone && !currentUser.phone) {
      await db.user.update({
        where: { id: currentUser.id },
        data: { phone: parsed.data.phone },
      });
    }
  } else {
    const parsed = guestBookingSchema.safeParse(raw);
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    const guest = await resolveGuestUser({
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
    });

    userId = guest.id;
    bookedAsGuest = true;
    slot = parsed.data;
  }

  let reference: string;

  try {
    const booking = await createBooking(userId, { ...slot, bookedAsGuest });
    reference = booking.reference;

    // Awaited rather than fired and forgotten: on serverless the function can be frozen
    // the moment the response is sent, which would drop an un-awaited send. Delivery
    // failures are swallowed inside sendBookingConfirmation — the booking is already
    // committed and must not be reported as failed because email was down.
    await sendBookingConfirmation(booking);
  } catch (error) {
    if (error instanceof BookingError) {
      return { errors: { [error.field]: error.message }, message: error.message };
    }

    console.error("[booking] unexpected failure:", error);
    return {
      message: "Възникна неочаквана грешка. Моля, опитайте отново.",
    };
  }

  revalidatePath("/booking");
  redirect(`/booking/${reference}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { sendBookingRescheduled, sendCustomerCancellation } from "@/lib/mail";
import { absoluteUrl, bookingPath, manageBookingPath } from "@/lib/url";
import {
  customerCancelSchema,
  fieldErrors,
  rescheduleSchema,
} from "@/lib/validation";
import {
  authorizeBookingAccess,
  BookingError,
  cancelBooking,
  rescheduleBooking,
} from "@/server/bookings";

export type ManageFormState = {
  errors?: Record<string, string>;
  message?: string;
};

const NO_ACCESS: ManageFormState = {
  message: "Линкът е невалиден или изтекъл. Влезте в профила си или се свържете с клуба.",
};

/**
 * Customer self-service: cancel or move a booking from the email link or the profile.
 *
 * Each action re-checks access with authorizeBookingAccess() — the manage page having
 * done so proves nothing, because Server Actions accept direct POSTs. The reference in
 * the form only says *which* booking; the token or the session says *whether*.
 */

function revalidateBookingViews(reference: string) {
  revalidatePath("/booking");
  revalidatePath(`/booking/${reference}`);
  revalidatePath("/profile");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}

export async function customerCancelAction(
  _previous: ManageFormState,
  formData: FormData,
): Promise<ManageFormState> {
  const parsed = customerCancelSchema.safeParse({
    reference: formData.get("reference"),
    token: formData.get("token"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const user = await getCurrentUser();
  const booking = await authorizeBookingAccess(parsed.data.reference, {
    token: parsed.data.token,
    userId: user?.id,
  });
  if (!booking) return NO_ACCESS;

  try {
    const cancelled = await cancelBooking(booking.id, {
      reason: parsed.data.reason,
      by: "CUSTOMER",
    });
    await sendCustomerCancellation(cancelled);
  } catch (error) {
    if (error instanceof BookingError) return { message: error.message };

    console.error("[manage] cancel failed:", error);
    return { message: "Възникна неочаквана грешка. Моля, опитайте отново." };
  }

  revalidateBookingViews(booking.reference);
  redirect(
    bookingPath(booking.reference, { token: parsed.data.token, done: "cancelled" }),
  );
}

export async function rescheduleAction(
  _previous: ManageFormState,
  formData: FormData,
): Promise<ManageFormState> {
  const parsed = rescheduleSchema.safeParse({
    reference: formData.get("reference"),
    token: formData.get("token"),
    date: formData.get("date"),
    startMinute: formData.get("startMinute"),
    duration: formData.get("duration"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const user = await getCurrentUser();
  const booking = await authorizeBookingAccess(parsed.data.reference, {
    token: parsed.data.token,
    userId: user?.id,
  });
  if (!booking) return NO_ACCESS;

  // Rescheduling rotates the token, so the redirect must carry the new one.
  let newToken: string;

  try {
    const { booking: moved, manageToken } = await rescheduleBooking(booking.id, {
      date: parsed.data.date,
      startMinute: parsed.data.startMinute,
      duration: parsed.data.duration,
    });
    newToken = manageToken;

    // Awaited for the same reason as the booking confirmation: an un-awaited send can be
    // dropped when a serverless function freezes. Failures are swallowed inside.
    await sendBookingRescheduled(
      moved,
      absoluteUrl(manageBookingPath(moved.reference, manageToken)),
    );
  } catch (error) {
    if (error instanceof BookingError) {
      return { errors: { [error.field]: error.message }, message: error.message };
    }

    console.error("[manage] reschedule failed:", error);
    return { message: "Възникна неочаквана грешка. Моля, опитайте отново." };
  }

  revalidateBookingViews(booking.reference);
  redirect(bookingPath(booking.reference, { token: newToken, done: "moved" }));
}

"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";
import { sendBookingCancellation } from "@/lib/mail";
import { cancelBookingSchema, courtSchema, fieldErrors } from "@/lib/validation";
import { BookingError, cancelBooking } from "@/server/bookings";

export type AdminFormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
};

/**
 * Every action here calls requireAdmin() first.
 *
 * Server Actions are reachable by direct POST without going through an admin page, so
 * the proxy redirect and the admin layout are both irrelevant to their security. This is
 * the check that matters.
 */

function parseCourtForm(formData: FormData) {
  return courtSchema.safeParse({
    name: formData.get("name"),
    surface: formData.get("surface"),
    isIndoor: formData.get("isIndoor") === "on",
    pricePerHour: formData.get("pricePerHour"),
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    openingHour: formData.get("openingHour"),
    closingHour: formData.get("closingHour"),
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

/**
 * An emptied optional text field means "clear this", so it has to reach Prisma as `null`.
 * Passing `undefined` would make Prisma skip the column and silently keep the old value,
 * leaving the admin unable to remove a description or image once one is set.
 */
function withClearedOptionals<T extends { description?: string; imageUrl?: string }>(
  data: T,
) {
  return {
    ...data,
    description: data.description ?? null,
    imageUrl: data.imageUrl ?? null,
  };
}

export async function createCourtAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const parsed = parseCourtForm(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await db.court.create({ data: withClearedOptionals(parsed.data) });

  revalidatePath("/admin/courts");
  revalidatePath("/");
  return { ok: true, message: "Кортът е създаден." };
}

export async function updateCourtAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { message: "Липсва идентификатор на корт." };

  const parsed = parseCourtForm(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await db.court.update({ where: { id }, data: withClearedOptionals(parsed.data) });

  revalidatePath("/admin/courts");
  revalidatePath("/");
  return { ok: true, message: "Промените са запазени." };
}

/**
 * Deactivate rather than delete.
 *
 * Bookings reference the court with onDelete: Restrict, so deleting a court with history
 * would fail anyway. Deactivating hides it from customers while keeping past bookings
 * and their revenue intact in analytics.
 */
export async function setCourtActiveAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!id) return;

  await db.court.update({ where: { id }, data: { isActive } });

  revalidatePath("/admin/courts");
  revalidatePath("/");
}

/** Free a court by cancelling the booking on it, and tell the customer. */
export async function cancelBookingAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const parsed = cancelBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const booking = await cancelBooking(parsed.data.bookingId, parsed.data.reason);
    await sendBookingCancellation(booking);
  } catch (error) {
    if (error instanceof BookingError) return { message: error.message };

    console.error("[admin] cancel failed:", error);
    return { message: "Възникна неочаквана грешка." };
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { ok: true, message: "Резервацията е отказана." };
}

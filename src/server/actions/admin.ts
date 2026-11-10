"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";
import {
  sendBookingCancellation,
  sendTrainerSessionCancelled,
  sendTrainerWelcome,
} from "@/lib/mail";
import {
  cancelBookingSchema,
  courtSchema,
  fieldErrors,
  trainerRateSchema,
} from "@/lib/validation";
import {
  CourtImageError,
  deleteCourtImage,
  isUploadedFile,
  uploadCourtImage,
} from "@/lib/court-images";
import { BookingError, cancelBooking } from "@/server/bookings";
import {
  grantTrainerRole,
  revokeTrainerRole,
  setTrainerRate,
  TrainerError,
} from "@/server/trainers";

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
    price60: formData.get("price60"),
    price90: formData.get("price90"),
    price120: formData.get("price120"),
    description: formData.get("description"),
    openingHour: formData.get("openingHour"),
    closingHour: formData.get("closingHour"),
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

/**
 * An emptied optional text field means "clear this", so it has to reach Prisma as `null`.
 * Passing `undefined` would make Prisma skip the column and silently keep the old value,
 * leaving the admin unable to remove a description once one is set.
 */
function withClearedOptionals<T extends { description?: string }>(data: T) {
  return {
    ...data,
    description: data.description ?? null,
  };
}

/**
 * Upload the photo picked in the court form, if any.
 *
 * Runs only after the other fields have validated, so a typo in a price does not leave
 * an uploaded file behind with no court pointing at it.
 */
async function uploadPickedImage(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("image");
  if (!isUploadedFile(file)) return {};

  try {
    return { url: await uploadCourtImage(file) };
  } catch (error) {
    if (error instanceof CourtImageError) return { error: error.message };
    throw error;
  }
}

export async function createCourtAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const parsed = parseCourtForm(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const image = await uploadPickedImage(formData);
  if (image.error) return { errors: { image: image.error } };

  try {
    await db.court.create({
      data: { ...withClearedOptionals(parsed.data), imageUrl: image.url ?? null },
    });
  } catch (error) {
    // Nothing references the file if the row was never written.
    await deleteCourtImage(image.url);
    throw error;
  }

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

  const existing = await db.court.findUnique({ where: { id }, select: { imageUrl: true } });
  if (!existing) return { message: "Кортът не е намерен." };

  const image = await uploadPickedImage(formData);
  if (image.error) return { errors: { image: image.error } };

  // A new photo replaces the old one; otherwise "remove" clears it; otherwise the column
  // is left out of the update entirely and keeps whatever it held.
  const removeImage = formData.get("removeImage") === "on";
  const imageUrl = image.url ?? (removeImage ? null : undefined);

  try {
    await db.court.update({
      where: { id },
      data: { ...withClearedOptionals(parsed.data), imageUrl },
    });
  } catch (error) {
    await deleteCourtImage(image.url);
    throw error;
  }

  // Only once the row points elsewhere is the old file safe to delete.
  if (imageUrl !== undefined && existing.imageUrl !== imageUrl) {
    await deleteCourtImage(existing.imageUrl);
  }

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
    const booking = await cancelBooking(parsed.data.bookingId, {
      reason: parsed.data.reason,
      by: "CLUB",
    });
    await Promise.all([sendBookingCancellation(booking), sendTrainerSessionCancelled(booking)]);
  } catch (error) {
    if (error instanceof BookingError) return { message: error.message };

    console.error("[admin] cancel failed:", error);
    return { message: "Възникна неочаквана грешка." };
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  revalidatePath("/trainer", "layout");
  return { ok: true, message: "Резервацията е отказана." };
}

// ---------------------------------------------------------------------------
// Trainers
// ---------------------------------------------------------------------------

function revalidateTrainerViews() {
  revalidatePath("/admin/users");
  revalidatePath("/booking");
  revalidatePath("/");
}

/** Make a registered user a trainer at the given hourly rate, and email them. */
export async function grantTrainerAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const parsed = trainerRateSchema.safeParse({
    userId: formData.get("userId"),
    hourlyRate: formData.get("hourlyRate"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const user = await grantTrainerRole(parsed.data.userId, parsed.data.hourlyRate);
    await sendTrainerWelcome(user);
  } catch (error) {
    if (error instanceof TrainerError) return { message: error.message };
    console.error("[admin] grant trainer failed:", error);
    return { message: "Възникна неочаквана грешка." };
  }

  revalidateTrainerViews();
  return { ok: true, message: "Потребителят вече е треньор. Изпратихме му имейл." };
}

export async function setTrainerRateAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const parsed = trainerRateSchema.safeParse({
    userId: formData.get("userId"),
    hourlyRate: formData.get("hourlyRate"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await setTrainerRate(parsed.data.userId, parsed.data.hourlyRate);

  revalidateTrainerViews();
  return { ok: true, message: "Ставката е запазена." };
}

export async function revokeTrainerAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { message: "Липсва потребител." };

  try {
    await revokeTrainerRole(userId);
  } catch (error) {
    if (error instanceof TrainerError) return { message: error.message };
    console.error("[admin] revoke trainer failed:", error);
    return { message: "Възникна неочаквана грешка." };
  }

  revalidateTrainerViews();
  return { ok: true, message: "Ролята „треньор“ е премахната." };
}

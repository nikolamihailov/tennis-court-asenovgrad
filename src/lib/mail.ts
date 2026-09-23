import "server-only";

import { Resend } from "resend";

import { formatClubDateLong, formatClubTime, formatClubWeekday } from "./time";
import type { BookingDTO } from "@/server/bookings";

const FROM_FALLBACK = "Тенис клуб Асеновград <onboarding@resend.dev>";

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

function customerName(booking: BookingDTO): string {
  const full = [booking.user.firstName, booking.user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || booking.user.email;
}

function bookingConfirmationHtml(booking: BookingDTO): string {
  const rows: [string, string][] = [
    ["Номер на резервация", booking.reference],
    ["Корт", booking.court.name],
    ["Дата", `${formatClubWeekday(booking.startsAt)}, ${formatClubDateLong(booking.startsAt)}`],
    ["Час", `${formatClubTime(booking.startsAt)} – ${formatClubTime(booking.endsAt)}`],
    ["Цена", `${booking.totalPrice.toFixed(2)} лв.`],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="bg">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border-collapse:collapse;">
      <tr>
        <td style="background:#0f172a;padding:24px;">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">Тенис клуб Асеновград</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Резервацията е потвърдена</h1>
          <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
            Здравейте, ${escapeHtml(customerName(booking))}!<br />
            Вашият корт е запазен. Ето детайлите:
          </p>
          <table role="presentation" style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
          <p style="margin:20px 0 0;color:#475569;font-size:13px;line-height:1.6;">
            Моля, елате 10 минути по-рано. Ако се налага да отмените, свържете се с нас и
            посочете номера на резервацията.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;">
          Това е автоматично съобщение. Моля, не отговаряйте на него.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function bookingConfirmationText(booking: BookingDTO): string {
  return [
    `Здравейте, ${customerName(booking)}!`,
    "",
    "Вашата резервация е потвърдена.",
    "",
    `Номер: ${booking.reference}`,
    `Корт: ${booking.court.name}`,
    `Дата: ${formatClubWeekday(booking.startsAt)}, ${formatClubDateLong(booking.startsAt)}`,
    `Час: ${formatClubTime(booking.startsAt)} – ${formatClubTime(booking.endsAt)}`,
    `Цена: ${booking.totalPrice.toFixed(2)} лв.`,
    "",
    "Моля, елате 10 минути по-рано.",
    "Тенис клуб Асеновград",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send the booking confirmation.
 *
 * Never throws. A booking that is already committed must not be reported as failed
 * because an email provider had a bad minute — the caller logs and moves on. Without
 * RESEND_API_KEY the message is logged instead of sent, so local development and
 * preview deploys work without credentials.
 */
export async function sendBookingConfirmation(booking: BookingDTO): Promise<void> {
  const resend = getResend();
  const to = booking.user.email;

  if (!resend) {
    console.info(
      `[mail] RESEND_API_KEY not set — would have sent confirmation ${booking.reference} to ${to}`,
    );
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || FROM_FALLBACK,
      to,
      subject: `Резервация ${booking.reference} — Тенис клуб Асеновград`,
      html: bookingConfirmationHtml(booking),
      text: bookingConfirmationText(booking),
    });

    if (error) {
      console.error(`[mail] failed to send ${booking.reference} to ${to}:`, error);
    }
  } catch (error) {
    console.error(`[mail] failed to send ${booking.reference} to ${to}:`, error);
  }
}

/** Notify the customer that staff cancelled their booking. Never throws. */
export async function sendBookingCancellation(booking: BookingDTO): Promise<void> {
  const resend = getResend();
  const to = booking.user.email;

  const lines = [
    `Здравейте, ${customerName(booking)}!`,
    "",
    `Вашата резервация ${booking.reference} за ${booking.court.name} на ` +
      `${formatClubDateLong(booking.startsAt)} в ${formatClubTime(booking.startsAt)} ` +
      "беше отказана.",
  ];

  if (booking.cancellationReason) {
    lines.push("", `Причина: ${booking.cancellationReason}`);
  }

  lines.push("", "Извиняваме се за неудобството.", "Тенис клуб Асеновград");

  const text = lines.join("\n");

  if (!resend) {
    console.info(
      `[mail] RESEND_API_KEY not set — would have sent cancellation ${booking.reference} to ${to}`,
    );
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || FROM_FALLBACK,
      to,
      subject: `Отказана резервация ${booking.reference}`,
      text,
    });

    if (error) {
      console.error(`[mail] failed to send cancellation ${booking.reference}:`, error);
    }
  } catch (error) {
    console.error(`[mail] failed to send cancellation ${booking.reference}:`, error);
  }
}

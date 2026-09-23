import "server-only";

import { formatClubDateLong, formatClubTime, formatClubWeekday } from "./time";
import { formatEur, LIGHTING_PRICE, RACKET_PRICE } from "./pricing";
import type { BookingDTO } from "@/server/bookings";

/**
 * Transactional email via SendGrid.
 *
 * SendGrid is used rather than Resend because it can verify a single *address* instead of
 * requiring a whole domain, which lets the club send from an existing mailbox without
 * owning a domain yet. The trade-off is real: mail sent from a free provider's domain
 * (abv.bg, gmail.com) through a third party fails SPF alignment, so some of it lands in
 * spam. When the club has its own domain, verifying it — here or back on Resend — is the
 * proper fix.
 *
 * SENDGRID_FROM_EMAIL must be exactly the address verified under Single Sender
 * Verification. SendGrid rejects anything else with a 403.
 */
const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

const DEFAULT_FROM_NAME = "Тенис клуб Асеновград";

type Message = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Send one message. Returns an error string, or null on success.
 *
 * Deliberately returns rather than throws: a booking is already committed by the time
 * this runs, and must never be reported to the customer as failed because email was down.
 */
async function send(message: Message): Promise<string | null> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !from) {
    console.info(
      `[mail] SENDGRID_API_KEY/SENDGRID_FROM_EMAIL not set — would have sent "${message.subject}" to ${message.to}`,
    );
    return null;
  }

  // SendGrid requires text/plain before text/html in the content array.
  const content: { type: string; value: string }[] = [
    { type: "text/plain", value: message.text },
  ];
  if (message.html) content.push({ type: "text/html", value: message.html });

  try {
    const response = await fetch(SENDGRID_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: {
          email: from,
          name: process.env.SENDGRID_FROM_NAME || DEFAULT_FROM_NAME,
        },
        subject: message.subject,
        content,
      }),
    });

    // A successful send is 202 with an empty body.
    if (response.ok) return null;

    const body = await response.text();
    return `${response.status} ${response.statusText} ${body}`.trim();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The chargeable extras, as label/value rows. Empty when the customer added none. */
function bookingExtraRows(booking: BookingDTO): [string, string][] {
  const rows: [string, string][] = [];

  if (booking.racketCount > 0) {
    rows.push([
      `Ракети (${booking.racketCount} бр.)`,
      formatEur(booking.racketCount * RACKET_PRICE),
    ]);
  }

  if (booking.lighting) {
    rows.push(["Осветление", formatEur(LIGHTING_PRICE)]);
  }

  return rows;
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
    ...bookingExtraRows(booking),
    ["Общо за плащане", formatEur(booking.totalPrice)],
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
    ...bookingExtraRows(booking).map(([label, value]) => `${label}: ${value}`),
    `Общо за плащане: ${formatEur(booking.totalPrice)}`,
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
 * Never throws. The booking is already committed by the time this runs, so a provider
 * outage must not surface to the customer as a failed booking. Failures are logged with
 * the reference so they can be found later in the runtime logs.
 */
export async function sendBookingConfirmation(booking: BookingDTO): Promise<void> {
  const error = await send({
    to: booking.user.email,
    subject: `Резервация ${booking.reference} — Тенис клуб Асеновград`,
    text: bookingConfirmationText(booking),
    html: bookingConfirmationHtml(booking),
  });

  if (error) {
    console.error(
      `[mail] failed to send confirmation ${booking.reference} to ${booking.user.email}: ${error}`,
    );
  }
}

/** Notify the customer that staff cancelled their booking. Never throws. */
export async function sendBookingCancellation(booking: BookingDTO): Promise<void> {
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

  const error = await send({
    to: booking.user.email,
    subject: `Отказана резервация ${booking.reference}`,
    text: lines.join("\n"),
  });

  if (error) {
    console.error(
      `[mail] failed to send cancellation ${booking.reference} to ${booking.user.email}: ${error}`,
    );
  }
}

import "server-only";

import { formatClubDateLong, formatClubTime, formatClubWeekday } from "./time";
import { formatEur, LIGHTING_PRICE, RACKET_PRICE } from "./pricing";
import { absoluteUrl } from "./url";
import { displayEmail, isPlaceholderEmail } from "./contact";
import type { BookingDTO } from "@/server/bookings";

/**
 * Transactional email via Brevo.
 *
 * Brevo verifies a single sender *address* rather than a whole domain, which is what the
 * club needs while it does not own one. Sent over Brevo's HTTP API rather than its SMTP
 * relay: no dependency, no TLS handshake per message, and no connection pooling to reason
 * about on serverless, where the process may be frozen between requests.
 *
 * The deliverability caveat still applies. Mail claiming to be from a free provider's
 * domain (abv.bg) but sent through Brevo fails SPF alignment, so some of it will land in
 * spam. Verifying a real domain — in Brevo, under Senders, Domains & Dedicated IPs — is
 * the fix once the club has one, and needs no code change.
 */
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

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
  // A student booked by their trainer without an email has a placeholder address. There
  // is nobody to deliver to, and that is not a failure. See src/lib/contact.ts.
  if (isPlaceholderEmail(message.to)) return null;

  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM_EMAIL;

  if (!apiKey || !from) {
    console.info(
      `[mail] BREVO_API_KEY/BREVO_FROM_EMAIL not set — would have sent "${message.subject}" to ${message.to}`,
    );
    return null;
  }

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: from,
          name: process.env.MAIL_FROM_NAME || DEFAULT_FROM_NAME,
        },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        ...(message.html ? { htmlContent: message.html } : {}),
      }),
    });

    // A successful send is 201 with a messageId.
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

  if (booking.trainer && booking.trainerFee !== null) {
    rows.push([`Треньор (${booking.durationMinutes} мин)`, formatEur(booking.trainerFee)]);
  }

  return rows;
}

function personName(person: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return full || displayEmail(person.email) || "клиент";
}

function customerName(booking: BookingDTO): string {
  return personName(booking.user);
}

/**
 * The parts of a booking email that vary. Every booking email — confirmed, moved,
 * cancelled — shares one layout, so they all read as coming from the same club.
 */
type BookingEmailCopy = {
  heading: string;
  intro: string;
  /** Red "cancelled" treatment: a status pill, struck-through details, nothing to pay. */
  cancelled?: boolean;
  /** Shown in its own box under the details, e.g. why the club cancelled. */
  reason?: string;
  /** The call-to-action button. */
  action?: { label: string; url: string };
  /** Small print under the button. */
  note?: string;
  /**
   * True when `action` is the tokenised manage link. The footer then warns against
   * forwarding the email, since anyone holding it can change the booking.
   */
  secretLink?: boolean;
  /**
   * Written to the trainer rather than the customer: greets the trainer, and shows who
   * the customer is and the trainer's fee instead of what the customer pays.
   */
  toTrainer?: boolean;
};

function bookingDetailRows(booking: BookingDTO, copy: BookingEmailCopy): [string, string][] {
  const rows: [string, string][] = [
    ["Номер на резервация", booking.reference],
    ["Корт", booking.court.name],
    ["Дата", `${formatClubWeekday(booking.startsAt)}, ${formatClubDateLong(booking.startsAt)}`],
    ["Час", `${formatClubTime(booking.startsAt)} – ${formatClubTime(booking.endsAt)}`],
  ];

  if (copy.toTrainer) {
    rows.push(["Клиент", customerName(booking)]);
    if (booking.user.phone) rows.push(["Телефон", booking.user.phone]);
    if (!copy.cancelled && booking.trainerFee !== null) {
      rows.push(["Хонорар", formatEur(booking.trainerFee)]);
    }
    return rows;
  }

  if (booking.trainer) rows.push(["Треньор", personName(booking.trainer)]);

  // A cancelled booking owes nothing, so the extras and the total would only confuse.
  if (!copy.cancelled) {
    rows.push(...bookingExtraRows(booking), ["Общо за плащане", formatEur(booking.totalPrice)]);
  }

  return rows;
}

function greetingName(booking: BookingDTO, copy: BookingEmailCopy): string {
  return copy.toTrainer && booking.trainer ? personName(booking.trainer) : customerName(booking);
}

/** The club's email frame: dark header, white card, grey footer. */
function emailFrame(bodyHtml: string, footer: string): string {
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
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;">
          ${escapeHtml(footer)}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buttonHtml(action: { label: string; url: string }): string {
  return `<p style="margin:24px 0 0;text-align:center;">
            <a href="${escapeHtml(action.url)}" style="display:inline-block;background:#22c55e;color:#0f172a;font-size:14px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:10px;">
              ${escapeHtml(action.label)}
            </a>
          </p>`;
}

const AUTOMATED_FOOTER = "Това е автоматично съобщение. Моля, не отговаряйте на него.";

function bookingEmailHtml(booking: BookingDTO, copy: BookingEmailCopy): string {
  const valueStyle = copy.cancelled
    ? "color:#64748b;text-decoration:line-through;"
    : "color:#0f172a;";

  const rowsHtml = bookingDetailRows(booking, copy)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;${valueStyle}font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const statusHtml = copy.cancelled
    ? `<p style="margin:0 0 12px;"><span style="display:inline-block;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;">Отказана</span></p>`
    : "";

  const reasonHtml = copy.reason
    ? `<p style="margin:20px 0 0;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#991b1b;font-size:14px;line-height:1.5;"><strong>Причина:</strong> ${escapeHtml(copy.reason)}</p>`
    : "";

  const actionHtml = copy.action ? buttonHtml(copy.action) : "";

  const noteHtml = copy.note
    ? `<p style="margin:20px 0 0;color:#475569;font-size:13px;line-height:1.6;">${escapeHtml(copy.note)}</p>`
    : "";

  const footer =
    AUTOMATED_FOOTER +
    (copy.secretLink
      ? " Не препращайте този имейл — линкът в него позволява промяна на резервацията."
      : "");

  return emailFrame(
    `${statusHtml}
          <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${escapeHtml(copy.heading)}</h1>
          <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
            Здравейте, ${escapeHtml(greetingName(booking, copy))}!<br />
            ${escapeHtml(copy.intro)}
          </p>
          <table role="presentation" style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
          ${reasonHtml}
          ${actionHtml}
          ${noteHtml}`,
    footer,
  );
}

/** The plain-text part, for clients that do not render HTML. Same content, same order. */
function bookingEmailText(booking: BookingDTO, copy: BookingEmailCopy): string {
  const lines = [
    `Здравейте, ${greetingName(booking, copy)}!`,
    "",
    copy.intro,
    "",
    ...bookingDetailRows(booking, copy).map(([label, value]) => `${label}: ${value}`),
  ];

  if (copy.reason) lines.push("", `Причина: ${copy.reason}`);
  if (copy.action) lines.push("", `${copy.action.label}:`, copy.action.url);
  if (copy.note) lines.push("", copy.note);

  lines.push("", "Тенис клуб Асеновград");
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send one booking email in the shared layout.
 *
 * Never throws. By the time this runs the booking change is already committed, so a
 * provider outage must not surface to the customer as a failed action. Failures are
 * logged with the reference so they can be found later in the runtime logs.
 *
 * Goes to the customer, or to the trainer when `copy.toTrainer` is set.
 */
async function sendBookingEmail(
  booking: BookingDTO,
  kind: string,
  subject: string,
  copy: BookingEmailCopy,
): Promise<void> {
  const to = copy.toTrainer ? booking.trainer?.email : booking.user.email;
  if (!to) return;

  const error = await send({
    to,
    subject,
    text: bookingEmailText(booking, copy),
    html: bookingEmailHtml(booking, copy),
  });

  if (error) {
    console.error(`[mail] failed to send ${kind} ${booking.reference} to ${to}: ${error}`);
  }
}

const MANAGE_NOTE =
  "Моля, елате 10 минути по-рано. Можете да откажете или преместите резервацията до 2 часа " +
  "преди началото. След това се свържете с нас и посочете номера ѝ.";

/** Send the booking confirmation, with the manage link. Never throws. */
export async function sendBookingConfirmation(
  booking: BookingDTO,
  manageUrl: string,
): Promise<void> {
  await sendBookingEmail(
    booking,
    "confirmation",
    `Резервация ${booking.reference} — Тенис клуб Асеновград`,
    {
      heading: "Резервацията е потвърдена",
      intro: "Вашият корт е запазен. Ето детайлите:",
      action: { label: "Откажи или премести резервацията", url: manageUrl },
      note: MANAGE_NOTE,
      secretLink: true,
    },
  );
}

/**
 * Confirm a customer's move to a new time. Never throws.
 *
 * Carries the new manage link: rescheduling rotates the token, so the link in the
 * original email no longer works.
 */
export async function sendBookingRescheduled(
  booking: BookingDTO,
  manageUrl: string,
): Promise<void> {
  await sendBookingEmail(
    booking,
    "reschedule",
    `Преместена резервация ${booking.reference} — Тенис клуб Асеновград`,
    {
      heading: "Резервацията е преместена",
      intro: "Преместихме резервацията Ви. Ето новите детайли:",
      action: { label: "Откажи или премести резервацията", url: manageUrl },
      note: MANAGE_NOTE,
      secretLink: true,
    },
  );
}

/** Confirm that the customer's own cancellation went through. Never throws. */
export async function sendCustomerCancellation(booking: BookingDTO): Promise<void> {
  await sendBookingEmail(
    booking,
    "customer cancellation",
    `Отказана резервация ${booking.reference} — Тенис клуб Асеновград`,
    {
      heading: "Резервацията е отказана",
      intro: "Отказахте резервацията си и кортът е освободен. Ето какво отказахте:",
      cancelled: true,
      action: { label: "Резервирай нов час", url: absoluteUrl("/booking") },
      note: "Ще се радваме да Ви видим отново на корта.",
    },
  );
}

/** Notify the customer that staff cancelled their booking. Never throws. */
export async function sendBookingCancellation(booking: BookingDTO): Promise<void> {
  await sendBookingEmail(
    booking,
    "cancellation",
    `Отказана резервация ${booking.reference} — Тенис клуб Асеновград`,
    {
      heading: "Резервацията е отказана",
      intro: "За съжаление клубът отказа следната резервация:",
      cancelled: true,
      reason: booking.cancellationReason ?? undefined,
      action: { label: "Избери друг час", url: absoluteUrl("/booking") },
      note: "Извиняваме се за неудобството. При въпроси, моля, свържете се с клуба.",
    },
  );
}

/** Tell the customer their trainer cancelled the session. Never throws. */
export async function sendTrainerCancellation(booking: BookingDTO): Promise<void> {
  await sendBookingEmail(
    booking,
    "trainer cancellation",
    `Отказана тренировка ${booking.reference} — Тенис клуб Асеновград`,
    {
      heading: "Тренировката е отказана",
      intro:
        "За съжаление треньорът отказа следната тренировка. Резервацията на корта също е отменена:",
      cancelled: true,
      reason: booking.cancellationReason ?? undefined,
      action: { label: "Избери друг час", url: absoluteUrl("/booking") },
      note: "Извиняваме се за неудобството. При въпроси, моля, свържете се с клуба.",
    },
  );
}

// ---------------------------------------------------------------------------
// To the trainer
// ---------------------------------------------------------------------------

const TRAINER_DASHBOARD_ACTION = () => ({
  label: "Към треньорския панел",
  url: absoluteUrl("/trainer/trainings"),
});

/** A customer booked a session with the trainer. Never throws. */
export async function sendTrainerNewSession(booking: BookingDTO): Promise<void> {
  if (!booking.trainer) return;
  await sendBookingEmail(booking, "trainer new session", `Нова тренировка ${booking.reference}`, {
    heading: "Нова тренировка",
    intro: "Имате нова тренировка. Ето детайлите:",
    action: TRAINER_DASHBOARD_ACTION(),
    toTrainer: true,
  });
}

/** A customer moved their session to another time. Never throws. */
export async function sendTrainerSessionMoved(booking: BookingDTO): Promise<void> {
  if (!booking.trainer) return;
  await sendBookingEmail(
    booking,
    "trainer session moved",
    `Преместена тренировка ${booking.reference}`,
    {
      heading: "Тренировката е преместена",
      intro: "Клиентът премести тренировката си. Ето новите детайли:",
      action: TRAINER_DASHBOARD_ACTION(),
      toTrainer: true,
    },
  );
}

/**
 * A session with the trainer was cancelled by the customer or the club. Not sent when the
 * trainer cancelled it themselves — they already know. Never throws.
 */
export async function sendTrainerSessionCancelled(booking: BookingDTO): Promise<void> {
  if (!booking.trainer) return;
  await sendBookingEmail(
    booking,
    "trainer session cancelled",
    `Отказана тренировка ${booking.reference}`,
    {
      heading: "Тренировката е отказана",
      intro:
        booking.cancelledBy === "CUSTOMER"
          ? "Клиентът отказа тренировката. Часът Ви е свободен:"
          : "Клубът отказа тренировката. Часът Ви е свободен:",
      cancelled: true,
      reason: booking.cancellationReason ?? undefined,
      action: TRAINER_DASHBOARD_ACTION(),
      toTrainer: true,
    },
  );
}

/**
 * Tell someone an admin made them a trainer, and where to go next. Never throws — the
 * role is already granted, and a mail outage must not make the admin think it was not.
 */
export async function sendTrainerWelcome(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): Promise<void> {
  const name = personName(user);
  const dashboardUrl = absoluteUrl("/trainer");
  const intro =
    "Администраторът на клуба Ви добави като треньор. Влезте с досегашния си профил — " +
    "ще видите треньорския панел, където задавате работните си часове, виждате " +
    "тренировките си и можете да ги откажете.";
  const note =
    "Първа стъпка: задайте работните си часове в „График“. Докато няма часове, " +
    "клиентите не могат да запишат тренировка с Вас.";

  const html = emailFrame(
    `<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Вече сте треньор в клуба</h1>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
            Здравейте, ${escapeHtml(name)}!<br />
            ${escapeHtml(intro)}
          </p>
          ${buttonHtml({ label: "Към треньорския панел", url: dashboardUrl })}
          <p style="margin:20px 0 0;color:#475569;font-size:13px;line-height:1.6;">${escapeHtml(note)}</p>`,
    AUTOMATED_FOOTER,
  );

  const text = [
    `Здравейте, ${name}!`,
    "",
    intro,
    "",
    "Към треньорския панел:",
    dashboardUrl,
    "",
    note,
    "",
    "Тенис клуб Асеновград",
  ].join("\n");

  const error = await send({
    to: user.email,
    subject: "Вече сте треньор — Тенис клуб Асеновград",
    text,
    html,
  });

  if (error) console.error(`[mail] failed to send trainer welcome to ${user.email}: ${error}`);
}

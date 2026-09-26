import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import ManageBooking from "@/components/booking/ManageBooking";
import { getCurrentUser } from "@/lib/dal";
import { isBookingDuration } from "@/lib/pricing";
import {
  addDaysToIsoDate,
  clubDateParts,
  clubToday,
  formatClubDateLong,
  formatClubTime,
  formatClubWeekday,
  isValidIsoDate,
  toClubIsoDate,
} from "@/lib/time";
import { manageBookingPath } from "@/lib/url";
import { BOOKING_HORIZON_DAYS, getAvailability } from "@/server/availability";
import { authorizeBookingAccess } from "@/server/bookings";

export const metadata: Metadata = {
  title: "Промяна на резервация — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
  // The URL carries the secret token. Never send it to another site as a Referer.
  referrer: "no-referrer",
};

export default async function ManageBookingPage({
  params,
  searchParams,
}: PageProps<"/booking/[reference]/manage">) {
  const { reference } = await params;
  const query = await searchParams;
  const token = typeof query.t === "string" ? query.t : undefined;

  const user = await getCurrentUser();
  const booking = await authorizeBookingAccess(reference, { token, userId: user?.id });

  if (!booking) {
    return <NoAccess signedIn={Boolean(user)} reference={reference} />;
  }

  const today = clubToday();
  const maxDate = addDaysToIsoDate(today, BOOKING_HORIZON_DAYS);
  const bookingDate = toClubIsoDate(booking.startsAt);

  // Start on the booking's own day, where the customer can most easily nudge it. Clamp a
  // hand-edited date rather than erroring, as the booking page does.
  const requested = typeof query.date === "string" ? query.date : undefined;
  const date =
    requested && isValidIsoDate(requested) && requested >= today && requested <= maxDate
      ? requested
      : bookingDate >= today
        ? bookingDate
        : today;

  // Only this court — moving to another court is a new booking — and without this
  // booking, so its own time reads as free and it can shift by half an hour.
  const availability = booking.customerCanChange
    ? await getAvailability(date, {
        courtId: booking.court.id,
        excludeBookingId: booking.id,
      })
    : [];

  const { hour, minute } = clubDateParts(booking.startsAt);
  const currentDuration = isBookingDuration(booking.durationMinutes)
    ? booking.durationMinutes
    : 60;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold">Промяна на резервация</h1>
        <p className="mt-1 text-white/60">
          Откажи или премести резервацията си до 2 часа преди началото.
        </p>
      </header>

      <ManageBooking
        reference={booking.reference}
        token={token}
        status={booking.status}
        customerCanChange={booking.customerCanChange}
        hasEnded={booking.hasEnded}
        summary={{
          courtName: booking.court.name,
          dateLabel: `${formatClubWeekday(booking.startsAt)}, ${formatClubDateLong(booking.startsAt)}`,
          timeLabel: `${formatClubTime(booking.startsAt)} – ${formatClubTime(booking.endsAt)}`,
          totalPrice: booking.totalPrice,
          racketCount: booking.racketCount,
          lighting: booking.lighting,
          isIndoor: booking.court.isIndoor,
        }}
        court={availability[0] ?? null}
        date={date}
        minDate={today}
        maxDate={maxDate}
        current={
          date === bookingDate
            ? { start: hour * 60 + minute, duration: currentDuration }
            : null
        }
        initialDuration={currentDuration}
      />
    </div>
  );
}

function NoAccess({ signedIn, reference }: { signedIn: boolean; reference: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-white/10 bg-navy-800 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-400">
          <ShieldAlert size={24} />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Линкът не е валиден</h1>
        <p className="mt-2 text-white/60">
          {signedIn
            ? "Тази резервация не е в твоя профил. Ако линкът е от имейл, отвори последния получен — при преместване изпращаме нов."
            : "Линкът може да е остарял — при преместване на резервация изпращаме нов. Ако имаш профил, влез и управлявай резервациите си оттам."}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {!signedIn && (
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(manageBookingPath(reference))}`}
              className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
            >
              Вход
            </Link>
          )}
          <Link
            href="/"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:text-white"
          >
            Към началото
          </Link>
        </div>
      </div>
    </div>
  );
}

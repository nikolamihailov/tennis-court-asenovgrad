import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Lock, Mail } from "lucide-react";

import { formatEur } from "@/lib/pricing";
import {
  formatClubDateLong,
  formatClubTime,
  formatClubWeekday,
} from "@/lib/time";
import { getCurrentUser } from "@/lib/dal";
import { manageBookingPath } from "@/lib/url";
import { authorizeBookingAccess, getBookingByReference } from "@/server/bookings";

export const metadata: Metadata = {
  title: "Потвърдена резервация — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
  // The URL can carry the secret manage token. Never send it to another site as a Referer.
  referrer: "no-referrer",
};

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: PageProps<"/booking/[reference]">) {
  const { reference } = await params;
  const { done, t } = await searchParams;
  const token = typeof t === "string" ? t : undefined;
  const user = await getCurrentUser();

  // The reference alone shows only what the court sheet would: court, time, status.
  // Who booked, what they pay and why it was cancelled need the secret link from the
  // email or the owner's session — the same check as the manage page. References are
  // short and read out over the phone, so they cannot be what guards personal data.
  const privateView = await authorizeBookingAccess(reference, {
    token,
    userId: user?.id,
  });
  const booking = privateView ?? (await getBookingByReference(reference));

  if (!booking) notFound();

  // Staff see everything in the admin panel anyway, so hiding it here would only get in
  // their way when they open a customer's link.
  const showPrivate = privateView !== null || user?.role === "ADMIN";

  const cancelled = booking.status === "CANCELLED";
  const moved = done === "moved" && !cancelled;

  // Offered to whoever may act on the booking: the owner's session, or the token holder,
  // whose token is passed on so the manage page can check it again.
  const canManage = privateView !== null && booking.customerCanChange;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-white/10 bg-navy-800 p-8">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            cancelled ? "bg-red-500/15 text-red-400" : "bg-brand-500/15 text-brand-400"
          }`}
        >
          <CalendarCheck size={24} />
        </div>

        <h1 className="mt-5 text-2xl font-bold">
          {cancelled
            ? "Резервацията е отказана"
            : moved
              ? "Резервацията е преместена"
              : "Резервацията е потвърдена"}
        </h1>
        <p className="mt-1 text-white/60">
          {cancelled
            ? done === "cancelled"
              ? "Кортът е освободен. Изпратихме потвърждение на имейла ти."
              : "Тази резервация вече не е активна."
            : moved
              ? "Изпратихме новите детайли и нов линк за промяна на имейла ти."
              : "Очакваме те на корта. Моля, ела 10 минути по-рано."}
        </p>

        <dl className="mt-6 space-y-2 rounded-xl bg-navy-900 p-5 text-sm">
          <Row label="Номер" value={booking.reference} mono />
          <Row label="Корт" value={booking.court.name} />
          <Row
            label="Дата"
            value={`${formatClubWeekday(booking.startsAt)}, ${formatClubDateLong(booking.startsAt)}`}
          />
          <Row
            label="Час"
            value={`${formatClubTime(booking.startsAt)} – ${formatClubTime(booking.endsAt)}`}
          />
          {showPrivate && (
            <>
              {booking.racketCount > 0 && (
                <Row label="Ракети" value={`${booking.racketCount} бр.`} />
              )}
              {booking.lighting && <Row label="Осветление" value="включено" />}
              <Row label="Общо" value={formatEur(booking.totalPrice)} />
              <Row
                label="На името на"
                value={
                  [booking.user.firstName, booking.user.lastName]
                    .filter(Boolean)
                    .join(" ") || booking.user.email
                }
              />
            </>
          )}
        </dl>

        {!showPrivate && (
          <p className="mt-4 flex items-start gap-2 text-sm text-white/50">
            <Lock size={16} className="mt-0.5 shrink-0" />
            Личните данни и цената се виждат само чрез линка от имейла с потвърждението
            или след вход в профила.
          </p>
        )}

        {showPrivate && cancelled && booking.cancellationReason && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Причина: {booking.cancellationReason}
          </p>
        )}

        {showPrivate && !cancelled && (
          <p className="mt-4 flex items-start gap-2 text-sm text-white/50">
            <Mail size={16} className="mt-0.5 shrink-0" />
            Изпратихме потвърждение на {booking.user.email}. Запази номера на
            резервацията — с него можем да я намерим.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {canManage && (
            <Link
              href={manageBookingPath(booking.reference, token)}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:text-white"
            >
              Премести или откажи
            </Link>
          )}
          <Link
            href="/booking"
            className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
          >
            Нова резервация
          </Link>
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

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/50">{label}</dt>
      <dd className={`font-medium ${mono ? "font-mono tracking-wide" : ""}`}>{value}</dd>
    </div>
  );
}

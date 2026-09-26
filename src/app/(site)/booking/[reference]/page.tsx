import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Mail } from "lucide-react";

import { formatEur } from "@/lib/pricing";
import {
  formatClubDateLong,
  formatClubTime,
  formatClubWeekday,
} from "@/lib/time";
import { getCurrentUser } from "@/lib/dal";
import { manageBookingPath } from "@/lib/url";
import { getBookingByReference } from "@/server/bookings";

export const metadata: Metadata = {
  title: "Потвърдена резервация — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
};

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: PageProps<"/booking/[reference]">) {
  const { reference } = await params;
  const { done } = await searchParams;
  const [booking, user] = await Promise.all([
    getBookingByReference(reference),
    getCurrentUser(),
  ]);

  if (!booking) notFound();

  const cancelled = booking.status === "CANCELLED";
  const moved = done === "moved" && !cancelled;

  // This page is public by reference, so the manage link is only offered to the signed-in
  // owner. Everyone else manages through the tokenised link in their email.
  const canManage = user?.id === booking.user.id && booking.customerCanChange;

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
        </dl>

        {cancelled && booking.cancellationReason && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Причина: {booking.cancellationReason}
          </p>
        )}

        {!cancelled && (
          <p className="mt-4 flex items-start gap-2 text-sm text-white/50">
            <Mail size={16} className="mt-0.5 shrink-0" />
            Изпратихме потвърждение на {booking.user.email}. Запази номера на
            резервацията — с него можем да я намерим.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {canManage && (
            <Link
              href={manageBookingPath(booking.reference)}
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

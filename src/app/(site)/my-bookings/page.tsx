import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/dal";
import { formatClubDateLong, formatClubTime, formatClubWeekday } from "@/lib/time";
import { listUserBookingsGrouped, type BookingDTO } from "@/server/bookings";

export const metadata: Metadata = {
  title: "Моите резервации — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
};

export default async function MyBookingsPage() {
  const user = await requireUser();
  const { upcoming, past } = await listUserBookingsGrouped(user.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Моите резервации</h1>
      <p className="mt-1 text-white/60">
        За отказване на резервация се свържи с клуба и посочи номера ѝ.
      </p>

      <Section title="Предстоящи" bookings={upcoming} empty="Нямаш предстоящи резервации." />
      <Section title="Минали" bookings={past} empty="Все още нямаш история." />
    </div>
  );
}

function Section({
  title,
  bookings,
  empty,
}: {
  title: string;
  bookings: BookingDTO[];
  empty: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">
        {title}
      </h2>

      {bookings.length === 0 ? (
        <p className="mt-3 rounded-xl border border-white/5 bg-navy-800 p-5 text-sm text-white/50">
          {empty}{" "}
          <Link href="/booking" className="text-brand-400 hover:text-brand-300">
            Резервирай корт
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-navy-800 p-5"
            >
              <div>
                <p className="font-semibold">{booking.court.name}</p>
                <p className="mt-0.5 text-sm text-white/60">
                  {formatClubWeekday(booking.startsAt)},{" "}
                  {formatClubDateLong(booking.startsAt)} ·{" "}
                  {formatClubTime(booking.startsAt)} –{" "}
                  {formatClubTime(booking.endsAt)}
                </p>
                <p className="mt-1 font-mono text-xs tracking-wide text-white/35">
                  {booking.reference}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold">
                  {booking.totalPrice.toFixed(2)} лв.
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    booking.status === "CANCELLED"
                      ? "bg-red-500/15 text-red-300"
                      : "bg-brand-500/15 text-brand-400"
                  }`}
                >
                  {booking.status === "CANCELLED" ? "Отказана" : "Потвърдена"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

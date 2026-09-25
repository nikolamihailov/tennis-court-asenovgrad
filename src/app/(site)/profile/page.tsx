import type { Metadata } from "next";
import Link from "next/link";

import ProfileForm from "@/components/account/ProfileForm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { formatEur } from "@/lib/pricing";
import { formatClubDateLong, formatClubTime, formatClubWeekday } from "@/lib/time";
import { listUserBookingsGrouped, type BookingDTO } from "@/server/bookings";

export const metadata: Metadata = {
  title: "Моят профил — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await requireUser();

  // Read the row rather than the session: the JWT only refreshes its copy every few
  // minutes, so a profile just saved would otherwise still show the old name.
  const [account, bookings] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: session.id },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        accounts: { select: { provider: true } },
      },
    }),
    listUserBookingsGrouped(session.id),
  ]);

  const isGoogleAccount = account.accounts.some((a) => a.provider === "google");

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold">Моят профил</h1>
        <p className="mt-1 text-white/60">
          Данните ти и всички резервации на едно място.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-white/10 bg-navy-800 p-6">
        <h2 className="font-semibold">Лични данни</h2>
        <p className="mt-1 text-sm text-white/50">
          Използваме ги, за да те разпознаем при резервация.
        </p>

        <div className="mt-5">
          <ProfileForm
            firstName={account.firstName}
            lastName={account.lastName}
            email={account.email}
            phone={account.phone}
            isGoogleAccount={isGoogleAccount}
          />
        </div>
      </section>

      <Section
        title="Предстоящи резервации"
        bookings={bookings.upcoming}
        empty="Нямаш предстоящи резервации."
      />
      <Section
        title="Минали резервации"
        bookings={bookings.past}
        empty="Все още нямаш история."
      />

      <p className="mt-10 text-xs text-white/35">
        За отказване на резервация се свържи с клуба и посочи номера ѝ.
      </p>
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
    <section className="mt-10">
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
                  {formatClubTime(booking.startsAt)} – {formatClubTime(booking.endsAt)}
                </p>
                <p className="mt-1 font-mono text-xs tracking-wide text-white/35">
                  {booking.reference}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold">
                  {formatEur(booking.totalPrice)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    booking.status === "CANCELLED"
                      ? "bg-red-500/15 text-red-300"
                      : booking.hasEnded
                        ? "bg-white/10 text-white/60"
                        : "bg-brand-500/15 text-brand-400"
                  }`}
                >
                  {booking.status === "CANCELLED"
                    ? "Отказана"
                    : booking.hasEnded
                      ? "Приключила"
                      : "Потвърдена"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

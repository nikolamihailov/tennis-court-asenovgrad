import Link from "next/link";

import CancelBookingButton from "@/components/admin/CancelBookingButton";
import { requireAdmin } from "@/lib/dal";
import { formatClubDateShort, formatClubTime, formatClubWeekday } from "@/lib/time";
import { listBookings } from "@/server/bookings";
import { listAllCourts } from "@/server/courts";
import type { BookingStatus } from "@/generated/prisma/enums";

const STATUS_FILTERS = [
  { value: "upcoming", label: "Предстоящи" },
  { value: "CONFIRMED", label: "Потвърдени" },
  { value: "CANCELLED", label: "Отказани" },
  { value: "all", label: "Всички" },
] as const;

export default async function AdminBookingsPage({
  searchParams,
}: PageProps<"/admin/bookings">) {
  await requireAdmin();

  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "upcoming";
  const courtId = typeof params.courtId === "string" ? params.courtId : undefined;
  const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;

  const [bookings, courts] = await Promise.all([
    listBookings({
      status:
        status === "CONFIRMED" || status === "CANCELLED"
          ? (status as BookingStatus)
          : status === "upcoming"
            ? "CONFIRMED"
            : undefined,
      from: status === "upcoming" ? new Date() : undefined,
      courtId,
      search,
    }),
    listAllCourts(),
  ]);

  function buildHref(next: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    const merged = { status, courtId, q: search, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    return `/admin/bookings?${query.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold">Резервации</h1>
      <p className="mt-1 text-white/60">
        Отказването на резервация освобождава корта и уведомява клиента по имейл.
      </p>

      <div className="mt-6 space-y-4 rounded-xl border border-white/5 bg-navy-800 p-5">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={buildHref({ status: filter.value })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                status === filter.value
                  ? "bg-brand-500 text-navy-950"
                  : "border border-white/10 bg-navy-900 text-white/70 hover:text-white"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildHref({ courtId: undefined })}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              !courtId
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            Всички кортове
          </Link>
          {courts.map((court) => (
            <Link
              key={court.id}
              href={buildHref({ courtId: court.id })}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                courtId === court.id
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {court.name}
            </Link>
          ))}
        </div>

        <form action="/admin/bookings" className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          {courtId && <input type="hidden" name="courtId" value={courtId} />}
          <input
            name="q"
            defaultValue={search}
            placeholder="Търси по номер, име или имейл…"
            className="w-full max-w-sm rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-brand-500"
          />
          <button
            type="submit"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 hover:text-white"
          >
            Търси
          </button>
        </form>
      </div>

      {bookings.length === 0 ? (
        <p className="mt-6 rounded-xl border border-white/5 bg-navy-800 p-6 text-white/50">
          Няма резервации по тези критерии.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/5 bg-navy-800">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-5 py-3 font-medium">Номер</th>
                <th className="px-5 py-3 font-medium">Клиент</th>
                <th className="px-5 py-3 font-medium">Корт</th>
                <th className="px-5 py-3 font-medium">Кога</th>
                <th className="px-5 py-3 text-right font-medium">Цена</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-white/60">
                    {booking.reference}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium">
                      {[booking.user.firstName, booking.user.lastName]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </p>
                    <p className="text-xs text-white/45">{booking.user.email}</p>
                    {booking.user.phone && (
                      <p className="text-xs text-white/35">{booking.user.phone}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-white/70">{booking.court.name}</td>
                  <td className="px-5 py-3">
                    <p>{formatClubDateShort(booking.startsAt)}</p>
                    <p className="text-xs text-white/45">
                      {formatClubWeekday(booking.startsAt)},{" "}
                      {formatClubTime(booking.startsAt)}–
                      {formatClubTime(booking.endsAt)}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    {booking.totalPrice.toFixed(2)} лв.
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        booking.status === "CANCELLED"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-brand-500/15 text-brand-400"
                      }`}
                    >
                      {booking.status === "CANCELLED" ? "Отказана" : "Потвърдена"}
                    </span>
                    {booking.bookedAsGuest && (
                      <span className="ml-2 text-xs text-white/35">гост</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {booking.status === "CONFIRMED" && (
                      <CancelBookingButton
                        bookingId={booking.id}
                        reference={booking.reference}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

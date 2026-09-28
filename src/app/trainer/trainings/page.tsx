import Link from "next/link";
import { CalendarPlus, CheckCircle2 } from "lucide-react";

import Badge from "@/components/admin/Badge";
import CancelBookingButton from "@/components/admin/CancelBookingButton";
import { displayEmail } from "@/lib/contact";
import { requireTrainer } from "@/lib/dal";
import { formatEur } from "@/lib/pricing";
import { formatClubDateShort, formatClubTime, formatClubWeekday } from "@/lib/time";
import { trainerCancelBookingAction } from "@/server/actions/trainer";
import { listBookings, type BookingFilters } from "@/server/bookings";

const FILTERS = [
  { value: "upcoming", label: "Предстоящи" },
  { value: "past", label: "Минали" },
  { value: "cancelled", label: "Отказани" },
  { value: "all", label: "Всички" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

export default async function TrainerTrainingsPage({
  searchParams,
}: PageProps<"/trainer/trainings">) {
  const trainer = await requireTrainer();

  const params = await searchParams;
  const justBooked = typeof params.booked === "string" ? params.booked : undefined;

  const filter: Filter = FILTERS.some((f) => f.value === params.filter)
    ? (params.filter as Filter)
    : "upcoming";

  // Always scoped to this trainer: the id comes from the session, not the URL.
  const now = new Date();
  const query: Record<Filter, BookingFilters> = {
    upcoming: { status: "CONFIRMED", from: now, order: "asc" },
    past: { status: "CONFIRMED", to: now },
    cancelled: { status: "CANCELLED" },
    all: {},
  };
  const sessions = await listBookings({
    ...query[filter],
    trainerId: trainer.id,
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Тренировки</h1>
          <p className="mt-1 text-white/60">
            Отказването на тренировка отменя и резервацията на корта и уведомява клиента
            по имейл.
          </p>
        </div>
        <Link
          href="/trainer/book"
          className="flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
        >
          <CalendarPlus size={16} />
          Нова тренировка
        </Link>
      </div>

      {justBooked && (
        <p
          role="status"
          className="mt-6 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-5 py-3 text-sm text-brand-300"
        >
          <CheckCircle2 size={18} className="shrink-0" />
          Тренировката е записана — номер <span className="font-mono">{justBooked}</span>.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-white/5 bg-navy-800 p-5">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={`/trainer/trainings?filter=${option.value}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === option.value
                ? "bg-brand-500 text-navy-950"
                : "border border-white/10 bg-navy-900 text-white/70 hover:text-white"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {sessions.length === 0 ? (
        <p className="mt-6 rounded-xl border border-white/5 bg-navy-800 p-6 text-white/50">
          {filter === "upcoming"
            ? "Нямаш предстоящи тренировки."
            : "Няма тренировки по тези критерии."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/5 bg-navy-800">
          <table className="w-full min-w-200 text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-5 py-3 font-medium">Кога</th>
                <th className="px-5 py-3 font-medium">Клиент</th>
                <th className="px-5 py-3 font-medium">Корт</th>
                <th className="px-5 py-3 text-right font-medium">Хонорар</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3">
                    <p>{formatClubDateShort(session.startsAt)}</p>
                    <p className="text-xs text-white/45">
                      {formatClubWeekday(session.startsAt)},{" "}
                      {formatClubTime(session.startsAt)}–{formatClubTime(session.endsAt)}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-white/30">
                      {session.reference}
                      {session.bookedByTrainer && (
                        <span className="ml-1.5 font-sans text-brand-400/70">
                          · записана от теб
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium">
                      {[session.user.firstName, session.user.lastName]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </p>
                    {displayEmail(session.user.email) && (
                      <p className="text-xs text-white/45">{session.user.email}</p>
                    )}
                    {session.user.phone && (
                      <p className="text-xs text-white/35">{session.user.phone}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-white/70">{session.court.name}</td>
                  <td className="px-5 py-3 text-right font-medium">
                    {session.trainerFee !== null ? formatEur(session.trainerFee) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {session.status === "CANCELLED" ? (
                      <>
                        <Badge tone="danger">Отказана</Badge>
                        <p className="mt-1 text-xs text-white/45">
                          {session.cancelledBy === "CUSTOMER"
                            ? "от клиента"
                            : session.cancelledBy === "TRAINER"
                              ? "от теб"
                              : "от клуба"}
                        </p>
                        {session.cancellationReason && (
                          <p
                            className="mt-0.5 max-w-48 truncate text-xs text-white/35"
                            title={session.cancellationReason}
                          >
                            {session.cancellationReason}
                          </p>
                        )}
                      </>
                    ) : session.hasEnded ? (
                      <Badge>Приключила</Badge>
                    ) : (
                      <Badge tone="brand">Потвърдена</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {session.status === "CONFIRMED" && !session.hasEnded && (
                      <CancelBookingButton
                        bookingId={session.id}
                        reference={session.reference}
                        action={trainerCancelBookingAction}
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

import Link from "next/link";
import {
  BanknoteIcon,
  CalendarCheck,
  CalendarClock,
  PercentIcon,
  Users,
} from "lucide-react";

import { requireAdmin } from "@/lib/dal";
import { formatClubDateShort, formatClubTime } from "@/lib/time";
import { getAnalytics, type AnalyticsRange } from "@/server/analytics";
import { listBookings } from "@/server/bookings";

const RANGES: AnalyticsRange[] = [7, 30, 90];

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  await requireAdmin();

  const params = await searchParams;
  const requested = Number(params.range);
  const range: AnalyticsRange = RANGES.includes(requested as AnalyticsRange)
    ? (requested as AnalyticsRange)
    : 30;

  const [analytics, nextUp] = await Promise.all([
    getAnalytics(range),
    // "asc" matters: with the default "desc", the take would pick the eight bookings
    // furthest in the future rather than the next eight.
    listBookings({ status: "CONFIRMED", from: new Date(), take: 8, order: "asc" }),
  ]);

  const maxDaily = Math.max(1, ...analytics.dailyBookings.map((day) => day.count));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Табло</h1>
          <p className="mt-1 text-white/60">
            Обобщение за последните {range} дни.
          </p>
        </div>

        <div className="flex gap-2">
          {RANGES.map((option) => (
            <Link
              key={option}
              href={`/admin?range=${option}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                option === range
                  ? "bg-brand-500 text-navy-950"
                  : "border border-white/10 bg-navy-800 text-white/70 hover:text-white"
              }`}
            >
              {option} дни
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          icon={<CalendarCheck size={16} />}
          label="Резервации"
          value={String(analytics.totalBookings)}
          hint={`${analytics.cancelledBookings} отказани`}
        />
        <Stat
          icon={<BanknoteIcon size={16} />}
          label="Оборот"
          value={`${analytics.revenue.toFixed(2)} лв.`}
          hint="по ценоразпис"
        />
        <Stat
          icon={<PercentIcon size={16} />}
          label="Заетост"
          value={`${(analytics.occupancyRate * 100).toFixed(1)}%`}
          hint="от работното време"
        />
        <Stat
          icon={<Users size={16} />}
          label="Клиенти"
          value={String(analytics.uniqueCustomers)}
          hint={`${(analytics.guestShare * 100).toFixed(0)}% като гости`}
        />
        <Stat
          icon={<CalendarClock size={16} />}
          label="Предстоящи"
          value={String(analytics.upcomingBookings)}
          hint="от днес нататък"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="Резервации по дни">
          {analytics.totalBookings === 0 ? (
            <Empty>Няма резервации в този период.</Empty>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {analytics.dailyBookings.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count}`}
                  className="flex-1 rounded-t bg-brand-500/70 transition-colors hover:bg-brand-400"
                  style={{ height: `${Math.max(2, (day.count / maxDaily) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Най-натоварени часове">
          {analytics.busiestHours.length === 0 ? (
            <Empty>Няма данни.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {analytics.busiestHours.map((entry) => (
                <li key={entry.hour} className="flex items-center gap-3 text-sm">
                  <span className="w-14 shrink-0 font-mono text-white/60">
                    {String(entry.hour).padStart(2, "0")}:00
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <span
                      className="block h-full rounded-full bg-brand-500"
                      style={{
                        width: `${(entry.count / analytics.busiestHours[0].count) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="w-6 text-right text-white/60">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="По кортове">
          {analytics.courtBreakdown.length === 0 ? (
            <Empty>Няма данни.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                  <th className="pb-2 font-medium">Корт</th>
                  <th className="pb-2 text-right font-medium">Резервации</th>
                  <th className="pb-2 text-right font-medium">Оборот</th>
                </tr>
              </thead>
              <tbody>
                {analytics.courtBreakdown.map((court) => (
                  <tr key={court.courtId} className="border-t border-white/5">
                    <td className="py-2.5">{court.name}</td>
                    <td className="py-2.5 text-right text-white/70">{court.bookings}</td>
                    <td className="py-2.5 text-right font-medium">
                      {court.revenue.toFixed(2)} лв.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Следващи резервации">
          {nextUp.length === 0 ? (
            <Empty>Няма предстоящи резервации.</Empty>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {nextUp.map((booking) => (
                <li
                  key={booking.id}
                  className="flex items-center justify-between gap-3 border-t border-white/5 pt-2.5 first:border-0 first:pt-0"
                >
                  <div>
                    <p className="font-medium">
                      {[booking.user.firstName, booking.user.lastName]
                        .filter(Boolean)
                        .join(" ") || booking.user.email}
                    </p>
                    <p className="text-white/50">
                      {booking.court.name} · {formatClubDateShort(booking.startsAt)} ·{" "}
                      {formatClubTime(booking.startsAt)}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-white/35">
                    {booking.reference}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/admin/bookings"
            className="mt-4 inline-block text-sm text-brand-400 hover:text-brand-300"
          >
            Всички резервации →
          </Link>
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-navy-800 p-5">
      <div className="flex items-center gap-2 text-white/50">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/5 bg-navy-800 p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-white/40">{children}</p>;
}

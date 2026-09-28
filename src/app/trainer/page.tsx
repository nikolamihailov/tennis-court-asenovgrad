import Link from "next/link";
import {
  AlertTriangle,
  BanknoteIcon,
  CalendarCheck,
  CalendarPlus,
  CalendarClock,
  Clock,
  Phone,
} from "lucide-react";

import { displayEmail } from "@/lib/contact";
import RoleBadge from "@/components/ui/RoleBadge";
import { requireTrainer } from "@/lib/dal";
import { formatEur } from "@/lib/pricing";
import {
  clubDateHourToUtc,
  clubDateParts,
  formatClubDateLong,
  formatClubTime,
  formatMinuteOfDay,
  WEEKDAY_NAMES,
} from "@/lib/time";
import { getTrainerOverview, type AgendaDay } from "@/server/trainer-dashboard";
import { getTrainerProfile } from "@/server/trainers";

export default async function TrainerDashboardPage() {
  const trainer = await requireTrainer();
  const profile = await getTrainerProfile(trainer.id);
  const overview = await getTrainerOverview(trainer.id, profile?.hours ?? []);
  const { stats, agenda } = overview;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold">
            Здравей{trainer.firstName ? `, ${trainer.firstName}` : ""}!
            <RoleBadge role="TRAINER" />
          </h1>
          <p className="mt-1 text-white/60">
            Тренировките и заетостта ти за следващите 7 дни.
          </p>
        </div>
        <Link
          href="/trainer/book"
          className="flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
        >
          <CalendarPlus size={16} />
          Запиши ученик
        </Link>
      </div>

      {!overview.hasHours && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <p className="flex items-start gap-2.5 text-sm text-amber-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            Все още нямаш работни часове — клиентите не могат да запишат тренировка с теб.
          </p>
          <Link
            href="/trainer/schedule"
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
          >
            Задай график
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<CalendarClock size={16} />}
          label="Предстоящи"
          value={String(stats.upcoming)}
          hint="всички бъдещи тренировки"
        />
        <Stat
          icon={<CalendarCheck size={16} />}
          label="Тази седмица"
          value={String(stats.weekSessions)}
          hint="тренировки в следващите 7 дни"
        />
        <Stat
          icon={<Clock size={16} />}
          label="Часове"
          value={formatHours(stats.weekMinutes)}
          hint="на корта в следващите 7 дни"
        />
        <Stat
          icon={<BanknoteIcon size={16} />}
          label="Хонорари"
          value={formatEur(stats.monthEarnings)}
          hint="потвърдени за този месец"
        />
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="font-semibold">Следващите 7 дни</h2>
        <Legend />
      </div>

      <div className="mt-4 space-y-3">
        {agenda.map((day) => (
          <DayCard key={day.date} day={day} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/trainer/trainings" className="text-brand-400 hover:text-brand-300">
          Всички тренировки →
        </Link>
        <Link href="/trainer/schedule" className="text-brand-400 hover:text-brand-300">
          Промени графика →
        </Link>
      </div>
    </div>
  );
}

/** The span every day's timeline covers, so the bars line up down the page. */
const TIMELINE_START = 7 * 60;
const TIMELINE_END = 23 * 60;

function DayCard({ day }: { day: AgendaDay }) {
  // Noon avoids any DST edge when turning the calendar date back into an instant.
  const noon = clubDateHourToUtc(day.date, 12);
  const isDayOff = day.windows.length === 0;
  const allDayOff = day.timeOff.some((t) => t.start === 0 && t.end === 24 * 60);

  return (
    <section
      className={`rounded-xl border bg-navy-800 p-5 ${
        day.isToday ? "border-brand-500/40" : "border-white/5"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {day.isToday && <span className="mr-2 text-brand-400">Днес</span>}
          {WEEKDAY_NAMES[day.weekday]}
          <span className="ml-2 text-sm font-normal text-white/50">
            {formatClubDateLong(noon)}
          </span>
        </h3>
        <p className="text-xs text-white/50">
          {allDayOff
            ? "Отсъствие"
            : isDayOff
              ? "Почивен ден"
              : day.windows
                  .map((w) => `${formatMinuteOfDay(w.start)}–${formatMinuteOfDay(w.end)}`)
                  .join(", ")}
        </p>
      </div>

      <Timeline day={day} />

      {day.sessions.length === 0 && day.timeOff.length === 0 ? (
        <p className="mt-3 text-sm text-white/40">
          {isDayOff ? "Няма тренировки." : "Свободен си — няма записани тренировки."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {day.timeOff.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm"
            >
              <span className="font-mono text-red-300">
                {t.start === 0 && t.end === 24 * 60
                  ? "Цял ден"
                  : `${formatMinuteOfDay(t.start)} – ${formatMinuteOfDay(t.end)}`}
              </span>
              <span className="text-red-200/80">
                Блокирано{t.reason ? ` · ${t.reason}` : ""}
              </span>
            </li>
          ))}
          {day.sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-navy-900 px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono font-medium text-brand-400">
                  {formatClubTime(session.startsAt)} – {formatClubTime(session.endsAt)}
                </span>
                <span className="font-medium">
                  {[session.user.firstName, session.user.lastName]
                    .filter(Boolean)
                    .join(" ") || displayEmail(session.user.email)}
                </span>
                <span className="text-white/50">{session.court.name}</span>
              </div>
              <div className="flex items-center gap-3 text-white/60">
                {session.user.phone && (
                  <a
                    href={`tel:${session.user.phone.replace(/\s+/g, "")}`}
                    className="flex items-center gap-1 hover:text-white"
                  >
                    <Phone size={13} />
                    {session.user.phone}
                  </a>
                )}
                {session.trainerFee !== null && (
                  <span className="font-medium text-white">
                    {formatEur(session.trainerFee)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One day as a bar: working hours as a faint band, sessions solid, time off in red.
 * Pure positioning — the lists below it carry the same information for screen readers.
 */
function Timeline({ day }: { day: AgendaDay }) {
  const span = TIMELINE_END - TIMELINE_START;
  const place = (start: number, end: number) => {
    const from = Math.max(start, TIMELINE_START);
    const to = Math.min(end, TIMELINE_END);
    if (to <= from) return null;
    return {
      left: `${((from - TIMELINE_START) / span) * 100}%`,
      width: `${((to - from) / span) * 100}%`,
    };
  };

  const minuteOf = (instant: Date) => {
    const { hour, minute } = clubDateParts(instant);
    return hour * 60 + minute;
  };

  const ticks = [8, 10, 12, 14, 16, 18, 20, 22];

  return (
    <div aria-hidden="true" className="mt-4">
      <div className="relative h-7 overflow-hidden rounded-md bg-navy-900">
        {day.windows.map((w) => {
          const style = place(w.start, w.end);
          return style ? (
            <div
              key={`w${w.start}`}
              className="absolute inset-y-0 bg-brand-500/15 ring-1 ring-inset ring-brand-500/25"
              style={style}
            />
          ) : null;
        })}
        {day.timeOff.map((t) => {
          const style = place(t.start, t.end);
          return style ? (
            <div
              key={`t${t.id}`}
              className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.35)_0_6px,rgba(239,68,68,0.15)_6px_12px)]"
              style={style}
            />
          ) : null;
        })}
        {day.sessions.map((s) => {
          const style = place(
            minuteOf(s.startsAt),
            minuteOf(s.startsAt) + s.durationMinutes,
          );
          return style ? (
            <div
              key={`s${s.id}`}
              className="absolute inset-y-1 rounded bg-brand-500"
              style={style}
            />
          ) : null;
        })}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-white/30">
        {ticks.map((hour) => (
          <span
            key={hour}
            className="absolute -translate-x-1/2"
            style={{ left: `${((hour * 60 - TIMELINE_START) / span) * 100}%` }}
          >
            {String(hour).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-4 text-xs text-white/50 sm:flex">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-brand-500/15 ring-1 ring-brand-500/25" />
        Работно време
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-brand-500" />
        Тренировка
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-red-500/40" />
        Блокирано
      </span>
    </div>
  );
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace(".", ",")} ч`;
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

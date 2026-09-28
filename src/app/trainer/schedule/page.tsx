import { Trash2 } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import BioForm from "@/components/trainer/BioForm";
import TimeOffForm from "@/components/trainer/TimeOffForm";
import WeeklyHoursEditor from "@/components/trainer/WeeklyHoursEditor";
import { requireTrainer } from "@/lib/dal";
import { formatEur } from "@/lib/pricing";
import {
  addDaysToIsoDate,
  clubToday,
  formatClubDateShort,
  formatClubTime,
  toClubIsoDate,
} from "@/lib/time";
import { deleteTimeOffAction } from "@/server/actions/trainer";
import { BOOKING_HORIZON_DAYS } from "@/server/availability";
import { getTrainerProfile, listUpcomingTimeOff, type TimeOffDTO } from "@/server/trainers";

export default async function TrainerSchedulePage() {
  const trainer = await requireTrainer();
  const [profile, timeOff] = await Promise.all([
    getTrainerProfile(trainer.id),
    listUpcomingTimeOff(trainer.id),
  ]);

  const today = clubToday();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold">График</h1>
      <p className="mt-1 text-white/60">
        Клиентите виждат само часовете, в които работиш и не си зает. Промяната не засяга вече
        записани тренировки.
      </p>

      <section className="mt-6 rounded-xl border border-white/5 bg-navy-800 p-6">
        <h2 className="font-semibold">Работни часове</h2>
        <p className="mt-1 text-sm text-white/50">Повтарят се всяка седмица.</p>
        <div className="mt-2">
          <WeeklyHoursEditor
            initial={(profile?.hours ?? []).map((h) => ({
              weekday: h.weekday,
              startMinute: h.startMinute,
              endMinute: h.endMinute,
            }))}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/5 bg-navy-800 p-6">
          <h2 className="font-semibold">Блокирай време</h2>
          <p className="mt-1 text-sm text-white/50">
            Отпуск, турнир, болничен — в тези часове клиентите няма да могат да те запишат.
          </p>
          <div className="mt-4">
            <TimeOffForm
              minDate={today}
              maxDate={addDaysToIsoDate(today, BOOKING_HORIZON_DAYS)}
            />
          </div>
        </section>

        <section className="rounded-xl border border-white/5 bg-navy-800 p-6">
          <h2 className="font-semibold">Предстоящи отсъствия</h2>
          {timeOff.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">Нямаш блокирано време.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {timeOff.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{formatTimeOff(entry)}</p>
                    {entry.reason && <p className="text-xs text-white/50">{entry.reason}</p>}
                  </div>
                  <form action={deleteTimeOffAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button
                      type="submit"
                      aria-label="Премахни"
                      title="Премахни"
                      className="rounded-lg border border-white/10 p-2 text-white/50 transition-colors hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-white/5 bg-navy-800 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar
            src={trainer.image}
            firstName={trainer.firstName}
            lastName={trainer.lastName}
            email={trainer.email}
            size={56}
          />
          <div className="flex-1">
            <h2 className="font-semibold">Как те виждат клиентите</h2>
            <p className="mt-0.5 text-sm text-white/50">
              {profile ? `${profile.name} · ${formatEur(profile.hourlyRate)} / час` : ""}
              <span className="block text-xs text-white/35">
                Ставката се определя от клуба. Снимката идва от Google профила, ако влизаш с
                Google.
              </span>
            </p>
          </div>
        </div>
        <div className="mt-4">
          <BioForm bio={profile?.bio ?? null} />
        </div>
      </section>
    </div>
  );
}

/** "12.10.2026" for a whole day, "12.10 – 15.10.2026" for several, or a time range. */
function formatTimeOff(entry: TimeOffDTO): string {
  const startTime = formatClubTime(entry.startsAt);
  const endTime = formatClubTime(entry.endsAt);
  const wholeDays = startTime === "00:00" && endTime === "00:00";

  if (wholeDays) {
    // The end is the midnight after the last day, so the last day is the one before it.
    const lastDay = new Date(entry.endsAt.getTime() - 60_000);
    return toClubIsoDate(entry.startsAt) === toClubIsoDate(lastDay)
      ? `${formatClubDateShort(entry.startsAt)}, цял ден`
      : `${formatClubDateShort(entry.startsAt)} – ${formatClubDateShort(lastDay)}`;
  }

  return toClubIsoDate(entry.startsAt) === toClubIsoDate(entry.endsAt)
    ? `${formatClubDateShort(entry.startsAt)}, ${startTime} – ${endTime}`
    : `${formatClubDateShort(entry.startsAt)} ${startTime} – ${formatClubDateShort(entry.endsAt)} ${endTime}`;
}

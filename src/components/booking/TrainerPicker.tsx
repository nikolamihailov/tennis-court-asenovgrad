"use client";

import { Check, UserRound } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import { formatEur } from "@/lib/pricing";
import { formatMinuteOfDay, isoWeekday, WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/time";
import type { TrainerDTO } from "@/server/trainers";

/** The trainer's windows on a date, e.g. "16:00–20:00", or null on their day off. */
export function trainerHoursOn(trainer: TrainerDTO, isoDate: string): string | null {
  const weekday = isoWeekday(isoDate);
  const windows = trainer.hours.filter((h) => h.weekday === weekday);
  if (windows.length === 0) return null;
  return windows
    .map((w) => `${formatMinuteOfDay(w.startMinute)}–${formatMinuteOfDay(w.endMinute)}`)
    .join(", ");
}

/**
 * "Book a trainer too?" — an optional step above the slot grid.
 *
 * Each card says when that trainer works on the chosen date, so a customer can see at a
 * glance who is around before picking, instead of selecting someone and finding an empty
 * grid. Choosing a trainer reloads the slots so only times both the court and the
 * trainer are free remain.
 */
export default function TrainerPicker({
  trainers,
  selectedId,
  date,
  onSelect,
}: {
  trainers: TrainerDTO[];
  selectedId?: string;
  date: string;
  onSelect: (trainerId: string | null) => void;
}) {
  const selected = trainers.find((trainer) => trainer.id === selectedId);

  return (
    <section
      aria-labelledby="trainer-picker-heading"
      className="mt-6 rounded-2xl border border-white/10 bg-navy-800 p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="trainer-picker-heading" className="font-semibold">
          Тренировка с треньор
          <span className="ml-2 text-sm font-normal text-white/40">по избор</span>
        </h2>
        <p className="text-xs text-white/40">Хонорарът се добавя към цената на корта.</p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby="trainer-picker-heading"
        className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <Option active={!selected} onClick={() => onSelect(null)}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/50 ring-1 ring-white/10">
            <UserRound size={20} />
          </span>
          <span className="min-w-0">
            <span className="block font-medium">Без треньор</span>
            <span className="block text-xs text-white/50">Само корт</span>
          </span>
        </Option>

        {trainers.map((trainer) => {
          const hours = trainerHoursOn(trainer, date);
          return (
            <Option
              key={trainer.id}
              active={selected?.id === trainer.id}
              onClick={() => onSelect(trainer.id)}
            >
              <Avatar
                src={trainer.image}
                firstName={trainer.firstName}
                lastName={trainer.lastName}
                email={null}
                size={44}
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">{trainer.name}</span>
                <span className="block text-xs text-white/60">
                  +{formatEur(trainer.hourlyRate)} / час
                </span>
                <span
                  className={`mt-0.5 block text-xs leading-snug ${hours ? "text-brand-400/90" : "text-white/35"}`}
                >
                  {hours ? `На тази дата: ${hours}` : "Не работи на тази дата"}
                </span>
              </span>
            </Option>
          );
        })}
      </div>

      {selected && <TrainerDetails trainer={selected} />}
    </section>
  );
}

function TrainerDetails({ trainer }: { trainer: TrainerDTO }) {
  const workingDays = new Set(trainer.hours.map((h) => h.weekday));

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-xl border border-brand-500/20 bg-navy-900 p-4 sm:flex-row sm:items-start">
      <Avatar
        src={trainer.image}
        firstName={trainer.firstName}
        lastName={trainer.lastName}
        email={null}
        size={64}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{trainer.name}</p>
        {trainer.bio ? (
          <p className="mt-1 whitespace-pre-line text-sm text-white/65">{trainer.bio}</p>
        ) : (
          <p className="mt-1 text-sm text-white/40">Треньор в клуба.</p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Работни дни">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <span
              key={day}
              title={WEEKDAY_NAMES[day]}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                workingDays.has(day)
                  ? "bg-brand-500/15 text-brand-400"
                  : "bg-white/5 text-white/25 line-through"
              }`}
            >
              {WEEKDAY_SHORT[day]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => {
        if (!active) onClick();
      }}
      className={`relative flex items-center gap-3 rounded-xl border py-3 pl-3 pr-10 text-left text-sm transition-colors ${
        active
          ? "border-brand-500 bg-brand-500/10"
          : "border-white/10 bg-navy-900 hover:border-brand-500/50"
      }`}
    >
      {children}
      {active && (
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-navy-950">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

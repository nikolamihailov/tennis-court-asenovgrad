"use client";

import { Clock, MapPin, Sparkles } from "lucide-react";

import {
  BOOKING_DURATIONS,
  formatDuration,
  formatEur,
  type BookingDuration,
} from "@/lib/pricing";
import type { Slot } from "@/server/availability";
import type { CourtDTO } from "@/server/courts";

/**
 * The pieces the booking page and the reschedule page share, so moving a booking looks
 * and behaves exactly like making one.
 */

const SURFACE_LABEL: Record<string, string> = {
  CLAY: "Глина",
  HARD: "Твърда настилка",
};

/** Court name, surface, indoor/outdoor and the price for the chosen length. */
export function CourtHeading({
  court,
  duration,
}: {
  court: CourtDTO;
  duration: BookingDuration;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="font-semibold">{court.name}</h2>
        <div className="mt-1 flex items-center gap-4 text-xs text-white/60">
          <span className="flex items-center gap-1">
            <MapPin size={13} />
            {SURFACE_LABEL[court.surface] ?? court.surface}
          </span>
          <span className="flex items-center gap-1">
            <Sparkles size={13} />
            {court.isIndoor ? "Закрит" : "Открит"}
          </span>
        </div>
      </div>
      <p className="text-sm font-semibold">
        {formatEur(court.prices[duration])}
        <span className="font-normal text-white/50">
          {" "}
          / {formatDuration(duration)}
        </span>
      </p>
    </div>
  );
}

/**
 * The start times for one court and length.
 *
 * `currentStart` marks the time a booking being moved already occupies. It is shown, so
 * the customer can see where they are, but cannot be picked — "moving" to the same time
 * would do nothing.
 */
export function SlotGrid({
  slots,
  selectedStart,
  currentStart,
  onSelect,
}: {
  slots: Slot[];
  selectedStart: number | null;
  currentStart?: number | null;
  onSelect: (slot: Slot) => void;
}) {
  if (!slots.some((slot) => slot.available)) {
    return <p className="mt-4 text-sm text-white/50">Няма свободни часове за този ден.</p>;
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {slots.map((slot) => {
        const isSelected = selectedStart === slot.start;
        const isCurrent = currentStart === slot.start;
        const selectable = slot.available && !isCurrent;

        return (
          <button
            key={slot.start}
            type="button"
            disabled={!selectable}
            aria-pressed={isSelected}
            onClick={() => onSelect(slot)}
            title={
              isCurrent
                ? "Текущият час на резервацията"
                : slot.reason === "booked"
                  ? "Часът е зает"
                  : slot.reason === "past"
                    ? "Часът вече е минал"
                    : undefined
            }
            className={[
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              isSelected
                ? "border-brand-500 bg-brand-500 text-navy-950"
                : isCurrent
                  ? "cursor-default border-dashed border-brand-500/50 bg-navy-900/40 text-brand-400"
                  : slot.available
                    ? "border-white/10 bg-navy-900 text-white hover:border-brand-500/60"
                    : "cursor-not-allowed border-white/5 bg-navy-900/40 text-white/25 line-through",
            ].join(" ")}
          >
            {slot.label}
            {isCurrent && <span className="block text-[11px] font-normal">текущ</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The 60 / 90 / 120 минути row. */
export function DurationPicker({
  value,
  onChange,
}: {
  value: BookingDuration;
  onChange: (duration: BookingDuration) => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-3 border-t border-white/5 pt-4">
      <span className="flex items-center gap-2 text-sm text-white/60">
        <Clock size={16} className="text-white/50" />
        Продължителност
      </span>
      <div role="group" aria-label="Продължителност" className="flex flex-wrap gap-2">
        {BOOKING_DURATIONS.map((option) => (
          <FilterChip
            key={option}
            active={value === option}
            onClick={() => {
              if (option !== value) onChange(option);
            }}
          >
            {formatDuration(option)}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

export function FilterChip({
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
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-500 text-navy-950"
          : "border border-white/10 bg-navy-900 text-white/70 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

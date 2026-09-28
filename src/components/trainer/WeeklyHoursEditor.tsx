"use client";

import { useActionState, useState } from "react";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";

import { saveWeeklyHoursAction, type TrainerFormState } from "@/server/actions/trainer";
import { formatMinuteOfDay, WEEKDAY_NAMES } from "@/lib/time";

type Window = { start: number; end: number };
type Week = Record<number, Window[]>;

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** 06:00 … 24:00 on the 30-minute grid the booking slots use. */
const TIME_OPTIONS = Array.from({ length: 37 }, (_, i) => 6 * 60 + i * 30);

const DEFAULT_WINDOW: Window = { start: 16 * 60, end: 20 * 60 };

/**
 * The trainer's week, edited as a whole and saved in one go.
 *
 * Each day can hold several windows (a lunch break is two). What is on screen is exactly
 * what gets saved — the server replaces the whole week — so there is no half-saved state
 * to reason about. Overlaps are flagged here for a quick fix and refused again on the
 * server.
 */
export default function WeeklyHoursEditor({
  initial,
}: {
  initial: { weekday: number; startMinute: number; endMinute: number }[];
}) {
  const [week, setWeek] = useState<Week>(() => {
    const byDay: Week = Object.fromEntries(WEEKDAYS.map((d) => [d, []]));
    for (const h of initial) byDay[h.weekday].push({ start: h.startMinute, end: h.endMinute });
    return byDay;
  });
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState<TrainerFormState, FormData>(
    async (previous, formData) => {
      const result = await saveWeeklyHoursAction(previous, formData);
      if (result.ok) setDirty(false);
      return result;
    },
    {},
  );

  function update(next: (draft: Week) => Week) {
    setWeek((current) => next(structuredClone(current)));
    setDirty(true);
  }

  function addWindow(day: number) {
    update((draft) => {
      const last = draft[day].at(-1);
      // Continue after the last window rather than stacking a duplicate on top of it.
      const start = last ? Math.min(last.end + 60, 22 * 60) : DEFAULT_WINDOW.start;
      const end = last ? Math.min(start + 120, 24 * 60) : DEFAULT_WINDOW.end;
      draft[day].push({ start, end: Math.max(end, start + 30) });
      return draft;
    });
  }

  function copyToWeekdays(fromDay: number) {
    update((draft) => {
      for (const day of [1, 2, 3, 4, 5]) {
        if (day !== fromDay) draft[day] = structuredClone(draft[fromDay]);
      }
      return draft;
    });
  }

  const payload = WEEKDAYS.flatMap((weekday) =>
    week[weekday].map((w) => ({ weekday, startMinute: w.start, endMinute: w.end })),
  );

  const problems = new Set(
    WEEKDAYS.filter((day) => {
      const windows = week[day];
      return windows.some(
        (a, i) =>
          a.end <= a.start ||
          windows.some((b, j) => i !== j && a.start < b.end && b.start < a.end),
      );
    }),
  );

  const totalMinutes = payload.reduce((sum, w) => sum + (w.endMinute - w.startMinute), 0);

  return (
    <form action={formAction}>
      <input type="hidden" name="hours" value={JSON.stringify(payload)} />

      <div className="divide-y divide-white/5">
        {WEEKDAYS.map((day) => {
          const windows = week[day];
          return (
            <div key={day} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
              <div className="flex w-36 shrink-0 items-center gap-2.5 pt-1.5">
                <input
                  type="checkbox"
                  id={`day-${day}`}
                  checked={windows.length > 0}
                  onChange={(event) =>
                    update((draft) => {
                      draft[day] = event.target.checked ? [{ ...DEFAULT_WINDOW }] : [];
                      return draft;
                    })
                  }
                  className="h-4 w-4 rounded border-white/20 bg-navy-800 accent-brand-500"
                />
                <label htmlFor={`day-${day}`} className="text-sm font-medium">
                  {WEEKDAY_NAMES[day]}
                </label>
              </div>

              <div className="flex-1 space-y-2">
                {windows.length === 0 ? (
                  <p className="pt-1.5 text-sm text-white/35">Почивен ден</p>
                ) : (
                  windows.map((window, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <TimeSelect
                        label={`${WEEKDAY_NAMES[day]}, начало`}
                        value={window.start}
                        options={TIME_OPTIONS.filter((m) => m < 24 * 60)}
                        onChange={(start) =>
                          update((draft) => {
                            draft[day][index].start = start;
                            // Keep the window valid while the start moves past the end.
                            if (draft[day][index].end <= start) {
                              draft[day][index].end = Math.min(start + 60, 24 * 60);
                            }
                            return draft;
                          })
                        }
                      />
                      <span className="text-white/40">–</span>
                      <TimeSelect
                        label={`${WEEKDAY_NAMES[day]}, край`}
                        value={window.end}
                        options={TIME_OPTIONS.filter((m) => m > window.start)}
                        onChange={(end) =>
                          update((draft) => {
                            draft[day][index].end = end;
                            return draft;
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          update((draft) => {
                            draft[day].splice(index, 1);
                            return draft;
                          })
                        }
                        aria-label="Премахни интервала"
                        title="Премахни интервала"
                        className="rounded-lg border border-white/10 p-2 text-white/50 transition-colors hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}

                {problems.has(day) && (
                  <p className="text-xs text-red-300">Интервалите в този ден се застъпват.</p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {windows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => addWindow(day)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition-colors hover:text-white"
                  >
                    <Plus size={13} />
                    Интервал
                  </button>
                )}
                {day <= 5 && windows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => copyToWeekdays(day)}
                    title="Същите часове за всички делнични дни"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition-colors hover:text-white"
                  >
                    <Copy size={13} />
                    Пн–Пт
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
        <p className="text-sm text-white/50">
          Общо {formatTotal(totalMinutes)} седмично
          {dirty && <span className="ml-2 text-amber-300">· незапазени промени</span>}
        </p>

        <div className="flex items-center gap-3">
          {/* A success note goes stale as soon as something changes; an error stays. */}
          {state.message && (!state.ok || !dirty) && (
            <p
              role={state.ok ? "status" : "alert"}
              className={`text-sm ${state.ok ? "text-brand-400" : "text-red-300"}`}
            >
              {state.message}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || problems.size > 0 || !dirty}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            Запази графика
          </button>
        </div>
      </div>
    </form>
  );
}

function TimeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (minute: number) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm outline-none focus:border-brand-500"
    >
      {/* Keep a saved value selectable even if it falls outside the usual range. */}
      {!options.includes(value) && <option value={value}>{formatMinuteOfDay(value)}</option>}
      {options.map((minute) => (
        <option key={minute} value={minute} className="bg-navy-900">
          {minute === 24 * 60 ? "24:00" : formatMinuteOfDay(minute)}
        </option>
      ))}
    </select>
  );
}

function formatTotal(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace(".", ",")} ч`;
}

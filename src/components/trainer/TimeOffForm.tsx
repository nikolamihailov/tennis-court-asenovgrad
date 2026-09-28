"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { addTimeOffAction, type TrainerFormState } from "@/server/actions/trainer";
import { formatMinuteOfDay } from "@/lib/time";

const TIME_OPTIONS = Array.from({ length: 37 }, (_, i) => 6 * 60 + i * 30);

const inputClass =
  "w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500 scheme-dark";

/**
 * Block out time: whole days by default (a holiday), or a stretch of hours on one day.
 * The server refuses a block that covers a confirmed session.
 */
export default function TimeOffForm({ minDate, maxDate }: { minDate: string; maxDate: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [allDay, setAllDay] = useState(true);
  const [fromDate, setFromDate] = useState(minDate);
  const [toDate, setToDate] = useState(minDate);

  const [state, formAction, pending] = useActionState<TrainerFormState, FormData>(
    async (previous, formData) => {
      const result = await addTimeOffAction(previous, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    {},
  );

  const error =
    state.ok === true
      ? null
      : (state.message ?? Object.values(state.errors ?? {}).find(Boolean) ?? null);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-white/70">
          От дата
          <input
            type="date"
            name="fromDate"
            required
            min={minDate}
            max={maxDate}
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              if (event.target.value > toDate) setToDate(event.target.value);
            }}
            className={`mt-1.5 ${inputClass}`}
          />
        </label>
        <label className="block text-xs font-medium text-white/70">
          До дата
          <input
            type="date"
            name="toDate"
            required
            min={fromDate}
            max={maxDate}
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className={`mt-1.5 ${inputClass}`}
          />
        </label>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-navy-800 accent-brand-500"
        />
        Цели дни
      </label>

      {!allDay && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-white/70">
            От час
            <select name="fromMinute" defaultValue={12 * 60} className={`mt-1.5 ${inputClass}`}>
              {TIME_OPTIONS.filter((m) => m < 24 * 60).map((m) => (
                <option key={m} value={m}>
                  {formatMinuteOfDay(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-white/70">
            До час
            <select name="toMinute" defaultValue={14 * 60} className={`mt-1.5 ${inputClass}`}>
              {TIME_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 24 * 60 ? "24:00" : formatMinuteOfDay(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <label className="block text-xs font-medium text-white/70">
        Причина (по избор, виждаш я само ти)
        <input
          name="reason"
          maxLength={200}
          placeholder="Например: турнир"
          className={`mt-1.5 ${inputClass} placeholder:text-white/25`}
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="text-sm text-brand-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        Блокирай периода
      </button>
    </form>
  );
}

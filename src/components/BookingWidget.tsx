"use client";

import { useState } from "react";
import { CalendarDays, Clock, LayoutGrid, Search, ChevronDown } from "lucide-react";

export default function BookingWidget() {
  const [date, setDate] = useState("2025-04-23");
  const [time, setTime] = useState("16:00");
  const [court, setCourt] = useState("all");

  function handleCheck() {
    // TODO: wire up to real availability check (Server Action / API route)
    console.log({ date, time, court });
  }

  return (
    <section id="booking" className="relative z-10 -mt-1">
      <div className="mx-auto max-w-7xl px-6">
        <div className="rounded-2xl bg-navy-800 p-8 shadow-xl shadow-black/30">
          <h2 className="text-xl font-bold">Резервирай бързо и лесно</h2>
          <p className="mt-1 text-sm text-white/60">
            Избери дата, час и корт, за да резервираш своето място.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Field icon={<CalendarDays size={18} />}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
              />
            </Field>

            <Field icon={<Clock size={18} />}>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
              />
            </Field>

            <Field icon={<LayoutGrid size={18} />}>
              <select
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="w-full appearance-none bg-transparent text-sm text-white outline-none"
              >
                <option value="all">Всички кортове</option>
                <option value="1">Корт 1 — Глина</option>
                <option value="2">Корт 2 — Глина</option>
                <option value="3">Корт 3 — Закрит</option>
              </select>
              <ChevronDown size={16} className="text-white/40" />
            </Field>

            <button
              onClick={handleCheck}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
            >
              <Search size={16} strokeWidth={2.5} />
              Провери наличност
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-navy-900 px-4 py-3">
      <span className="text-white/50">{icon}</span>
      {children}
    </div>
  );
}

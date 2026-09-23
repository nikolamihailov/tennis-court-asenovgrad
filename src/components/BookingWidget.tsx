"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LayoutGrid, Search, ChevronDown } from "lucide-react";

import type { CourtDTO } from "@/server/courts";

/**
 * The quick-search block on the landing page.
 *
 * It does not book anything — it just carries the date/court choice into /booking, where
 * real availability is rendered on the server. Keeping the actual slot logic off the
 * landing page means the home page has no per-request database work.
 */
export default function BookingWidget({
  courts,
  defaultDate,
}: {
  courts: CourtDTO[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [courtId, setCourtId] = useState("all");

  function handleCheck() {
    const params = new URLSearchParams({ date });
    if (courtId !== "all") params.set("courtId", courtId);
    router.push(`/booking?${params.toString()}`);
  }

  return (
    <section id="booking" className="relative z-10 -mt-1">
      <div className="mx-auto max-w-7xl px-6">
        <div className="rounded-2xl bg-navy-800 p-8 shadow-xl shadow-black/30">
          <h2 className="text-xl font-bold">Резервирай бързо и лесно</h2>
          <p className="mt-1 text-sm text-white/60">
            Избери дата и корт, за да видиш свободните часове.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
            <Field icon={<CalendarDays size={18} />}>
              <input
                type="date"
                value={date}
                min={defaultDate}
                onChange={(event) => setDate(event.target.value)}
                aria-label="Дата"
                className="w-full bg-transparent text-sm text-white outline-none scheme-dark"
              />
            </Field>

            <Field icon={<LayoutGrid size={18} />}>
              <select
                value={courtId}
                onChange={(event) => setCourtId(event.target.value)}
                aria-label="Корт"
                className="w-full appearance-none bg-transparent text-sm text-white outline-none"
              >
                <option value="all" className="bg-navy-900">
                  Всички кортове
                </option>
                {courts.map((court) => (
                  <option key={court.id} value={court.id} className="bg-navy-900">
                    {court.name}
                  </option>
                ))}
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

"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import CourtForm from "./CourtForm";
import { BOOKING_DURATIONS, formatDuration, formatEur } from "@/lib/pricing";
import { setCourtActiveAction } from "@/server/actions/admin";
import type { CourtDTO } from "@/server/courts";

const SURFACE_LABEL: Record<string, string> = {
  CLAY: "Глина",
  HARD: "Твърда настилка",
};

export default function CourtsManager({ courts }: { courts: CourtDTO[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="mt-6 space-y-4">
      {creating ? (
        <section className="rounded-xl border border-brand-500/30 bg-navy-800 p-6">
          <h2 className="mb-4 font-semibold">Нов корт</h2>
          <CourtForm onDone={() => setCreating(false)} />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
        >
          <Plus size={16} strokeWidth={2.5} />
          Добави корт
        </button>
      )}

      {courts.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-navy-800 p-6 text-white/50">
          Още няма създадени кортове.
        </p>
      ) : (
        <ul className="space-y-3">
          {courts.map((court) => (
            <li
              key={court.id}
              className="rounded-xl border border-white/5 bg-navy-800 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{court.name}</h3>
                    {!court.isActive && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                        неактивен
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-white/55">
                    {SURFACE_LABEL[court.surface] ?? court.surface} ·{" "}
                    {court.isIndoor ? "закрит" : "открит"} ·{" "}
                    {String(court.openingHour).padStart(2, "0")}:00–
                    {String(court.closingHour).padStart(2, "0")}:00
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    {BOOKING_DURATIONS.map(
                      (duration) =>
                        `${formatDuration(duration)}: ${formatEur(court.prices[duration])}`,
                    ).join(" · ")}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingId(editingId === court.id ? null : court.id)
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:text-white"
                  >
                    <Pencil size={14} />
                    {editingId === court.id ? "Затвори" : "Редактирай"}
                  </button>

                  {/* Courts are deactivated, never deleted — bookings reference them. */}
                  <form action={setCourtActiveAction}>
                    <input type="hidden" name="id" value={court.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={court.isActive ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white"
                    >
                      {court.isActive ? "Деактивирай" : "Активирай"}
                    </button>
                  </form>
                </div>
              </div>

              {editingId === court.id && (
                <div className="mt-5 border-t border-white/5 pt-5">
                  <CourtForm court={court} onDone={() => setEditingId(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

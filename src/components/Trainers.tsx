import Link from "next/link";
import { ArrowRight } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import { formatEur } from "@/lib/pricing";
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/time";
import type { TrainerDTO } from "@/server/trainers";

/**
 * The club's trainers on the home page. Each card links to the booking page with that
 * trainer already chosen, so the slots shown are the ones they can actually take.
 *
 * Rendered only when there is at least one trainer — an empty "our trainers" section
 * would advertise something the club does not offer.
 */
export default function Trainers({ trainers }: { trainers: TrainerDTO[] }) {
  if (trainers.length === 0) return null;

  return (
    <section id="trainers" className="mx-auto max-w-7xl px-6 py-20">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold">Нашите треньори</h2>
          <p className="mt-1 text-white/60">
            Запиши тренировка — кортът и треньорът се резервират заедно.
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {trainers.map((trainer) => {
          const workingDays = new Set(trainer.hours.map((h) => h.weekday));
          return (
            <div
              key={trainer.id}
              className="flex flex-col rounded-2xl border border-white/5 bg-navy-800 p-6"
            >
              <div className="flex items-center gap-4">
                <Avatar
                  src={trainer.image}
                  firstName={trainer.firstName}
                  lastName={trainer.lastName}
                  email={null}
                  size={64}
                />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{trainer.name}</h3>
                  <p className="text-sm text-white/60">
                    {formatEur(trainer.hourlyRate)}{" "}
                    <span className="text-white/40">/ час + корт</span>
                  </p>
                </div>
              </div>

              {/* Fixed height, like the court cards, so a long bio does not stagger the row. */}
              <p
                className="mt-4 line-clamp-3 h-15 text-sm text-white/50"
                title={trainer.bio ?? undefined}
              >
                {trainer.bio ?? "Треньор в клуба."}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Работни дни">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <span
                    key={day}
                    title={WEEKDAY_NAMES[day]}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      workingDays.has(day)
                        ? "bg-brand-500/15 text-brand-400"
                        : "bg-white/5 text-white/25"
                    }`}
                  >
                    {WEEKDAY_SHORT[day]}
                  </span>
                ))}
              </div>

              <Link
                href={`/booking?trainerId=${encodeURIComponent(trainer.id)}`}
                className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
              >
                Запиши тренировка
                <ArrowRight size={14} />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

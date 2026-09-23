import Image from "next/image";
import Link from "next/link";
import { MapPin, Sparkles, ArrowRight } from "lucide-react";

import type { CourtDTO } from "@/server/courts";

const SURFACE_LABEL: Record<string, string> = {
  CLAY: "Глина",
  HARD: "Твърда настилка",
};

export default function Courts({ courts }: { courts: CourtDTO[] }) {
  return (
    <section id="courts" className="mx-auto max-w-7xl px-6 py-20">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold">Нашите кортове</h2>
          <p className="mt-1 text-white/60">
            Модерни и добре поддържани кортове за вашата игра.
          </p>
        </div>
        <Link
          href="/booking"
          className="hidden items-center gap-1 text-sm text-brand-400 hover:text-brand-300 sm:inline-flex"
        >
          Виж свободните часове
          <ArrowRight size={14} />
        </Link>
      </div>

      {courts.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/5 bg-navy-800 p-6 text-white/60">
          В момента няма налични кортове.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {courts.map((court) => (
            <div
              key={court.id}
              className="overflow-hidden rounded-2xl bg-navy-800 border border-white/5"
            >
              <div className="relative h-44 w-full">
                <Image
                  src={court.imageUrl || "/images/court.jpg"}
                  alt={`${court.name} - тенис корт`}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover"
                />
              </div>

              <div className="p-5">
                <h3 className="font-semibold">{court.name}</h3>
                <div className="mt-2 flex items-center gap-4 text-xs text-white/60">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />
                    {SURFACE_LABEL[court.surface] ?? court.surface}
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles size={13} />
                    {court.isIndoor ? "Закрит" : "Открит"}
                  </span>
                </div>

                {court.description && (
                  <p className="mt-3 text-sm text-white/50">{court.description}</p>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <p className="font-semibold">
                    {court.pricePerHour.toFixed(2)} лв.{" "}
                    <span className="text-sm text-white/50">/ час</span>
                  </p>
                  <Link
                    href={`/booking?courtId=${court.id}`}
                    className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
                  >
                    Резервирай
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

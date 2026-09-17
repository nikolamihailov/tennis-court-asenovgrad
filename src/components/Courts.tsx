import { MapPin, Sparkles, ArrowRight } from "lucide-react";

const courts = [
  {
    name: "Корт 1",
    surface: "Глина",
    status: "Открит",
    price: "20 лв.",
    photo: "from-orange-800/40 via-navy-800 to-navy-900",
  },
  {
    name: "Корт 2",
    surface: "Глина",
    status: "Открит",
    price: "20 лв.",
    photo: "from-orange-800/40 via-navy-800 to-navy-900",
  },
  {
    name: "Корт 3",
    surface: "Твърда настилка",
    status: "Закрит",
    price: "25 лв.",
    photo: "from-sky-800/30 via-navy-800 to-navy-900",
  },
];

export default function Courts() {
  return (
    <section id="courts" className="mx-auto max-w-7xl px-6 py-20">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold">Нашите кортове</h2>
          <p className="mt-1 text-white/60">
            Модерни и добре поддържани кортове за вашата игра.
          </p>
        </div>
        <a
          href="#courts"
          className="hidden items-center gap-1 text-sm text-brand-400 hover:text-brand-300 sm:inline-flex"
        >
          Виж всички кортове
          <ArrowRight size={14} />
        </a>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {courts.map((c) => (
          <div
            key={c.name}
            className="overflow-hidden rounded-2xl bg-navy-800 border border-white/5"
          >
            {/* Court photo placeholder — swap for a real photo of this court */}
            <div className={`h-44 w-full bg-gradient-to-br ${c.photo}`} />

            <div className="p-5">
              <h3 className="font-semibold">{c.name}</h3>
              <div className="mt-2 flex items-center gap-4 text-xs text-white/60">
                <span className="flex items-center gap-1">
                  <MapPin size={13} />
                  {c.surface}
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles size={13} />
                  {c.status}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="font-semibold">
                  {c.price} <span className="text-sm text-white/50">/ час</span>
                </p>
                <a
                  href="#booking"
                  className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
                >
                  Резервирай
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

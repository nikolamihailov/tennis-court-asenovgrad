import { MapPin, Phone, Clock, ArrowRight } from "lucide-react";

export default function AboutContact() {
  return (
    <section className="bg-navy-950">
      {/* Motivational banner — swap the gradient for a real photo (e.g. tennis ball on clay) */}
      <div className="relative overflow-hidden">
        <div className="h-64 w-full bg-gradient-to-r from-navy-900 via-green-900/30 to-navy-950 sm:h-72" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6">
            <h2 className="max-w-sm text-2xl font-bold leading-snug sm:text-3xl">
              Тенисът е повече от игра — това е начин на живот.
            </h2>
          </div>
        </div>
      </div>

      <div
        id="about"
        className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-16 md:grid-cols-3"
      >
        <div>
          <h3 className="font-semibold">За клуба</h3>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Тенис клуб Асеновград предлага отлични условия за любители и
            професионални играчи. Нашата цел е да създадем среда за
            развитие, спорт и приятелства около тениса.
          </p>
          <a
            href="#about"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-white/30"
          >
            Научи повече
            <ArrowRight size={14} />
          </a>
        </div>

        <div id="contact">
          <h3 className="font-semibold">Контакти и локация</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-white/70">
            <li className="flex items-center gap-2.5">
              <MapPin size={16} className="text-brand-400" />
              Асеновград, България
            </li>
            <li className="flex items-center gap-2.5">
              <Phone size={16} className="text-brand-400" />
              +359 895 558 586
            </li>
            <li className="flex items-center gap-2.5">
              <Clock size={16} className="text-brand-400" />
              Всеки ден 09:00 – 23:00
            </li>
          </ul>
        </div>

        {/* Map placeholder — swap for an embedded Google Map */}
        <div className="flex min-h-[140px] items-center justify-center rounded-xl bg-white/5">
          <MapPin size={28} className="text-brand-400" />
        </div>
      </div>
    </section>
  );
}

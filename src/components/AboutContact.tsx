import { MapPin, Phone, Clock } from "lucide-react";

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

        {/* Satellite view of the club. `loading="lazy"` keeps Google's script and its
            cookies off the initial page load — the map sits below the fold. */}
        <div className="overflow-hidden rounded-xl bg-white/5">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1040.9678481726273!2d24.864133653244494!3d42.010591676984426!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14acd8dc2fc2656b%3A0xaecc65546efcf7a7!2z0KLQtdC90LjRgSDQutC70YPQsSAi0JDRgdC10L3QvtCy0LPRgNCw0LQi!5e1!3m2!1sbg!2sbg!4v1790171819454!5m2!1sbg!2sbg"
            title="Тенис клуб Асеновград на картата"
            className="h-full min-h-55 w-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </section>
  );
}

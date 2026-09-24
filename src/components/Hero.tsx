import Image from "next/image";
import { ArrowRight, MapPin, Phone, Clock, LayoutGrid } from "lucide-react";

export default function Hero() {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-navy-900"
    >
      <div className="absolute inset-0">
        <Image
          src="/images/tennis-hero.jpg"
          alt="Тенис топка и ракета на корта"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      {/* A left-to-right fade only works when the text sits in the left half. On phones
          the content spans the full width, so the fade left the right-hand side of every
          line over bare photo. Below md it becomes a flat scrim instead. */}
      <div className="absolute inset-0 bg-navy-950/75 md:bg-transparent md:bg-linear-to-r md:from-navy-950 md:via-navy-950/70 md:to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-xl text-center md:mx-0 md:text-left">
          <div className="mb-5 flex items-center justify-center gap-2 text-sm text-brand-400 md:justify-start">
            <MapPin size={16} />
            Асеновград, България
          </div>

          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Тенис клуб
            <br />
            <span className="text-brand-400">Асеновград</span>
          </h1>

          <p className="mt-5 text-lg text-white/70">
            Място за спорт, приятели и незабравими моменти на корта.
          </p>

          <a
            href="#booking"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3.5 font-semibold text-navy-950 transition-colors hover:bg-brand-400"
          >
            <span>Резервирай корт</span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </a>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <InfoItem
              icon={<Phone size={18} />}
              title="+359 895 558 586"
              subtitle="За въпроси и информация"
            />
            <InfoItem
              icon={<Clock size={18} />}
              title="Работно време"
              subtitle="Всеки ден 09:00 – 23:00"
            />
            <InfoItem
              icon={<LayoutGrid size={18} />}
              title="Онлайн резервации"
              subtitle="Бързо и лесно"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoItem({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    // Centred as a block on phones — with three of these stacked, centring the text but
    // leaving the icons flush left reads as a ragged column rather than a centred one.
    <div className="flex items-start justify-center gap-3 text-center sm:justify-start sm:text-left">
      <span className="mt-0.5 text-brand-400">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/60">{subtitle}</p>
      </div>
    </div>
  );
}

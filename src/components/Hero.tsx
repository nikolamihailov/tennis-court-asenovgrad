import Image from "next/image";
import { ArrowRight, MapPin, Phone, Clock, LayoutGrid } from "lucide-react";

/**
 * The hero.
 *
 * Two quite different layouts share one markup tree. On desktop the copy is a column in
 * the left third, so a left-to-right fade works and the section is a normal block. On a
 * phone the copy spans the full width, which needs a different treatment entirely:
 *
 * - The section fills the screen below the header, so the first thing loaded is one
 *   deliberate image rather than a short band with the next section peeking in.
 * - The fade runs top-to-bottom: the photograph stays legible up top and the copy sits
 *   on near-solid navy at the bottom, which also blends into the next section's
 *   background instead of ending on a hard edge.
 * - Content is anchored to the bottom rather than floating mid-frame, so the heading and
 *   the CTA land in the thumb's half of the screen.
 */
export default function Hero() {
  return (
    <section
      id="home"
      className="relative isolate flex min-h-[calc(100svh-var(--header-h))] items-end overflow-hidden bg-navy-900 md:block md:min-h-0"
    >
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/tennis-hero.jpg"
          alt="Тенис корт с играч по време на сервис"
          fill
          priority
          sizes="100vw"
          // A portrait crop of this landscape shot cannot hold both the player and the
          // copy: centred, he lands directly behind the heading and his white shirt
          // fights the text. Panning right instead frames the clay, the court lines and
          // the racket's shadow — texture the heading can sit on cleanly. Desktop keeps
          // the player, since the copy there occupies only the left third.
          className="object-cover object-[80%_center] md:object-center"
        />
      </div>

      <div className="absolute inset-0 -z-10 bg-linear-to-b from-navy-950/20 via-navy-950/65 to-navy-950 md:hidden" />
      <div className="absolute inset-0 -z-10 hidden md:block md:bg-linear-to-r md:from-navy-950 md:via-navy-950/70 md:to-transparent" />

      <div className="relative mx-auto w-full max-w-7xl px-6 pb-14 pt-24 md:py-32">
        <div className="mx-auto max-w-xl text-center md:mx-0 md:text-left">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-400/10 px-3.5 py-1.5 text-xs font-medium text-brand-300 md:mb-5 md:border-0 md:bg-transparent md:p-0 md:text-sm md:text-brand-400">
            <MapPin size={15} />
            Асеновград, България
          </span>

          <h1 className="text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Тенис клуб
            <br />
            <span className="text-brand-400">Асеновград</span>
          </h1>

          <p className="mx-auto mt-5 max-w-sm text-base text-white/70 md:mx-0 md:max-w-none md:text-lg">
            Място за спорт, приятели и незабравими моменти на корта.
          </p>

          {/* Full width on phones: an edge-to-edge primary action is easier to hit and
              reads as deliberate, rather than a desktop button left floating. */}
          <a
            href="#booking"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-4 font-semibold text-navy-950 shadow-lg shadow-brand-500/20 transition-colors hover:bg-brand-400 sm:w-auto sm:py-3.5"
          >
            <span>Резервирай корт</span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </a>

          {/* One card with hairline dividers on phones — three loose rows floating over a
              photograph looked like leftover content. Unchanged grid from md up. */}
          <div className="mt-10 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-navy-950/50 text-left backdrop-blur-sm md:mt-14 md:grid md:grid-cols-3 md:gap-6 md:divide-y-0 md:rounded-none md:border-0 md:bg-transparent md:backdrop-blur-none">
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
    <div className="flex items-start gap-3 px-4 py-3.5 md:p-0">
      <span className="mt-0.5 text-brand-400">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/60">{subtitle}</p>
      </div>
    </div>
  );
}

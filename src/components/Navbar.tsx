import Image from "next/image";
import Link from "next/link";
import { CalendarDays, LayoutDashboard, LogOut, User } from "lucide-react";

import logo from "@/assets/logo.png";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/dal";

const links = [
  { href: "/#home", label: "Начало" },
  { href: "/#about", label: "За клуба" },
  { href: "/#courts", label: "Кортове" },
  { href: "/booking", label: "Резервация" },
  { href: "/#contact", label: "Контакти" },
];

export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 bg-navy-900/95 backdrop-blur border-b border-white/5">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Ball only — the Hero carries the club name as an h1 immediately below, so
            repeating it here just crowded the header. aria-label gives the link an
            accessible name now that there is no visible text. */}
        <Link href="/" aria-label="Тенис клуб Асеновград — начало">
          <Image src={logo} alt="" priority className="h-10 w-10 shrink-0" />
        </Link>

        <ul className="hidden items-center gap-8 text-sm text-white/80 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          {/* These stay visible on phones — hiding them left mobile users with no way to
              sign in, reach their bookings, or open the admin panel. Only the labels
              collapse on narrow screens; the icons carry the meaning. */}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white sm:px-4"
              title="Администрация"
              aria-label="Администрация"
            >
              <LayoutDashboard size={15} />
              <span className="hidden sm:inline">Админ</span>
            </Link>
          )}

          {user ? (
            <>
              <Link
                href="/my-bookings"
                className="inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
                title="Моите резервации"
                aria-label="Моите резервации"
              >
                <User size={15} />
                <span className="hidden max-w-[10ch] truncate sm:inline">
                  {user.firstName || user.email}
                </span>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  title="Изход"
                  aria-label="Изход"
                  className="flex items-center rounded-full border border-white/15 p-2 text-white/60 transition-colors hover:text-white"
                >
                  <LogOut size={15} />
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm text-white/80 transition-colors hover:text-white"
            >
              Вход
            </Link>
          )}

          <Link
            href="/booking"
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
          >
            <CalendarDays size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Резервирай корт</span>
            <span className="sm:hidden">Резервирай</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}

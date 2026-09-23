import Link from "next/link";
import { CalendarDays, LayoutDashboard, LogOut, User } from "lucide-react";

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
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-navy-950 font-bold">
            TA
          </span>
          <span className="text-sm font-semibold leading-tight">
            Тенис клуб
            <br />
            Асеновград
          </span>
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
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="hidden items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white sm:inline-flex"
              title="Администрация"
            >
              <LayoutDashboard size={15} />
              Админ
            </Link>
          )}

          {user ? (
            <>
              <Link
                href="/my-bookings"
                className="hidden items-center gap-2 text-sm text-white/80 transition-colors hover:text-white sm:inline-flex"
              >
                <User size={15} />
                {user.firstName || user.email}
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
              className="hidden text-sm text-white/80 transition-colors hover:text-white sm:inline"
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

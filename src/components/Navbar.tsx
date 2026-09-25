import Image from "next/image";
import Link from "next/link";
import { CalendarDays, LayoutDashboard, LogOut, User } from "lucide-react";

import logo from "@/assets/logo.png";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/dal";
import MobileMenu, { type NavLink } from "@/components/nav/MobileMenu";

const links: NavLink[] = [
  { href: "/#home", label: "Начало" },
  { href: "/#about", label: "За клуба" },
  { href: "/#courts", label: "Кортове" },
  { href: "/booking", label: "Резервация" },
  { href: "/#contact", label: "Контакти" },
];

export default async function Navbar() {
  const user = await getCurrentUser();

  // Defined here rather than inside MobileMenu so the client component never imports
  // the auth module — it receives this as a prop and only knows how to submit it.
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-navy-900/95 backdrop-blur">
      <nav className="relative mx-auto flex h-(--header-h) max-w-7xl items-center justify-between gap-4 px-6">
        {/* Logo and section links share a left group, matching the admin header. */}
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Тенис клуб Асеновград — начало">
            <Image src={logo} alt="" priority className="h-10 w-10 shrink-0" />
          </Link>

          <ul className="hidden items-center gap-6 text-sm text-white/80 lg:flex">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Account controls are icon-only: the signed-in name added width without
              telling anyone anything they did not already know, and truncated to
              "Администра…" on narrower screens. title/aria-label carry the meaning. */}
          <div className="hidden items-center gap-2 lg:flex">
            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                title="Администрация"
                aria-label="Администрация"
                className="flex items-center rounded-lg border border-white/15 p-2.5 text-white/80 transition-colors hover:text-white"
              >
                <LayoutDashboard size={16} />
              </Link>
            )}

            {user ? (
              <>
                <Link
                  href="/profile"
                  title={`Моят профил (${user.firstName || user.email})`}
                  aria-label="Моят профил"
                  className="flex items-center rounded-lg border border-white/15 p-2.5 text-white/80 transition-colors hover:text-white"
                >
                  <User size={16} />
                </Link>

                <form action={signOutAction}>
                  <button
                    type="submit"
                    title="Изход"
                    aria-label="Изход"
                    className="flex items-center rounded-lg border border-white/15 p-2.5 text-white/60 transition-colors hover:text-white"
                  >
                    <LogOut size={16} />
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                Вход
              </Link>
            )}
          </div>

          {/* Last, so the primary action sits rightmost. Hidden wherever the hamburger
              is shown: below lg the bar was a logo, a green button and a burger fighting
              over a narrow strip, and the action is already covered twice — by the Hero's
              own CTA immediately below and by the menu panel. */}
          <Link
            href="/booking"
            className="hidden items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 lg:inline-flex"
          >
            <CalendarDays size={16} strokeWidth={2.5} />
            Резервирай корт
          </Link>

          <MobileMenu
            links={links}
            user={
              user && {
                label: user.firstName || user.email || "профил",
                isAdmin: user.role === "ADMIN",
              }
            }
            signOutAction={signOutAction}
          />
        </div>
      </nav>
    </header>
  );
}

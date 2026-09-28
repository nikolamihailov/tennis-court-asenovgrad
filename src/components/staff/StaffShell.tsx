import Image from "next/image";
import Link from "next/link";
import { LogOut, type LucideIcon } from "lucide-react";

import logo from "@/assets/logo.png";
import { signOut } from "@/auth";
import Avatar from "@/components/ui/Avatar";
import type { SessionUser } from "@/lib/dal";

export type StaffNavItem = { href: string; label: string; icon: LucideIcon };

/**
 * The header and frame shared by the admin and trainer panels, so the two read as one
 * product: same logo, same nav, same account controls. Each section passes its own links.
 *
 * Rendering this is not authorisation — the calling layout, and every page and action
 * under it, must run its own require*() check.
 */
export default function StaffShell({
  user,
  homeHref,
  homeLabel,
  navItems,
  children,
}: {
  user: SessionUser;
  homeHref: string;
  homeLabel: string;
  navItems: StaffNavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-white/5 bg-navy-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href={homeHref} aria-label={homeLabel}>
              <Image src={logo} alt="" className="h-10 w-10 shrink-0" />
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <item.icon size={15} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="mr-1 hidden text-sm text-white/60 transition-colors hover:text-white sm:inline"
            >
              Към сайта
            </Link>

            {/* Same account controls as the site navbar, so the two headers agree: the
                avatar carries the identity (name/email in the tooltip) instead of a
                bare email address. */}
            <Link
              href="/profile"
              title={`Моят профил (${user.firstName || user.email})`}
              aria-label="Моят профил"
              className="flex items-center rounded-full transition-opacity hover:opacity-80"
            >
              <Avatar
                src={user.image}
                firstName={user.firstName}
                lastName={user.lastName}
                email={user.email}
                size={38}
              />
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
                className="flex items-center rounded-lg border border-white/15 p-2.5 text-white/60 transition-colors hover:text-white"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-white/5 px-6 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70"
            >
              <item.icon size={15} />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 bg-navy-950">{children}</main>
    </div>
  );
}

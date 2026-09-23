import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarRange, LayoutGrid, LogOut, Users } from "lucide-react";

import { signOut } from "@/auth";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Администрация — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
};

const navItems = [
  { href: "/admin", label: "Табло", icon: BarChart3 },
  { href: "/admin/bookings", label: "Резервации", icon: CalendarRange },
  { href: "/admin/courts", label: "Кортове", icon: LayoutGrid },
  { href: "/admin/users", label: "Потребители", icon: Users },
];

/**
 * The admin shell.
 *
 * `requireAdmin()` here keeps the chrome from rendering for the wrong person, but it is
 * NOT what secures the section: layouts do not re-render on client-side navigation and
 * do not control whether nested segments render. Every admin page and every Server
 * Action calls requireAdmin() itself.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-white/5 bg-navy-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-navy-950 font-bold">
                TA
              </span>
              <span className="text-sm font-semibold">Администрация</span>
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

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden text-sm text-white/60 transition-colors hover:text-white sm:inline"
            >
              Към сайта
            </Link>
            <span className="hidden text-sm text-white/40 lg:inline">{admin.email}</span>
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

import type { Metadata } from "next";
import { BarChart3, CalendarRange, LayoutGrid, Users } from "lucide-react";

import { requireAdmin } from "@/lib/dal";
import StaffShell, { type StaffNavItem } from "@/components/staff/StaffShell";

export const metadata: Metadata = {
  title: "Администрация — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
};

const navItems: StaffNavItem[] = [
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
    <StaffShell
      user={admin}
      homeHref="/admin"
      homeLabel="Администрация — табло"
      navItems={navItems}
    >
      {children}
    </StaffShell>
  );
}

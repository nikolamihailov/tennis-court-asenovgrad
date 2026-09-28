import type { Metadata } from "next";
import { CalendarClock, CalendarPlus, CalendarRange, LayoutDashboard } from "lucide-react";

import { requireTrainer } from "@/lib/dal";
import StaffShell, { type StaffNavItem } from "@/components/staff/StaffShell";

export const metadata: Metadata = {
  title: "Треньорски панел — Тенис клуб Асеновград",
  robots: { index: false, follow: false },
};

const navItems: StaffNavItem[] = [
  { href: "/trainer", label: "Табло", icon: LayoutDashboard },
  { href: "/trainer/trainings", label: "Тренировки", icon: CalendarRange },
  { href: "/trainer/book", label: "Нова тренировка", icon: CalendarPlus },
  { href: "/trainer/schedule", label: "График", icon: CalendarClock },
];

/**
 * The trainer shell. As with the admin layout, requireTrainer() here only keeps the
 * chrome from rendering for the wrong person — every trainer page and Server Action runs
 * its own check.
 */
export default async function TrainerLayout({ children }: LayoutProps<"/trainer">) {
  const trainer = await requireTrainer();

  return (
    <StaffShell
      user={trainer}
      homeHref="/trainer"
      homeLabel="Треньорски панел — табло"
      navItems={navItems}
    >
      {children}
    </StaffShell>
  );
}

import Link from "next/link";
import { CalendarDays } from "lucide-react";

const links = [
  { href: "#home", label: "Начало" },
  { href: "#about", label: "За клуба" },
  { href: "#courts", label: "Кортове" },
  { href: "#prices", label: "Цени" },
  { href: "#news", label: "Новини" },
  { href: "#contact", label: "Контакти" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-navy-900/95 backdrop-blur border-b border-white/5">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="#home" className="flex items-center gap-3">
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
          {links.map((link, i) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={
                  i === 0
                    ? "text-brand-400 border-b-2 border-brand-400 pb-1 font-medium"
                    : "hover:text-white transition-colors"
                }
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#booking"
          className="hidden items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400 sm:inline-flex"
        >
          <CalendarDays size={16} strokeWidth={2.5} />
          Резервирай корт
        </a>
      </nav>
    </header>
  );
}

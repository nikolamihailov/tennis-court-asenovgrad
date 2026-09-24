"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  User,
  X,
} from "lucide-react";

export type NavLink = { href: string; label: string };

export type MenuUser = {
  label: string;
  isAdmin: boolean;
};

/**
 * The header menu below the `lg` breakpoint.
 *
 * `lg` is where the desktop links appear, and both must switch on the same one: while
 * the links appeared at `lg` but this hid at `md`, 768-1023px wide screens showed
 * neither, leaving the sections unreachable.
 *
 * It carries everything the desktop header shows — the section links and the account
 * controls — because the previous layout hid the section links entirely on phones and
 * squeezed the account controls into a row of unlabelled icons.
 *
 * Kept as a client component so the panel can open and close, while Navbar stays a
 * Server Component: the session is read on the server and `signOutAction` is passed in
 * as a Server Action, so no auth logic reaches the browser.
 */
export default function MobileMenu({
  links,
  user,
  signOutAction,
}: {
  links: NavLink[];
  user: MenuUser | null;
  signOutAction: () => Promise<void>;
}) {
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // The panel stores the route it was opened on, and counts as open only while that
  // still matches. Navigating away therefore closes it during render — including on
  // browser back/forward — rather than through an effect that would set state a render
  // too late. In-page anchors such as /#courts do not change the pathname, so each link
  // closes the panel on click as well.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath !== null && openPath === pathname;

  const setOpen = (next: boolean) => setOpenPath(next ? pathname : null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // The state setter rather than the local helper: it is stable across renders, so
      // the effect does not need to re-subscribe on every one.
      setOpenPath(null);
      buttonRef.current?.focus();
    }

    // Stop the page behind the panel from scrolling while it is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Затвори менюто" : "Отвори менюто"}
        className="flex items-center justify-center rounded-lg border border-white/15 p-2 text-white/80 transition-colors hover:text-white lg:hidden"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <>
          {/* Portalled onto <body> on purpose. The header sets backdrop-blur, and
              backdrop-filter makes an element a containing block for its fixed-position
              descendants — so rendering this in place pinned it to the 72px-tall header
              and it measured 0px high, leaving taps outside the panel doing nothing. */}
          {createPortal(
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={close}
              className="fixed inset-0 top-(--header-h) z-40 cursor-default bg-navy-950/70 lg:hidden"
            />,
            document.body,
          )}

          <div
            id={panelId}
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100vh-var(--header-h))] overflow-y-auto border-b border-white/10 bg-navy-900 shadow-xl shadow-black/40 lg:hidden"
          >
            <nav className="px-6 py-3">
              <ul>
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={close}
                      className="block border-b border-white/5 py-3.5 text-sm text-white/80 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 py-4">
                {user ? (
                  <>
                    {user.isAdmin && (
                      <MenuAction
                        href="/admin"
                        icon={<LayoutDashboard size={16} />}
                        onClick={close}
                      >
                        Администрация
                      </MenuAction>
                    )}

                    <MenuAction
                      href="/my-bookings"
                      icon={<User size={16} />}
                      onClick={close}
                    >
                      Моите резервации
                    </MenuAction>

                    <p className="px-1 pt-1 text-xs text-white/35">
                      Влезли сте като {user.label}
                    </p>

                    <form action={signOutAction}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 px-3 py-3 text-sm text-white/70 transition-colors hover:text-white"
                      >
                        <LogOut size={16} />
                        Изход
                      </button>
                    </form>
                  </>
                ) : (
                  <MenuAction href="/login" icon={<LogIn size={16} />} onClick={close}>
                    Вход с Google
                  </MenuAction>
                )}

               <Link
                  href="/booking"
                  onClick={close}
                  className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-brand-400"
                >
                  <CalendarDays size={16} strokeWidth={2.5} />
                  Резервирай корт
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}

function MenuAction({
  href,
  icon,
  onClick,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg border border-white/10 px-3 py-3 text-sm text-white/80 transition-colors hover:text-white"
    >
      {icon}
      {children}
    </Link>
  );
}

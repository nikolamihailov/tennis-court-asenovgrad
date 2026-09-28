import Link from "next/link";

import Badge from "@/components/admin/Badge";
import TrainerRoleControl from "@/components/admin/TrainerRoleControl";
import { displayEmail } from "@/lib/contact";
import { requireAdmin } from "@/lib/dal";
import { formatClubDateShort } from "@/lib/time";
import { listUsers } from "@/server/analytics";

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  await requireAdmin();

  const params = await searchParams;
  const search =
    typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const onlyTrainers = params.role === "TRAINER";

  const users = await listUsers(search, onlyTrainers ? "TRAINER" : undefined);

  const filterHref = (trainers: boolean) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (trainers) query.set("role", "TRAINER");
    return `/admin/users${query.size > 0 ? `?${query.toString()}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold">Потребители</h1>
      <p className="mt-1 text-white/60">
        Включва и гостите — всеки, който е резервирал, има запис тук. Регистриран
        потребител може да бъде направен треньор; ще получи имейл и достъп до треньорски
        панел.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action="/admin/users" className="flex flex-1 gap-2">
          {onlyTrainers && <input type="hidden" name="role" value="TRAINER" />}
          <input
            name="q"
            defaultValue={search}
            placeholder="Търси по име или имейл…"
            className="w-full max-w-sm rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-brand-500"
          />
          <button
            type="submit"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 hover:text-white"
          >
            Търси
          </button>
        </form>

        <div className="flex gap-2">
          {[
            { trainers: false, label: "Всички" },
            { trainers: true, label: "Треньори" },
          ].map((option) => (
            <Link
              key={option.label}
              href={filterHref(option.trainers)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                onlyTrainers === option.trainers
                  ? "bg-brand-500 text-navy-950"
                  : "border border-white/10 bg-navy-800 text-white/70 hover:text-white"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      {users.length === 0 ? (
        <p className="mt-6 rounded-xl border border-white/5 bg-navy-800 p-6 text-white/50">
          {onlyTrainers ? "Все още няма треньори." : "Няма намерени потребители."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/5 bg-navy-800">
          <table className="w-full min-w-230 text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-5 py-3 font-medium">Име</th>
                <th className="px-5 py-3 font-medium">Имейл</th>
                <th className="px-5 py-3 font-medium">Телефон</th>
                <th className="px-5 py-3 font-medium">Тип</th>
                <th className="px-5 py-3 text-right font-medium">Резервации</th>
                <th className="px-5 py-3 font-medium">Последна</th>
                <th className="px-5 py-3 font-medium">Регистриран</th>
                <th className="px-5 py-3 text-right font-medium">Треньор</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 font-medium">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-white/70">
                    {displayEmail(user.email) ?? (
                      <span className="text-white/35">няма имейл</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-white/55">{user.phone ?? "—"}</td>
                  <td className="px-5 py-3">
                    {user.role === "ADMIN" ? (
                      <Badge tone="brand">админ</Badge>
                    ) : user.role === "TRAINER" ? (
                      <Badge tone="brand">треньор</Badge>
                    ) : (
                      <Badge>{user.isGuest ? "гост" : "регистриран"}</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-white/70">
                    {user.bookingCount}
                  </td>
                  <td className="px-5 py-3 text-white/55">
                    {user.lastBookingAt ? formatClubDateShort(user.lastBookingAt) : "—"}
                  </td>
                  <td className="px-5 py-3 text-white/55">
                    {formatClubDateShort(user.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <TrainerRoleControl
                      userId={user.id}
                      role={user.role}
                      isGuest={user.isGuest}
                      hourlyRate={user.trainerRate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

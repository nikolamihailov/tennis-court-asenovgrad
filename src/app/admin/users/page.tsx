import Badge from "@/components/admin/Badge";
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

  const users = await listUsers(search);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold">Потребители</h1>
      <p className="mt-1 text-white/60">
        Включва и гостите — всеки, който е резервирал, има запис тук.
      </p>

      <form action="/admin/users" className="mt-6 flex gap-2">
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

      {users.length === 0 ? (
        <p className="mt-6 rounded-xl border border-white/5 bg-navy-800 p-6 text-white/50">
          Няма намерени потребители.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/5 bg-navy-800">
          <table className="w-full min-w-180 text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-5 py-3 font-medium">Име</th>
                <th className="px-5 py-3 font-medium">Имейл</th>
                <th className="px-5 py-3 font-medium">Телефон</th>
                <th className="px-5 py-3 font-medium">Тип</th>
                <th className="px-5 py-3 text-right font-medium">Резервации</th>
                <th className="px-5 py-3 font-medium">Последна</th>
                <th className="px-5 py-3 font-medium">Регистриран</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 font-medium">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-white/70">{user.email}</td>
                  <td className="px-5 py-3 text-white/55">{user.phone ?? "—"}</td>
                  <td className="px-5 py-3">
                    {user.role === "ADMIN" ? (
                      <Badge tone="brand">админ</Badge>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

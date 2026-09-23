import CourtsManager from "@/components/admin/CourtsManager";
import { requireAdmin } from "@/lib/dal";
import { listAllCourts } from "@/server/courts";

export default async function AdminCourtsPage() {
  await requireAdmin();
  const courts = await listAllCourts();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold">Кортове</h1>
      <p className="mt-1 text-white/60">
        Кортовете се деактивират, а не се изтриват — съществуващите резервации
        продължават да сочат към тях.
      </p>

      <CourtsManager courts={courts} />
    </div>
  );
}

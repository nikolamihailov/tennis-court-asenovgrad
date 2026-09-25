import { LoadingRegion, Skeleton } from "@/components/Skeleton";

/**
 * Mirrors the confirmation card. Without this, the booking board's skeleton from
 * ../loading.tsx stood in for a page that has no board.
 */
export default function Loading() {
  return (
    <LoadingRegion>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-white/10 bg-navy-800 p-8">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="mt-5 h-7 w-64 max-w-full" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />

          <div className="mt-6 space-y-3 rounded-xl bg-navy-900 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex justify-between gap-4">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            ))}
          </div>

          <div className="mt-8 flex gap-3">
            <Skeleton className="h-10 w-40 rounded-full" />
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

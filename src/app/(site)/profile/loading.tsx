import { HeaderSkeleton, LoadingRegion, Skeleton } from "@/components/Skeleton";

/** Mirrors the profile: the personal-details card, then the two booking lists. */
export default function Loading() {
  return (
    <LoadingRegion>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <HeaderSkeleton />

        <div className="mt-8 rounded-2xl border border-white/10 bg-navy-800 p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
          <Skeleton className="mt-4 h-12 rounded-lg" />
          <Skeleton className="mt-4 h-12 rounded-lg" />
        </div>

        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="mt-10">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="mt-3 h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

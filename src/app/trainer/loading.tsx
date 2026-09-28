import { HeaderSkeleton, LoadingRegion, Skeleton } from "@/components/Skeleton";

/** The trainer dashboard: stat tiles above the week. Also the fallback for trainer pages. */
export default function Loading() {
  return (
    <LoadingRegion>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <HeaderSkeleton />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </LoadingRegion>
  );
}

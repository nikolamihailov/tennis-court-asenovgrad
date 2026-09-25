import { HeaderSkeleton, LoadingRegion, Skeleton } from "@/components/Skeleton";

/** The dashboard: five stat tiles above two panels. Also the fallback for admin pages. */
export default function Loading() {
  return (
    <LoadingRegion>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <HeaderSkeleton />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
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

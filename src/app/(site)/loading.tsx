import { HeaderSkeleton, LoadingRegion, Skeleton } from "@/components/Skeleton";

/** Fallback for the public pages that have no more specific skeleton of their own. */
export default function Loading() {
  return (
    <LoadingRegion>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <HeaderSkeleton />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

import { HeaderSkeleton, LoadingRegion, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <HeaderSkeleton />
        <Skeleton className="mt-6 h-11 w-40 rounded-lg" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

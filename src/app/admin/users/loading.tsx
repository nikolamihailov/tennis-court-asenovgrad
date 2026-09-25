import { HeaderSkeleton, LoadingRegion, TableSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <HeaderSkeleton />
        <TableSkeleton rows={6} />
      </div>
    </LoadingRegion>
  );
}

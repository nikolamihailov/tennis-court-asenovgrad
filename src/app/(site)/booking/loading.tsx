import { HeaderSkeleton, LoadingRegion, Skeleton } from "@/components/Skeleton";

/** Mirrors the booking board: court panels on the left, summary rail on the right. */
export default function Loading() {
  return (
    <LoadingRegion>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <HeaderSkeleton />

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-navy-800 p-5">
              <Skeleton className="h-12 w-44 rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>

            <div className="mt-6 space-y-6">
              {Array.from({ length: 2 }, (_, court) => (
                <section
                  key={court}
                  className="rounded-2xl border border-white/5 bg-navy-800 p-6"
                >
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-3 w-40" />
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {Array.from({ length: 8 }, (_, slot) => (
                      <Skeleton key={slot} className="h-10 rounded-lg" />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </LoadingRegion>
  );
}

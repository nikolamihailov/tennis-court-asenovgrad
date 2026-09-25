/**
 * Loading placeholders.
 *
 * Every page here reads from the database at request time, so each one can be waiting on
 * a query. These give Next.js something to stream while that happens, instead of the
 * browser sitting on the previous page with no sign anything is occurring.
 *
 * They are shaped roughly like the content they stand in for, so the layout does not jump
 * when the real thing arrives.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

/** Announces the wait to screen readers, which see no visual change. */
export function LoadingRegion({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Зареждане…</span>
      {children}
    </div>
  );
}

/** Stand-in for the admin tables: a filter bar above a block of rows. */
export function TableSkeleton({
  rows = 6,
  filters = true,
}: {
  rows?: number;
  filters?: boolean;
}) {
  return (
    <>
      {filters && (
        <div className="mt-6 space-y-4 rounded-xl border border-white/5 bg-navy-800 p-5">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-28 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-white/5 bg-navy-800">
        <div className="border-b border-white/5 px-5 py-3">
          <Skeleton className="h-3 w-40" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-0"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </>
  );
}

/** Page title and subtitle, shared by every loading screen. */
export function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

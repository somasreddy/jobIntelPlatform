import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback (Next.js App Router convention). Mirrors the
 * page's own layout shape — header, KPI grid, tab strip, chart card — so the
 * transition into the real content doesn't jump around. This only covers the
 * server-render/streaming phase; the client component shows its own
 * equivalent Skeleton state while its client-side data fetch is in flight.
 */
export default function InsightsLoading() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </main>
    </div>
  );
}

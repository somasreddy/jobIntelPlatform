import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI (Next.js App Router convention) — shown while this
 * segment's JS is being fetched/hydrated during navigation. Distinct from the
 * in-page `loading` state in page.tsx, which covers the client-side
 * fetchRadar() call after the route itself has already mounted.
 */
export default function MarketRadarLoading() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-5xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44 rounded-md" />
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Tab strip */}
        <Skeleton className="h-11 w-full rounded-xl mb-6" />

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>

        {/* Chart-sized block */}
        <Skeleton className="h-64 rounded-xl" />
      </main>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback (Next.js App Router convention). Mirrors the
 * page's own layout shape — header, tab strip, KPI grid, skill-demand +
 * sidebar cards — so the transition into the real content doesn't jump
 * around. This only covers the server-render/streaming phase; the client
 * component manages its own loading state for the client-side data fetch.
 */
export default function IntelligenceLoading() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-5xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-72 rounded-xl" />
          <div className="space-y-5">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level fallback shown while the /career-graph route segment loads.
 * Mirrors the page's header + tab-strip + card shape so there's no layout
 * shift once CareerGraphClient mounts and replaces it with real data.
 */
export default function CareerGraphLoading() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>

        <Skeleton className="h-11 w-full rounded-xl mb-6" />

        <div className="space-y-6">
          <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <Skeleton className="h-[130px] w-[130px] rounded-full shrink-0" />
            <div className="flex-1 w-full space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1].map(i => (
              <div key={i} className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-36" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

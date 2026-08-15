import { Skeleton } from "@/components/ui/skeleton";

export default function PublicPortfolioLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, var(--accent-deep) 0%, var(--bg-card) 60%)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Skeleton className="w-20 h-20 md:w-24 md:h-24 rounded-2xl shrink-0" />
            <div className="flex-1 min-w-0 w-full space-y-3">
              <Skeleton className="h-8 w-2/3 max-w-sm" />
              <Skeleton className="h-4 w-full max-w-lg" />
              <Skeleton className="h-4 w-3/4 max-w-md" />
              <div className="flex gap-3 mt-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        <div>
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-xl" />
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="h-4 w-40 mb-4" />
          <div className="grid md:grid-cols-2 gap-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

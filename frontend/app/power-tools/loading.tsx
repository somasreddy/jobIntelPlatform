import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Next.js App Router route-level loading UI — shown while this route segment
// is being fetched/rendered (e.g. first navigation to /power-tools). Mirrors
// the shape of the real page (header, profile banner, tool card list) so the
// transition into real content doesn't jump around.
export default function PowerToolsLoading() {
  return (
    <div className="min-h-screen md:ml-64 xl:mr-72 p-6 md:p-8 space-y-6" style={{ background: "var(--bg-primary)" }} aria-busy="true" aria-label="Loading Power Tools">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-28 rounded-full" />
          ))}
        </div>
      </div>

      {/* Profile banner */}
      <div className="max-w-3xl">
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-7 w-20 rounded-lg shrink-0" />
          </CardContent>
        </Card>
      </div>

      {/* Tool cards */}
      <div className="space-y-3 max-w-3xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shared loading placeholder for Autopilot — mirrors the real layout
 * (header, master toggle, stat row, queue cards) so the route-level
 * `loading.tsx` Suspense fallback and the client component's own in-flight
 * fetch state render the same skeleton instead of two different ad-hoc
 * spinners.
 */
export default function AutopilotSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>

        {/* Master toggle */}
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-5 w-8 rounded-full" />
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="text-center pt-6">
                <Skeleton className="h-7 w-10 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Queue */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 pt-6">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

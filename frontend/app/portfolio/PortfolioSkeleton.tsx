import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shared loading placeholder for the portfolio builder — mirrors the real
 * layout (header, slug bar, tabs, form card) so the route-level `loading.tsx`
 * Suspense fallback and the client component's own in-flight fetch state
 * render the same skeleton instead of two different ad-hoc spinners.
 */
export default function PortfolioSkeleton() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-4xl w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>

        <Skeleton className="h-16 w-full rounded-xl mb-5" />
        <Skeleton className="h-11 w-full rounded-xl mb-5" />

        <Card>
          <CardContent className="space-y-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="grid sm:grid-cols-3 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-40" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

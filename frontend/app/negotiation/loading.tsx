import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback (Next.js App Router convention). Mirrors the
 * negotiation page's own shell — header, step tabs, offer-form card — so
 * navigation into this route never flashes a blank page while the segment's
 * JS is fetched/rendered.
 */
export default function NegotiationLoading() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-3xl">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl mb-6" />
        <Card className="card gap-4">
          <Skeleton className="h-5 w-56" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </Card>
      </main>
    </div>
  );
}

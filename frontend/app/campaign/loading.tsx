import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Next.js route-level Suspense fallback — shown while the /campaign route
// segment streams in (initial navigation/hydration). The dashboard itself
// also renders a matching skeleton while `campaignLoading` is true client
// side; this one covers the moment before that client state exists at all.
export default function CampaignLoading() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-5">
          {[0, 1, 2].map(i => (
            <Card key={i} className="gap-4 py-5 backdrop-blur-xl">
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="lg:col-span-2">
          <Card className="h-full gap-4 py-6 backdrop-blur-xl">
            <CardContent className="space-y-3">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-16 w-full rounded-lg" />
              {[0, 1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

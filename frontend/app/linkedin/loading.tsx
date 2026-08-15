import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Next.js App Router route-level loading UI — shown while this route segment
// is being fetched/rendered (e.g. first navigation to /linkedin). Mirrors the
// shape of the real page (header, input card, summary tiles, suggestion
// cards) so the transition into real content doesn't jump around.
export default function LinkedInEnhancerLoading() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>

        {/* Input card */}
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 w-36 rounded-md shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Summary tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="py-3">
              <CardContent className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Suggestion cards */}
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-4">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-14 rounded" />
                  </div>
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

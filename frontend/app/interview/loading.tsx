import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function InterviewPrepLoading() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>

        {/* Domain chips */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-3 w-32" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </div>

        {/* Setup card */}
        <Card className="mb-6 backdrop-blur-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>

        {/* Question list */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="backdrop-blur-xl p-6">
              <div className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

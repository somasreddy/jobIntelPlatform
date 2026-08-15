import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function DsaSandboxLoading() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="w-5 h-5 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-48" />
          </div>
        </div>

        {/* Info banner */}
        <Skeleton className="h-10 w-full rounded-xl mb-5" />

        {/* Problem chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Problem detail card */}
          <Card className="backdrop-blur-xl p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </Card>

          {/* Editor card */}
          <Card className="backdrop-blur-xl p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </Card>
        </div>
      </main>
    </div>
  );
}

import { BookOpen, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// Next.js App Router route-level Suspense fallback — shown while this route's
// RSC payload/client bundle is loading, i.e. before LearnPageClient mounts
// and runs its own (data-fetch) loading state. Mirrors that in-component
// skeleton so there's no visual "flash" between the two.
export default function LearnLoading() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6" style={{ color: "var(--accent)" }} />
            Learning Engine
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Close skill gaps with AI-curated learning paths</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card className="card gap-3 p-4 shadow-none">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Generate Path
              </h3>
              <Skeleton className="h-9 w-full rounded-lg" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-9 rounded-lg" />
                <Skeleton className="h-9 rounded-lg" />
              </div>
              <Skeleton className="h-9 w-full rounded-lg" />
            </Card>
            {[0, 1, 2].map((i) => (
              <Card key={i} className="card gap-2 p-4 shadow-none">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-32" />
              </Card>
            ))}
          </div>
          <div className="lg:col-span-2">
            <Card className="card gap-4 p-6 shadow-none">
              <div className="flex items-center gap-4">
                <Skeleton className="h-[72px] w-[72px] rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <Separator />
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

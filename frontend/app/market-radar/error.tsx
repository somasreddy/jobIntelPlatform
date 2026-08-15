"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary (Next.js App Router convention). Catches render
 * crashes in this segment — separate from the in-page fetch-failure handling
 * in page.tsx (DemoDataBanner / EmptyState), which covers the market data
 * requests failing while the page itself renders fine.
 */
export default function MarketRadarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Market Radar route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-5xl w-full flex items-center justify-center">
        <div className="card p-8 max-w-md w-full text-center flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(244, 63, 94, 0.12)" }}
          >
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Market Radar hit a snag</h2>
            <p className="text-sm text-slate-400">
              Something went wrong rendering this page. This is separate from the market data
              fetches, which handle their own retries.
            </p>
          </div>
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Try again
          </Button>
        </div>
      </main>
    </div>
  );
}

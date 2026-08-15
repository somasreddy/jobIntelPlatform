"use client";

import { useEffect } from "react";
import { AlertTriangle, DollarSign, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NegotiationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No telemetry service wired up yet — console is the only sink for now
    // (matches the root app/error.tsx boundary's convention).
    console.error("Negotiation module error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 flex items-center px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-3xl">
        <Card className="card w-full text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            <AlertTriangle className="w-6 h-6" style={{ color: "var(--accent-bright)" }} />
          </div>
          <h1 className="text-lg font-bold text-white flex items-center justify-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-400" />
            Negotiation playbook hit a snag
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Something interrupted the negotiation coach. This wizard keeps your offer and market
            details only in this browser tab, so they weren&apos;t saved anywhere else — try again
            before navigating away.
          </p>
          {error?.digest && (
            <p className="text-[11px] mt-3 font-mono" style={{ color: "var(--text-muted)" }}>
              Error ref: {error.digest}
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button type="button" onClick={() => reset()} className="btn-primary h-auto flex items-center justify-center gap-2 text-sm">
              <RotateCcw className="w-4 h-4" />
              Try again
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}

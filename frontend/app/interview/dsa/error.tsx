"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DsaSandboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("DSA Sandbox page error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-md w-full rounded-lg p-8 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <AlertTriangle className="w-6 h-6" style={{ color: "var(--accent-bright)" }} />
        </div>
        <h1 className="text-lg font-bold text-white">The DSA sandbox hit a snag</h1>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          Something interrupted the code sandbox. This never touched a server — try reloading the sandbox, or head back to the dashboard.
        </p>
        {error?.digest && (
          <p className="text-[11px] mt-3 font-mono" style={{ color: "var(--text-muted)" }}>
            Error ref: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          <Button type="button" onClick={() => reset()} className="btn-primary h-auto w-full sm:w-auto flex items-center justify-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4" />
            Try again
          </Button>
          <Button asChild className="btn-secondary h-auto w-full sm:w-auto flex items-center justify-center gap-2 text-sm">
            <Link href="/">
              <Home className="w-4 h-4" />
              Back to home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

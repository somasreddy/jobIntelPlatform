"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ServerCrash } from "lucide-react";
import "./globals.css";

// Next.js requires this file to render its own <html>/<body> because it
// replaces the root layout entirely when the layout itself throws. Kept
// intentionally minimal — no providers, no fonts — since those are exactly
// what may have failed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No telemetry service wired up yet — console is the only sink for now.
    console.error("Unhandled root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        className="min-h-screen flex items-center justify-center px-4 py-16"
        style={{ background: "var(--bg-base, #060d24)", color: "var(--text-primary, #e8eaf6)", fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <div
          className="max-w-md w-full rounded-lg p-8 text-center"
          style={{ background: "var(--bg-card, rgba(15,25,60,0.9))", border: "1px solid var(--border, rgba(99,102,241,0.3))" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: "var(--bg-elevated, rgba(22,35,80,0.9))", border: "1px solid var(--border, rgba(99,102,241,0.3))" }}
          >
            <ServerCrash className="w-6 h-6" style={{ color: "var(--accent-bright, #818cf8)" }} />
          </div>
          <h1 className="text-lg font-bold">Application error</h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-secondary, #94a3b8)" }}>
            A critical error prevented this page from loading. Reloading usually fixes it.
          </p>
          {error?.digest && (
            <p className="text-[11px] mt-3 font-mono" style={{ color: "var(--text-muted, #4b5880)" }}>
              Error ref: {error.digest}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
            <button type="button" onClick={() => reset()} className="btn-primary w-full sm:w-auto">
              Reload
            </button>
            <Link href="/" className="btn-secondary w-full sm:w-auto inline-flex items-center justify-center">
              Back to home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}

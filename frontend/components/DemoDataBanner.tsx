"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

interface DemoDataBannerProps {
  /** Override the default copy. */
  message?: string;
  /** Extra classes for the outer wrapper (e.g. margin overrides). */
  className?: string;
}

/**
 * Dismissible notice for pages that had to fall back to the bundled mock
 * data (see lib/mockData.ts) because the live API was unreachable or
 * returned nothing. Colors follow the same rgba-background / tinted-border
 * pattern used by the .badge-* rules in globals.css (amber = caution, kept
 * distinct from badge-verified's emerald and badge-hot's rose) so it reads
 * as part of the existing design system rather than a one-off alert.
 */
export default function DemoDataBanner({
  message = "Showing demo data — live data unavailable",
  className = "",
}: DemoDataBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 mb-4 text-xs font-semibold ${className}`}
      style={{
        background: "rgba(245, 158, 11, 0.10)",
        color: "#f59e0b",
        border: "1px solid rgba(245, 158, 11, 0.28)",
      }}
    >
      <span className="flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0" />
        {message}
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss demo data notice"
        className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-white/10"
        style={{ color: "inherit" }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

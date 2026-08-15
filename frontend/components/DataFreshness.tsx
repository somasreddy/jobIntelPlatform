"use client";

import { useEffect, useState } from "react";
import { Radio, Database, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataFreshnessVariant = "live" | "static" | "offline";

export interface DataFreshnessProps {
  /**
   * When the underlying fetch actually completed. A plain client-side
   * `Date` (or ISO string / epoch ms) is fine here — this is a *display*
   * timestamp for "how fresh is this on screen", never something persisted
   * as business data. Required for `variant="live"`; ignored otherwise.
   */
  timestamp?: Date | string | number | null;
  /**
   * Plain-language description of where the data actually came from, e.g.
   * "your profile data", "job market API", "salary prediction model".
   * Never invent a vendor/provider name that isn't real — describe the
   * actual endpoint or data source.
   */
  source: string;
  /**
   * `live`    — data just came back from a real API call (needs `timestamp`).
   * `static`  — bundled/hardcoded reference data, not fetched live.
   * `offline` — a live call was attempted but failed / is unreachable.
   * Defaults to "live".
   */
  variant?: DataFreshnessVariant;
  className?: string;
}

function toDate(t: Date | string | number): Date {
  return t instanceof Date ? t : new Date(t);
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Small, honest data-provenance indicator — "Last updated {time} · Live ·
 * {source}" for genuinely-fetched data, or a clearly-different phrasing for
 * bundled/static reference data and offline/unreachable states. Shared by
 * any page that mixes real API data with sample/reference data, so the two
 * never look visually identical.
 *
 * Deliberately tiny and inline (matches the existing text-xs/[11px]
 * text-slate-500 micro-copy already used across the dashboard) rather than
 * a banner — DemoDataBanner/EmptyState still own the "this whole section is
 * a fallback" case, this owns the per-section provenance caption.
 */
export default function DataFreshness({
  timestamp,
  source,
  variant = "live",
  className = "",
}: DataFreshnessProps) {
  const date = timestamp != null ? toDate(timestamp) : null;
  // Re-render periodically so "2m ago" keeps advancing without a full refetch.
  const [, tick] = useState(0);
  useEffect(() => {
    if (variant !== "live" || !date) return;
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, date?.getTime()]);

  const Icon = variant === "live" ? Radio : variant === "offline" ? WifiOff : Database;
  const iconColor =
    variant === "live" ? "text-emerald-400" : variant === "offline" ? "text-amber-400" : "text-slate-500";

  let label: string;
  if (variant === "live" && date) {
    label = `Last updated ${formatRelative(date)} · Live · ${source}`;
  } else if (variant === "offline") {
    label = `Unavailable · ${source}`;
  } else {
    label = `Static reference · ${source}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] text-slate-500 leading-relaxed",
        className
      )}
    >
      <Icon className={cn("w-3 h-3 shrink-0", iconColor)} />
      {label}
    </span>
  );
}

import * as React from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value on a 0–`max` scale. Always pass a real, derived number — never a placeholder. */
  value?: number;
  max?: number;
  /** Extra classes for the moving indicator bar (e.g. to recolor per status). */
  indicatorClassName?: string;
}

/**
 * Hand-authored shadcn/ui-style Progress primitive.
 *
 * Upstream shadcn/ui's `progress.tsx` wraps `@radix-ui/react-progress`, which
 * isn't a dependency of this project (yet). This mirrors its exact class
 * contract — a `bg-primary/20` track with a `bg-primary` indicator driven by
 * `translateX` — using a plain div, so it's a drop-in 1:1 replacement if
 * `@radix-ui/react-progress` is ever added later (swap the internals, call
 * sites stay `<Progress value={pct} />`).
 */
function Progress({
  className,
  value = 0,
  max = 100,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const pct = Number.isFinite(value) && max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          "bg-primary h-full w-full flex-1 rounded-full transition-transform duration-500 ease-out",
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </div>
  );
}

export { Progress };

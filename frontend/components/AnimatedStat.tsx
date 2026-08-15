"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, animate } from "motion/react";

interface AnimatedStatProps {
  /** Final numeric value to count up to. */
  value: number;
  /** Animation duration in seconds. Kept short/subtle by default. */
  duration?: number;
  /** Optional formatter for the displayed number (e.g. add a "%" suffix). */
  formatter?: (value: number) => string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Animates a numeric stat counting up from 0 to `value` on mount.
 * Writes the rounded value to the span directly on every frame (rather than
 * rendering a MotionValue as React children) so it isn't dependent on
 * SSR/hydration correctly claiming a motion-value-subscribed text node.
 */
export default function AnimatedStat({ value, duration = 0.7, formatter, className, style }: AnimatedStatProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const count = useMotionValue(0);

  useEffect(() => {
    const format = (n: number) => (formatter ? formatter(n) : n.toLocaleString());
    const controls = animate(count, value, {
      duration,
      ease: "easeOut",
      onUpdate: latest => {
        if (ref.current) ref.current.textContent = format(Math.round(latest));
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {formatter ? formatter(0) : "0"}
    </span>
  );
}

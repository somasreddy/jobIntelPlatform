/**
 * Shared motion tokens for the `motion` (Framer Motion) library.
 *
 * Mirrors the timing/easing values already established in
 * `frontend/app/globals.css` (--spring, --ease-smooth, --ease-out-quint) so
 * JS-driven animations (motion.div, AnimatePresence, etc.) feel consistent
 * with the CSS-driven ones (.mac-hover, .collapsible-content, .tag, ...).
 *
 * Import these instead of hardcoding durations/easings in individual
 * components, e.g.:
 *
 *   import { durations, easings } from "@/lib/motion-tokens";
 *   <motion.div
 *     initial={{ opacity: 0, y: 8 }}
 *     animate={{ opacity: 1, y: 0 }}
 *     transition={{ duration: durations.base, ease: easings.outQuint }}
 *   />
 */

/** Durations in seconds, for `transition={{ duration: durations.base }}`. */
export const durations = {
  /** Micro-interactions: toggles, checkbox ticks, tag press feedback. */
  instant: 0.1,
  /** Hover states, button presses, small UI feedback. */
  fast: 0.18,
  /** Default for most enter/exit transitions (cards, panels, tooltips). */
  base: 0.25,
  /** Modal/sheet/drawer open-close, collapsible sections. */
  slow: 0.4,
  /** Full-page transitions, hero reveals, large layout shifts. */
  slower: 0.6,
} as const;

/**
 * Cubic-bezier easing curves as [x1, y1, x2, y2] tuples — the shape Motion's
 * `transition.ease` expects. Keep these in sync with the CSS custom
 * properties of the same name/intent in globals.css.
 */
export const easings = {
  /** Matches CSS --spring: cubic-bezier(0.34, 1.56, 0.64, 1) — bouncy,
   *  macOS-style overshoot. Use for playful, springy UI (tag press, chevron
   *  rotation, card pop-in). */
  spring: [0.34, 1.56, 0.64, 1],
  /** Matches CSS --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1) — the standard
   *  "ease-in-out" material curve. Use for most background/color/opacity
   *  transitions. Numerically identical to `easeInOut` below — kept as a
   *  separate named export so call sites can express intent (matching a
   *  specific CSS token vs. "just use the standard curve"). */
  smooth: [0.4, 0, 0.2, 1],
  /** Matches CSS --ease-out-quint: cubic-bezier(0.23, 1, 0.32, 1) — fast
   *  start, long gentle settle. Use for elements sliding/fading into view
   *  (page transitions, reveals). */
  outQuint: [0.23, 1, 0.32, 1],
  /** Standard ease-out (Material "decelerate"): quick start, gradual stop.
   *  Use for elements entering the screen. */
  easeOut: [0, 0, 0.2, 1],
  /** Standard ease-in-out (Material "standard"): symmetric acceleration then
   *  deceleration. Use for two-way/looping transitions. */
  easeInOut: [0.4, 0, 0.2, 1],
} as const;

export type DurationToken = keyof typeof durations;
export type EasingToken = keyof typeof easings;

/** Convenience helper for building a Motion `transition` object from tokens,
 *  e.g. `transition={motionTransition("slow", "spring")}`. */
export function motionTransition(
  duration: DurationToken = "base",
  easing: EasingToken = "smooth"
) {
  return { duration: durations[duration], ease: easings[easing] };
}

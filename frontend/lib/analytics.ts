/**
 * Analytics helper — wraps PostHog for event tracking.
 * Falls back silently when PostHog is not configured.
 *
 * Setup:
 *   1. npm install posthog-js
 *   2. Set NEXT_PUBLIC_POSTHOG_KEY in .env.local
 *   3. Optionally set NEXT_PUBLIC_POSTHOG_HOST (defaults to PostHog cloud)
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let posthog: any = null;
let initAttempted = false;

async function getPostHog() {
  if (!POSTHOG_KEY) return null;
  if (posthog) return posthog;
  if (initAttempted) return null;
  initAttempted = true;

  try {
    // posthog-js is optional — install with: npm i posthog-js
    // @ts-expect-error — optional peer dep, not installed by default
    const ph = (await import("posthog-js").catch(() => null))?.default;
    if (!ph) return null;
    ph.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,   // we call trackPageView manually
      autocapture: false,
      persistence: "localStorage",
      disable_session_recording: true,
    });
    posthog = ph;
    return posthog;
  } catch {
    return null;
  }
}

/** Identify the logged-in user. Call on login/auth restore. */
export async function identifyUser(userId: string, properties?: Record<string, unknown>) {
  const ph = await getPostHog();
  if (!ph) return;
  ph.identify(userId, properties);
}

/** Track page view. Call in layout useEffect on pathname change. */
export async function trackPageView(path: string) {
  const ph = await getPostHog();
  if (!ph) return;
  ph.capture("$pageview", { $current_url: path });
}

/** Track a feature event. */
export async function track(event: string, properties?: Record<string, unknown>) {
  const ph = await getPostHog();
  if (!ph) return;
  ph.capture(event, properties ?? {});
}

/** Reset identity on logout. */
export async function resetIdentity() {
  const ph = await getPostHog();
  if (!ph) return;
  ph.reset();
}

// ── Pre-defined event helpers ─────────────────────────────────────────────────

export const Analytics = {
  jobViewed: (jobId: string, fitScore?: number) =>
    track("job_viewed", { job_id: jobId, fit_score: fitScore }),

  jobApplied: (jobId: string, method: "autopilot" | "manual") =>
    track("job_applied", { job_id: jobId, method }),

  resumeGenerated: (type: "ats" | "cover_letter" | "master") =>
    track("resume_generated", { type }),

  interviewStarted: (mode: string, questionCount: number) =>
    track("interview_started", { mode, question_count: questionCount }),

  interviewCompleted: (mode: string, avgScore: number) =>
    track("interview_completed", { mode, avg_score: avgScore }),

  learningPathCreated: (skillName: string) =>
    track("learning_path_created", { skill: skillName }),

  learningCompleted: (skillName: string) =>
    track("learning_completed", { skill: skillName }),

  autopilotEnabled: () =>
    track("autopilot_enabled"),

  autopilotScanRun: (enqueued: number) =>
    track("autopilot_scan_run", { enqueued }),

  portfolioViewed: (slug: string) =>
    track("portfolio_viewed", { slug }),

  themeChanged: (theme: string) =>
    track("theme_changed", { theme }),

  featureUsed: (feature: string) =>
    track("feature_used", { feature }),
};

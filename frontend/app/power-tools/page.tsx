import type { Metadata } from "next";
import PowerToolsClient from "./PowerToolsClient";

// Metadata exports are only valid from Server Components, so this thin
// server wrapper holds the per-page <title>/description and simply renders
// the "use client" page (PowerToolsClient) that owns all state/hooks.
export const metadata: Metadata = {
  title: "Power Tools – AI Job Search Weapons | JobIntel AI",
  description:
    "Eight AI-powered tools for job seekers: decode what a hiring manager really wants, rewrite your resume for ATS, optimise your LinkedIn profile, prep for interview traps, draft cold outreach, negotiate your offer, reframe a career gap, and build a 48-hour job search attack plan.",
};

export default function PowerToolsPage() {
  return <PowerToolsClient />;
}

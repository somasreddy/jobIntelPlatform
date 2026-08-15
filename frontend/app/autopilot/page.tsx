import type { Metadata } from "next";
import AutopilotClient from "./AutopilotClient";

export const metadata: Metadata = {
  title: "Autopilot – JobIntel AI",
  description:
    "Set a minimum fit score, a daily application cap, and excluded companies, then review AI-drafted resumes and cover letters queued for your approval before Autopilot applies on your behalf.",
};

// This route needs client state (auth token, live settings form, the
// approval queue) so the actual UI lives in a client component; this file
// stays a plain Server Component only so it can export static `metadata`
// (not allowed from a "use client" module).
export default function AutopilotPage() {
  return <AutopilotClient />;
}

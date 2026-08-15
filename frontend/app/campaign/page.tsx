import type { Metadata } from "next";
import CampaignDashboard from "./campaign-dashboard";

// `CampaignDashboard` is a client component (it reads AppDataContext, tracks
// local UI state, and fetches the daily to-do list), so metadata can't live
// in that file directly — Next.js forbids exporting `metadata` from a module
// marked "use client". This thin server wrapper is the standard way around
// that: it owns the route's metadata and simply renders the client tree.
export const metadata: Metadata = {
  title: "Campaign — Daily Job Search Plan | JobIntel AI",
  description:
    "Set a target role, salary range and deadline, then track daily applications, evaluations and outreach against your goals — with streaks, pipeline stats, and an AI-generated action plan for today.",
};

export default function CampaignPage() {
  return <CampaignDashboard />;
}

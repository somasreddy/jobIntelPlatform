import type { Metadata } from "next";
import PortfolioBuilderClient from "./PortfolioBuilderClient";

export const metadata: Metadata = {
  title: "Portfolio Builder – JobIntel AI",
  description:
    "Build and manage your public career portfolio: headline, AI-generated bio, skills, certifications, and featured projects — all editable in one place.",
};

// This route needs client state (auth token, live form editing, localStorage
// offline fallback) so the actual UI lives in a client component; this file
// stays a plain Server Component only so it can export static `metadata`
// (not allowed from a "use client" module).
export default function PortfolioPage() {
  return <PortfolioBuilderClient />;
}

import type { Metadata } from "next";
import LearnPageClient from "./LearnPageClient";

export const metadata: Metadata = {
  title: "Learning Engine — JobIntel AI",
  description:
    "Generate AI-curated learning paths for your skill gaps, track resource completions, and watch real progress toward each target skill level.",
};

// Server component wrapper — keeps the interactive page (data fetching,
// local UI state) in a client component while still letting this route
// export static metadata, which Next.js only allows from a Server Component.
export default function LearnPage() {
  return <LearnPageClient />;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Mock Session – JobIntel AI",
  description:
    "Run a timed, live mock interview with thinking and answering countdowns, voice input, instant clarity/specificity/relevance scoring, and one-click saves to your Story Bank.",
};

export default function InterviewSimulatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}

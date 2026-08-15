import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shadow Interview Review – JobIntel AI",
  description:
    "Paste notes from an interview you've already had and get an AI post-debrief: a letter grade, what went well, missed opportunities, stronger rewrites, and a follow-up strategy.",
};

export default function ShadowReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}

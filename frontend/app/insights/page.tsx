import type { Metadata } from "next";
import InsightsClient from "./insights-client";

export const metadata: Metadata = {
  title: "Insights | JobIntel AI",
  description:
    "Track your application funnel, 60-day activity trend, response rates by work mode, and a 6-dimension career health score — plus AI-powered rejection analysis to course-correct your search.",
};

export default function InsightsPage() {
  return <InsightsClient />;
}

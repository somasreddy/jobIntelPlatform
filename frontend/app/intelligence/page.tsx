import type { Metadata } from "next";
import IntelligenceClient from "./intelligence-client";

export const metadata: Metadata = {
  title: "Market Intelligence | JobIntel AI",
  description:
    "Live in-demand skill signals, actively-hiring companies, and work-mode splits pulled from tracked job listings, plus a personalised salary benchmark and AI negotiation script.",
};

export default function IntelligencePage() {
  return <IntelligenceClient />;
}

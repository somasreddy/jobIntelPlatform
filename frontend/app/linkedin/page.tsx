import type { Metadata } from "next";
import LinkedInEnhancerClient from "./LinkedInEnhancerClient";

// Metadata exports are only valid from Server Components, so this thin
// server wrapper holds the per-page <title>/description and simply renders
// the "use client" page (LinkedInEnhancerClient) that owns all state/hooks.
export const metadata: Metadata = {
  title: "LinkedIn Profile Enhancer | JobIntel AI",
  description:
    "Get AI-generated, personalised suggestions for your LinkedIn headline, About section, skills, and experience bullets — tailored to your career profile to boost recruiter visibility.",
};

export default function LinkedInEnhancerPage() {
  return <LinkedInEnhancerClient />;
}

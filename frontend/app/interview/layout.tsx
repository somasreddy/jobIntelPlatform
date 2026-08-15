import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interview Prep – JobIntel AI",
  description:
    "Browse a full behavioral, technical, and leadership interview question bank by domain and type, generate a set personalized to your profile, and practice answers with instant STAR-based scoring.",
};

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}

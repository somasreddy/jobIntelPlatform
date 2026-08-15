import type { Metadata } from "next";
import CareerGraphClient from "./CareerGraphClient";

export const metadata: Metadata = {
  title: "Career Graph — Skills, Goals & Milestones | JobIntel AI",
  description:
    "Your persistent career DNA model: a live health score, skills by category, your active career goal, milestone timeline, and an interactive skill graph connecting them all.",
};

export default function CareerGraphPage() {
  return <CareerGraphClient />;
}

import type { Metadata } from "next";

// `page.tsx` in this route is a client component (it drives a stateful,
// streaming multi-step wizard), so App Router metadata can't be exported from
// it directly — Next requires metadata exports to come from a Server
// Component. This layout carries the per-route metadata instead and simply
// passes children through untouched.
export const metadata: Metadata = {
  title: "Salary Negotiation Playbook | JobIntel AI",
  description:
    "Walk through a 5-step offer negotiation coach: log your offer and market leverage, then generate an AI negotiation strategy, ready-to-use counter scripts, and a closing playbook tailored to your numbers.",
};

export default function NegotiationLayout({ children }: { children: React.ReactNode }) {
  return children;
}

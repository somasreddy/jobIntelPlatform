import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DSA Sandbox – JobIntel AI",
  description:
    "Practice data structures & algorithms problems in a plain JavaScript editor. Your code runs entirely client-side, inside a sandboxed iframe with a hard execution timeout — nothing is sent to any server.",
};

export default function DsaSandboxLayout({ children }: { children: React.ReactNode }) {
  return children;
}

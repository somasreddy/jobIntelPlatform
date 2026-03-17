import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Job Intelligence Platform – Career Optimizer for QA Professionals",
  description:
    "Discover verified job opportunities, generate ATS-optimized resumes, cover letters, and recruiter outreach — all personalized to your profile and target role.",
  keywords: "QA automation jobs, ATS resume generator, job intelligence, career optimizer, skill gap analyzer",
  openGraph: {
    title: "AI Job Intelligence Platform",
    description: "Your personal AI-powered career uplift engine for QA professionals",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0f172a] text-slate-100 min-h-screen">{children}</body>
    </html>
  );
}

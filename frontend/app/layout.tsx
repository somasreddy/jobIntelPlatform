import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobIntel AI – Career Intelligence Platform",
  description:
    "Discover verified job opportunities, generate ATS-optimized resumes, cover letters, and recruiter outreach — all personalized to your engineering profile and target role.",
  keywords: "AI job platform, ATS resume generator, job intelligence, career optimizer, skill gap analyzer, engineering jobs",
  openGraph: {
    title: "JobIntel AI – Career Intelligence Platform",
    description: "Your personal AI-powered career uplift engine for software engineers and technical professionals",
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
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="text-slate-100 min-h-screen" style={{ backgroundColor: "#030711" }}>
        {/* Ambient orb backgrounds */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}

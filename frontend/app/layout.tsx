import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import ProfileSidebar from "@/components/ProfileSidebar";
import { ProfileProvider } from "@/lib/ProfileContext";
import Footer from "@/components/Footer";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Anti-flash: apply saved theme before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('ji-theme')||'nebula';document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body className="text-slate-100 min-h-screen">
        {/* Ambient orb backgrounds */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
        <ThemeProvider>
          <ProfileProvider>
            <div style={{ position: "relative", zIndex: 1 }}>
              <Navbar />
              {children}
              <ProfileSidebar />

              <Footer />
            </div>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

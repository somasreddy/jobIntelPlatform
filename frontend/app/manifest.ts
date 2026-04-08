import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JobIntel AI – Career Intelligence Platform",
    short_name: "JobIntel AI",
    description: "AI-powered career optimizer — jobs, resume, interview prep & more",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#6366f1",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Find Jobs",
        url: "/jobs",
        description: "Browse AI-matched job listings",
      },
      {
        name: "Practice Interview",
        url: "/interview",
        description: "Mock interview simulator",
      },
      {
        name: "Career Dashboard",
        url: "/",
        description: "Your career command center",
      },
    ],
    categories: ["productivity", "business", "education"],
  };
}

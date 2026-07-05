"use client";
import { useEffect, useState } from "react";
import { Download, X, Zap } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const isLocalDev =
      process.env.NODE_ENV !== "production" ||
      ["localhost", "127.0.0.1"].includes(window.location.hostname);

    if ("serviceWorker" in navigator) {
      if (isLocalDev) {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch((err) => console.warn("SW cleanup failed:", err));
      } else {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .catch((err) => console.warn("SW registration failed:", err));
      }
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      const alreadyDismissed = sessionStorage.getItem("pwa-dismissed");
      if (!alreadyDismissed) {
        setInstallPrompt(e as BeforeInstallPromptEvent);
        // Delay showing banner so it doesn't immediately compete with page load
        setTimeout(() => setShowBanner(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setInstallPrompt(null);
    }
  };

  const dismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem("pwa-dismissed", "1");
  };

  if (!showBanner || !installPrompt) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 rounded-2xl shadow-2xl p-4 flex items-start gap-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-hover)",
        boxShadow: "0 8px 32px -8px var(--glow-accent)",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent))" }}
      >
        <Zap className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Install JobIntel AI</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Add to home screen for fast access, offline browsing, and a native app experience.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={install}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <Download className="w-3.5 h-3.5" /> Install App
          </button>
          <button
            onClick={dismiss}
            className="px-3 py-1.5 rounded-xl text-xs"
            style={{ background: "var(--bg-elevated)", color: "#94a3b8" }}
          >
            Not now
          </button>
        </div>
      </div>
      <button onClick={dismiss} className="text-slate-500 hover:text-white shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

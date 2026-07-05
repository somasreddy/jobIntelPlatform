"use client";
import { useEffect, useRef } from "react";
import { X, Palette, Check } from "lucide-react";
import { THEMES } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";

interface ThemeSelectorProps {
  open: boolean;
  onClose: () => void;
}

export default function ThemeSelector({ open, onClose }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full mb-2 left-0 md:bottom-0 md:left-full md:ml-3 md:mb-0 z-50 animate-slide-left"
      style={{ width: 340 }}
    >
      <div
        className="rounded-2xl border shadow-2xl shadow-black/60 overflow-hidden"
        style={{
          background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 96%, white 4%), var(--bg-elevated))",
          borderColor: "var(--border-hover)",
        }}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-start gap-2.5">
            <Palette className="w-4 h-4 mt-0.5" style={{ color: "var(--accent-bright)" }} />
            <div>
              <p className="text-sm font-semibold text-white">Appearance</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Choose a focused enterprise workspace.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          {THEMES.map((t) => {
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="group w-full rounded-xl border p-3 text-left transition-all"
                style={{
                  background: isActive
                    ? "color-mix(in srgb, var(--accent) 13%, var(--bg-card))"
                    : "color-mix(in srgb, var(--bg-card) 88%, white 2%)",
                  borderColor: isActive ? "var(--accent)" : "var(--border)",
                  boxShadow: isActive ? "0 0 24px -14px var(--glow-accent)" : "none",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-16 rounded-lg border overflow-hidden shrink-0"
                    style={{
                      borderColor: "rgba(255,255,255,0.10)",
                      background: `linear-gradient(135deg, ${t.colors[2]} 0%, ${t.colors[2]} 45%, ${t.colors[0]} 46%, ${t.colors[1]} 100%)`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold" style={{ color: isActive ? "var(--accent-bright)" : "var(--text-primary)" }}>
                        {t.name}
                      </p>
                      {isActive && (
                        <span className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "var(--accent)" }}>
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{t.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape
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
      style={{ width: 300 }}
    >
      <div
        className="rounded-2xl border shadow-2xl shadow-black/60 overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border-hover)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" style={{ color: "var(--accent-bright)" }} />
            <p className="text-sm font-semibold text-white">Choose Theme</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Theme grid */}
        <div className="p-3 grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); }}
                className="relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all group"
                style={{
                  background: isActive
                    ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                    : "rgba(255,255,255,0.03)",
                  border: isActive
                    ? "1px solid var(--accent)"
                    : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Active check */}
                {isActive && (
                  <span
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "var(--accent)" }}
                  >
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                )}

                {/* Color swatches */}
                <div className="flex gap-1">
                  {t.colors.map((c, i) => (
                    <span
                      key={i}
                      className="w-4 h-4 rounded-full border border-white/10 shadow-sm"
                      style={{ background: c }}
                    />
                  ))}
                </div>

                {/* Name */}
                <span
                  className="text-[10px] font-medium text-center leading-tight"
                  style={{ color: isActive ? "var(--accent-bright)" : "#94a3b8" }}
                >
                  {t.emoji} {t.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2.5 border-t text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-[10px] text-slate-500">
            Theme is saved automatically
          </p>
        </div>
      </div>
    </div>
  );
}

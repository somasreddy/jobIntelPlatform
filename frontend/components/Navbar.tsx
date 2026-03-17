"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { loadProfile } from "@/lib/profile";
import { useTheme } from "@/components/ThemeProvider";
import ThemeSelector from "@/components/ThemeSelector";
import { THEMES } from "@/lib/theme";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  TrendingUp,
  CheckSquare,
  BarChart2,
  Zap,
  Linkedin,
  Brain,
  Palette,
} from "lucide-react";

const navItems = [
  { href: "/",              icon: LayoutDashboard, label: "Profile"          },
  { href: "/jobs",          icon: Briefcase,       label: "Find Jobs"        },
  { href: "/resume",        icon: FileText,        label: "Resume & ATS"     },
  { href: "/applications",  icon: CheckSquare,     label: "Tracker"          },
  { href: "/intelligence",  icon: TrendingUp,      label: "Intelligence"     },
  { href: "/insights",      icon: BarChart2,       label: "Insights"         },
  { href: "/interview",     icon: Brain,           label: "Interview Prep"   },
  { href: "/linkedin",      icon: Linkedin,        label: "LinkedIn Enhancer"},
];

export default function Navbar() {
  const path = usePathname();
  const [userName, setUserName] = useState<string>("");
  const [themeOpen, setThemeOpen] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const p = loadProfile();
    if (p?.name) setUserName(p.name);
  }, []);

  const initials = userName
    ? userName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "";

  const currentTheme = THEMES.find((t) => t.id === theme);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              background: "linear-gradient(135deg, var(--accent-deep), var(--accent), var(--accent-secondary))",
              boxShadow: "0 4px 14px -3px var(--glow-accent)",
            }}
          >
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">JobIntel AI</p>
            <p className="text-[10px] text-slate-400 font-medium">Career Optimizer</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={active ? {
                background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                color: "var(--accent-bright)",
                border: "1px solid var(--border-hover)",
                boxShadow: "0 0 12px -4px var(--glow-accent)",
              } : {
                color: "#94a3b8",
                border: "1px solid transparent",
              }}
            >
              <Icon
                className="w-5 h-5"
                style={active ? { color: "var(--accent-bright)" } : {}}
              />
              {label}
              {active && (
                <div
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--accent-bright)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Theme picker button */}
        <div className="relative">
          <button
            onClick={() => setThemeOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all"
            style={{
              background: themeOpen
                ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                : "rgba(255,255,255,0.03)",
              border: themeOpen
                ? "1px solid var(--border-hover)"
                : "1px solid var(--border)",
              color: themeOpen ? "var(--accent-bright)" : "#94a3b8",
            }}
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left text-xs font-medium">
              {currentTheme?.emoji} {currentTheme?.name || "Theme"}
            </span>
            {/* Live preview dots */}
            <div className="flex gap-1">
              {(currentTheme?.colors ?? []).map((c, i) => (
                <span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full border border-white/10"
                  style={{ background: c }}
                />
              ))}
            </div>
          </button>

          <ThemeSelector open={themeOpen} onClose={() => setThemeOpen(false)} />
        </div>

        {/* Profile chip */}
        {userName ? (
          <div
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-secondary))",
                boxShadow: "0 2px 8px -2px var(--glow-accent)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] text-slate-400">Career Profile Active</p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl p-3"
            style={{
              background: "color-mix(in srgb, var(--accent-deep) 20%, transparent)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="text-xs font-semibold" style={{ color: "var(--accent-bright)" }}>
              AI-Powered Platform
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Job Discovery · ATS · Intelligence</p>
          </div>
        )}
      </div>
    </aside>
  );
}

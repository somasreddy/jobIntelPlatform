"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useProfile } from "@/lib/ProfileContext";
import { useTheme } from "@/components/ThemeProvider";
import ThemeSelector from "@/components/ThemeSelector";
import NotificationBell from "@/components/NotificationBell";
import { THEMES } from "@/lib/theme";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Layers,
  Zap,
  Linkedin,
  Brain,
  Palette,
  Menu,
  X,
  Crosshair,
  Target,
  LogIn,
  LogOut,
  DollarSign,
  Activity,
  BookOpen,
  Radar,
  PieChart,
  Bot,
  Globe,
  ClipboardList,
} from "lucide-react";

const navItems = [
  { href: "/jobs",          icon: Briefcase,       label: "Find Jobs"        },
  { href: "/qa-dashboard",  icon: ClipboardList,   label: "QA Dashboard"     },
  { href: "/profile",       icon: LayoutDashboard, label: "Profile & Resume" },
  { href: "/career-graph",  icon: Activity,        label: "Career Graph"     },
  { href: "/applications",  icon: Layers,          label: "Pipeline"         },
  { href: "/campaign",      icon: Target,          label: "Campaign"         },
  { href: "/autopilot",     icon: Bot,             label: "Autopilot"        },
  { href: "/learn",         icon: BookOpen,        label: "Learning Engine"  },
  { href: "/market-radar",  icon: BarChart3,       label: "Market Radar"     },
  { href: "/insights",      icon: PieChart,        label: "Insights"         },
  { href: "/intelligence",  icon: Crosshair,       label: "Intelligence"     },
  { href: "/interview",     icon: Brain,           label: "Interview Prep"   },
  { href: "/linkedin",      icon: Linkedin,        label: "LinkedIn Enhancer"},
  { href: "/negotiation",   icon: DollarSign,      label: "Negotiation"      },
  { href: "/portfolio",     icon: Globe,           label: "Portfolio"        },
  { href: "/power-tools",   icon: Radar,           label: "Power Tools"      },
];

export default function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const { user, logout } = useAuth();
  const userName = user?.name || profile?.name || "";
  const [themeOpen, setThemeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useTheme();

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  const initials = userName
    ? userName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "";

  const currentTheme = THEMES.find((t) => t.id === theme);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--accent-deep), var(--accent), var(--accent-secondary))",
              boxShadow: "0 4px 14px -3px var(--glow-accent)",
            }}
          >
            <Zap className="w-5 h-5" style={{ color: "var(--bg-base, #07070A)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight" style={{ fontFamily: "'Inter Tight','Inter',sans-serif", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>JobIntel AI</p>
            <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Career Optimizer</p>
          </div>
          {/* Close button - mobile only */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden ml-auto p-1 transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <X className="w-5 h-5" />
          </button>
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
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                color: "var(--accent-bright)",
                border: "1px solid var(--border-hover)",
                boxShadow: "0 0 12px -4px var(--glow-accent)",
              } : {
                color: "var(--text-secondary)",
                border: "1px solid transparent",
              }}
            >
              <Icon
                className="w-5 h-5 shrink-0"
                style={active ? { color: "var(--accent-bright)" } : {}}
              />
              {label}
              {active && (
                <div
                  className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "var(--accent-bright)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Notifications */}
        <div className="flex justify-end px-1">
          <NotificationBell />
        </div>
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
              color: themeOpen ? "var(--accent-bright)" : "var(--text-secondary)",
            }}
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left text-xs font-medium">
              {currentTheme?.emoji} {currentTheme?.name || "Theme"}
            </span>
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
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{userName}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{user ? "Signed in" : "Demo mode"}</p>
            </div>
            {user ? (
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="transition-colors shrink-0"
                style={{ color: "var(--text-muted)" }}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
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
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-medium transition-all"
              style={{ border: "1px solid var(--border)", color: "var(--accent-bright)" }}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </Link>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top header bar */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-50"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--accent-deep), var(--accent), var(--accent-secondary))",
              boxShadow: "0 2px 8px -2px var(--glow-accent)",
            }}
          >
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold" style={{ fontFamily: "'Inter Tight','Inter',sans-serif", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>JobIntel AI</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg transition-colors"
          style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — always visible on desktop, slide-in on mobile */}
      <aside
        className={`fixed left-0 top-0 h-screen w-72 md:w-64 flex flex-col z-50 pb-10 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ background: "var(--bg-card)" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

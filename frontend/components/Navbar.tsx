"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
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
  UserRound,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; icon: LucideIcon; label: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

// Pinned above the collapsible groups — the app root/dashboard, not a member
// of any of the 6 thematic sections below.
const homeItem: NavItem = { href: "/", icon: LayoutDashboard, label: "Command Center" };

// NOTE: no existing nav item reads as "account-like settings" or an
// internal/admin tool, so a 6th "Settings" group is intentionally omitted
// rather than rendered empty. (The app does have a /qa-dashboard page, but
// it isn't currently part of this nav list, so it's left untouched here.)
const navGroups: NavGroup[] = [
  {
    id: "discover",
    label: "Discover",
    items: [
      { href: "/jobs", icon: Briefcase, label: "Find Jobs" },
    ],
  },
  {
    id: "apply",
    label: "Apply",
    items: [
      { href: "/applications", icon: Layers, label: "Pipeline" },
      { href: "/campaign", icon: Target, label: "Campaign" },
      { href: "/autopilot", icon: Bot, label: "Autopilot" },
    ],
  },
  {
    id: "prepare",
    label: "Prepare",
    items: [
      { href: "/interview", icon: Brain, label: "Interview Prep" },
      { href: "/learn", icon: BookOpen, label: "Learning Engine" },
      { href: "/negotiation", icon: DollarSign, label: "Negotiation" },
      { href: "/linkedin", icon: Linkedin, label: "LinkedIn Enhancer" },
    ],
  },
  {
    id: "grow",
    label: "Grow",
    items: [
      { href: "/career-graph", icon: Activity, label: "Career Graph" },
      { href: "/portfolio", icon: Globe, label: "Portfolio" },
      { href: "/profile", icon: UserRound, label: "Profile & Resume" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/market-radar", icon: BarChart3, label: "Market Radar" },
      { href: "/insights", icon: PieChart, label: "Insights" },
      { href: "/intelligence", icon: Crosshair, label: "Intelligence" },
      { href: "/power-tools", icon: Radar, label: "Power Tools" },
    ],
  },
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

  const isActive = (href: string) =>
    path === href || (href !== "/" && path.startsWith(href));

  // Default: expand only the group that contains the active route.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      initial[group.id] = group.items.some((item) => isActive(item.href));
    });
    return initial;
  });

  // If navigation lands on a route inside a currently-collapsed group,
  // auto-expand that group (without collapsing ones the user opened).
  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      navGroups.forEach((group) => {
        if (group.items.some((item) => isActive(item.href)) && !next[group.id]) {
          next[group.id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  const initials = userName
    ? userName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "";

  const currentTheme = THEMES.find((t) => t.id === theme);

  const renderNavItem = ({ href, icon: Icon, label }: NavItem) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border",
          active
            ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent-bright)] border-[var(--border-hover)] shadow-[0_0_12px_-4px_var(--glow-accent)]"
            : "text-secondary-foreground border-transparent"
        )}
      >
        <Icon className={cn("w-5 h-5 shrink-0", active && "text-[var(--accent-bright)]")} />
        {label}
        {active && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--accent-bright)]" />
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shrink-0 bg-[linear-gradient(135deg,var(--accent-deep),var(--accent),var(--accent-secondary))] shadow-[0_4px_14px_-3px_var(--glow-accent)]"
          >
            <Zap className="w-5 h-5 text-[var(--bg-base,#07070A)]" />
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-bold leading-tight text-foreground"
              style={{ fontFamily: "'Inter Tight','Inter',sans-serif", letterSpacing: "-0.02em" }}
            >
              JobIntel AI
            </p>
            <p className="text-[10px] font-medium text-muted-foreground">Career Optimizer</p>
          </div>
          {/* Close button - mobile only */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden ml-auto p-1 transition-colors text-secondary-foreground"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Nav items */}
      <nav aria-label="Primary" className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        {renderNavItem(homeItem)}

        {navGroups.map((group) => {
          const isOpen = openGroups[group.id];
          const contentId = `nav-group-${group.id}`;
          return (
            <div key={group.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${group.label} section`}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-secondary-foreground"
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
                    !isOpen && "-rotate-90"
                  )}
                />
              </button>
              {isOpen && (
                <div id={contentId} className="space-y-1">
                  {group.items.map(renderNavItem)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 space-y-2 border-t border-border">
        {/* Notifications */}
        <div className="flex justify-end px-1">
          <NotificationBell />
        </div>
        {/* Theme picker button */}
        <div className="relative">
          <button
            onClick={() => setThemeOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={themeOpen}
            aria-label={`Change appearance theme, current theme: ${currentTheme?.name || "Appearance"}`}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all border",
              themeOpen
                ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border-[var(--border-hover)] text-[var(--accent-bright)]"
                : "bg-white/[0.03] border-border text-secondary-foreground"
            )}
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left text-xs font-medium">
              {currentTheme?.name || "Appearance"}
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
          <div className="flex items-center gap-3 rounded-xl p-3 bg-secondary border border-border">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold bg-[linear-gradient(135deg,var(--accent),var(--accent-secondary))] shadow-[0_2px_8px_-2px_var(--glow-accent)]"
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-foreground">{userName}</p>
              <p className="text-[10px] text-muted-foreground">{user ? "Signed in" : "Demo mode"}</p>
            </div>
            {user ? (
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="transition-colors shrink-0 text-muted-foreground"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-xl p-3 bg-[color-mix(in_srgb,var(--accent-deep)_20%,transparent)] border border-border">
              <p className="text-xs font-semibold text-[var(--accent-bright)]">
                AI-Powered Platform
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Job Discovery · ATS · Intelligence</p>
            </div>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-medium transition-all border border-border text-[var(--accent-bright)]"
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
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-50 bg-card border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[linear-gradient(135deg,var(--accent-deep),var(--accent),var(--accent-secondary))] shadow-[0_2px_8px_-2px_var(--glow-accent)]">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span
            className="text-sm font-bold text-foreground"
            style={{ fontFamily: "'Inter Tight','Inter',sans-serif", letterSpacing: "-0.02em" }}
          >
            JobIntel AI
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg transition-colors bg-secondary text-secondary-foreground"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-sidebar"
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
        id="mobile-nav-sidebar"
        className={cn(
          "fixed left-0 top-0 h-screen w-72 md:w-64 flex flex-col z-50 pb-10 transition-transform duration-300 bg-card",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

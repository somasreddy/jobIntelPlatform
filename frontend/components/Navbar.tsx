"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  TrendingUp,
  CheckSquare,
  BarChart2,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/",              icon: LayoutDashboard, label: "Profile"       },
  { href: "/jobs",          icon: Briefcase,       label: "Find Jobs"     },
  { href: "/resume",        icon: FileText,        label: "Resume & ATS"  },
  { href: "/applications",  icon: CheckSquare,     label: "Tracker"       },
  { href: "/intelligence",  icon: TrendingUp,      label: "Intelligence"  },
  { href: "/insights",      icon: BarChart2,       label: "Insights"      },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col bg-[#1e293b] border-r border-[#334155] z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#334155]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/30">
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
                  : "text-slate-400 hover:bg-slate-700/40 hover:text-slate-200"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "text-indigo-400" : ""}`} />
              {label}
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 border-t border-[#334155]">
        <div className="rounded-xl bg-linear-to-br from-indigo-900/60 to-cyan-900/40 border border-indigo-500/20 p-3">
          <p className="text-xs font-semibold text-indigo-300">AI-Powered Platform</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Job Discovery · ATS · Intelligence</p>
        </div>
      </div>
    </aside>
  );
}

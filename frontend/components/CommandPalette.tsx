"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Layers,
  Linkedin,
  Brain,
  Crosshair,
  Target,
  DollarSign,
  Activity,
  BookOpen,
  Radar,
  PieChart,
  Bot,
  Globe,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type NavItem = { href: string; icon: LucideIcon; label: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

// Mirrors the navigation structure defined in `frontend/components/Navbar.tsx`
// (routes, labels, icons, and grouping). Keep these two lists in sync if the
// Navbar's routes ever change — this file intentionally does not import from
// Navbar.tsx since that file is out of scope here and doesn't export its data.

// Pinned above the groups, same as the Navbar's un-grouped home item.
const homeItem: NavItem = { href: "/", icon: LayoutDashboard, label: "Command Center" };

const navGroups: NavGroup[] = [
  {
    id: "discover",
    label: "Discover",
    items: [{ href: "/jobs", icon: Briefcase, label: "Find Jobs" }],
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

export default function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  // Global Cmd+K (Mac) / Ctrl+K (Windows/Linux) listener — a single
  // cross-platform check via `metaKey || ctrlKey`.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prevOpen) => !prevOpen);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const goTo = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Jump to any page in JobIntel AI"
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Go to">
          <CommandItem
            value={homeItem.label}
            onSelect={() => goTo(homeItem.href)}
          >
            <homeItem.icon />
            <span>{homeItem.label}</span>
          </CommandItem>
        </CommandGroup>
        {navGroups.map((group) => (
          <CommandGroup key={group.id} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.href}
                value={`${group.label} ${item.label}`}
                onSelect={() => goTo(item.href)}
              >
                <item.icon />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { motionTransition } from "@/lib/motion-tokens";
import { useProfile } from "@/lib/ProfileContext";
import { CandidateProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import DemoDataBanner from "@/components/DemoDataBanner";
import DataFreshness from "@/components/DataFreshness";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Minus, Zap, DollarSign,
  Building2, Code, RefreshCw, BarChart3,
  Target, Award, ArrowUpRight, Flame,
  MapPin, Briefcase, Copy, CheckCircle, Sparkles, ArrowUp,
  UserCircle2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Market tab types ────────────────────────────────────────────────────────
interface SkillDemand { skill: string; count: number; pct: number; trend: "up" | "down" | "stable" }
interface TopCompany  { company: string; job_count: number; avg_score: number | null }
interface SalaryBand  { role: string; min: number; max: number; mid: number; currency: string }
interface MarketData  {
  total_jobs: number; verified_jobs: number;
  top_skills: SkillDemand[]; emerging_skills: string[];
  top_companies: TopCompany[]; work_mode_breakdown: Record<string, number>;
  salary_bands: SalaryBand[]; last_updated: string;
}

// ─── My Report tab types ─────────────────────────────────────────────────────
type SalaryResult = { min_salary: number; max_salary: number; currency: string; market_demand: string; yoy_growth_pct: number };

// ─── Shared helpers ──────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up")   return <TrendingUp   className="w-3.5 h-3.5 text-emerald-400" />;
  if (trend === "down") return <TrendingDown  className="w-3.5 h-3.5 text-rose-400" />;
  return                       <Minus         className="w-3.5 h-3.5 text-slate-500" />;
}

function SkillBar({ skill, pct, count, trend }: SkillDemand) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="w-28 text-sm text-slate-200 font-medium truncate shrink-0">{skill}</div>
      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-linear-to-r from-cyan-500 to-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
      <TrendIcon trend={trend} />
    </div>
  );
}

/** Scroll-triggered reveal wrapper — same convention as PortfolioPublicView.tsx
 *  and the Insights module: initial/whileInView/viewport + the shared
 *  motion-tokens transition helper. Respects prefers-reduced-motion via the
 *  app-wide MotionConfig wired in layout.tsx. */
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ ...motionTransition("slow", "outQuint"), delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── My Report: salary utils ─────────────────────────────────────────────────
const LOCATIONS = [
  "United States (Remote)", "United Kingdom", "India (Tier 1)",
  "India (Tier 2)", "EU Remote", "Australia", "Canada", "Singapore",
];

const SALARY_BASE: Record<string, { minMult: number; maxMult: number; expMult: number; currency: string; symbol: string }> = {
  "United States (Remote)": { minMult: 110, maxMult: 160, expMult: 4,   currency: "USD", symbol: "$"  },
  "United Kingdom":          { minMult: 60,  maxMult: 95,  expMult: 4,   currency: "GBP", symbol: "£"  },
  "India (Tier 1)":          { minMult: 18,  maxMult: 35,  expMult: 2,   currency: "INR", symbol: "₹"  },
  "India (Tier 2)":          { minMult: 12,  maxMult: 22,  expMult: 1.2, currency: "INR", symbol: "₹"  },
  "EU Remote":               { minMult: 70,  maxMult: 110, expMult: 3,   currency: "EUR", symbol: "€"  },
  "Australia":               { minMult: 110, maxMult: 160, expMult: 4,   currency: "AUD", symbol: "A$" },
  "Canada":                  { minMult: 95,  maxMult: 140, expMult: 3,   currency: "CAD", symbol: "C$" },
  "Singapore":               { minMult: 90,  maxMult: 130, expMult: 3.5, currency: "SGD", symbol: "S$" },
};

function inferMarketLocation(profile: CandidateProfile): string {
  const loc = (profile.currentLocation || "").toLowerCase();
  const preferred = (profile.preferredLocations ?? []).join(" ").toLowerCase();
  const combined = `${loc} ${preferred}`;
  if (/india|bangalore|bengaluru|hyderabad|mumbai|chennai|pune|delhi|noida/.test(combined)) return "India (Tier 1)";
  if (/uk|united kingdom|london|manchester|edinburgh/.test(combined)) return "United Kingdom";
  if (/australia|sydney|melbourne/.test(combined)) return "Australia";
  if (/canada|toronto|vancouver/.test(combined)) return "Canada";
  if (/singapore/.test(combined)) return "Singapore";
  if (/eu|europe|germany|france|netherlands/.test(combined)) return "EU Remote";
  return "United States (Remote)";
}

function fmtSalary(n: number, loc: string): string {
  const base = SALARY_BASE[loc];
  if (!base) return `$${Math.round(n / 1000)}k`;
  if (base.currency === "INR") return `${base.symbol}${n.toFixed(1)}L`;
  return `${base.symbol}${Math.round(n)}k`;
}

function getRoleMultiplier(role: string): number {
  const r = role.toLowerCase();
  if (/b2b|webmethod|mulesoft|boomi|tibco|sterling|trading network|edi|middleware|ipaas/i.test(r)) return 1.12;
  if (/api management|api gateway|kong|apigee/i.test(r)) return 1.10;
  if (/devops|sre|platform engineer|cicd|ci\/cd|devsecops/i.test(r)) return 1.15;
  if (/cloud architect|solution architect|enterprise architect/i.test(r)) return 1.20;
  if (/data engineer|ml engineer|ai engineer|machine learning/i.test(r)) return 1.18;
  if (/fullstack|full.?stack/i.test(r)) return 1.08;
  if (/qa|test|sdet/i.test(r)) return 0.95;
  return 1.0;
}

function computeSalary(role: string, exp: number, loc: string) {
  const base = SALARY_BASE[loc] ?? SALARY_BASE["United States (Remote)"];
  const isINR = base.currency === "INR";
  const mult = getRoleMultiplier(role);
  if (isINR) {
    return { min: (base.minMult + exp * base.expMult) * mult, max: (base.maxMult + exp * base.expMult * 1.4) * mult, isINR: true };
  }
  return { min: (base.minMult + exp * base.expMult) * 1000 * mult, max: (base.maxMult + exp * base.expMult * 1.3) * 1000 * mult, isINR: false };
}

function computePercentile(current: number, min: number, max: number): number {
  if (current <= min) return 10;
  if (current >= max) return 98;
  return Math.round(10 + ((current - min) / (max - min)) * 88);
}

const TOP_SKILLS_BY_ROLE = (role: string): [string, number][] => {
  const r = role.toLowerCase();
  if (/frontend|react|vue|angular/.test(r)) return [["TypeScript", 18], ["React", 15], ["Next.js", 14], ["GraphQL", 12]];
  if (/backend|api|node|java|python/.test(r)) return [["Go", 22], ["Rust", 20], ["Kubernetes", 18], ["AWS", 16]];
  if (/data|ml|ai|machine/.test(r)) return [["LLMs", 28], ["PyTorch", 22], ["MLOps", 20], ["Spark", 16]];
  if (/devops|platform|cloud|sre/.test(r)) return [["Kubernetes", 22], ["Terraform", 18], ["ArgoCD", 16], ["Helm", 14]];
  if (/qa|test|sdet/.test(r)) return [["Playwright", 15], ["Kubernetes", 18], ["K6", 12], ["Go", 20]];
  if (/b2b|integration|webmethod|mulesoft|middleware/.test(r)) return [["webMethods API Gateway", 20], ["MuleSoft Anypoint", 22], ["webMethods.IO Integration", 18], ["IBM Sterling", 15]];
  return [["Kubernetes", 20], ["AWS", 18], ["Go", 22], ["TypeScript", 15]];
};

// ─── Market data fallback ─────────────────────────────────────────────────────
const FALLBACK: MarketData = {
  total_jobs: 0, verified_jobs: 0,
  top_skills: [
    { skill: "Python",     count: 312, pct: 95, trend: "up"     },
    { skill: "TypeScript", count: 289, pct: 88, trend: "up"     },
    { skill: "Playwright", count: 241, pct: 73, trend: "up"     },
    { skill: "LangChain",  count: 198, pct: 60, trend: "up"     },
    { skill: "Kubernetes", count: 187, pct: 57, trend: "stable" },
    { skill: "FastAPI",    count: 156, pct: 47, trend: "up"     },
    { skill: "React",      count: 143, pct: 43, trend: "stable" },
    { skill: "Docker",     count: 138, pct: 42, trend: "stable" },
    { skill: "PostgreSQL", count: 121, pct: 37, trend: "stable" },
    { skill: "AWS",        count: 115, pct: 35, trend: "stable" },
  ],
  emerging_skills: ["LlamaIndex", "Weaviate", "Qdrant", "DSPy", "Instructor", "Pydantic AI"],
  top_companies: [
    { company: "Anthropic", job_count: 12, avg_score: 4.2 },
    { company: "OpenAI",    job_count: 8,  avg_score: 4.0 },
    { company: "Google",    job_count: 23, avg_score: 3.8 },
    { company: "Microsoft", job_count: 19, avg_score: 3.7 },
    { company: "Stripe",    job_count: 7,  avg_score: 4.1 },
  ],
  work_mode_breakdown: { remote: 48, hybrid: 37, onsite: 15 },
  salary_bands: [
    { role: "Senior AI Engineer",   min: 180000, max: 280000, mid: 230000, currency: "USD" },
    { role: "ML Engineer",          min: 160000, max: 250000, mid: 205000, currency: "USD" },
    { role: "Senior QA / SDET",     min: 130000, max: 200000, mid: 165000, currency: "USD" },
    { role: "DevOps / SRE",         min: 140000, max: 210000, mid: 175000, currency: "USD" },
    { role: "AI Platform Engineer", min: 170000, max: 270000, mid: 220000, currency: "USD" },
  ],
  last_updated: new Date().toISOString(),
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IntelligenceClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"market" | "report">("market");

  // ── Market tab state ────────────────────────────────────────────────────────
  const [data, setData] = useState<MarketData>(FALLBACK);
  const [marketLoading, setMarketLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [marketFetchedAt, setMarketFetchedAt] = useState<Date | null>(null);
  const [salaryQuery, setSalaryQuery] = useState({ role: "", location: "", experience_years: 5 });
  const [salaryResult, setSalaryResult] = useState<Record<string, unknown> | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryFetchedAt, setSalaryFetchedAt] = useState<Date | null>(null);

  // ── My Report tab state ─────────────────────────────────────────────────────
  const { profile, loading: profileLoading } = useProfile();
  const [role, setRole] = useState("");
  const [exp, setExp] = useState(0);
  const [loc, setLoc] = useState("United States (Remote)");
  const [personalSalaryData, setPersonalSalaryData] = useState<SalaryResult | null>(null);
  // "idle" = not attempted yet (no role entered), "live" = came back from the
  // real /api/salary/predict call, "error" = the call failed/is unreachable
  // and the figures below fall back to the client-side heuristic bands.
  const [personalSalaryStatus, setPersonalSalaryStatus] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [personalSalaryFetchedAt, setPersonalSalaryFetchedAt] = useState<Date | null>(null);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [copied, setCopied] = useState(false);

  // ── Market data fetch ───────────────────────────────────────────────────────
  const fetchMarketData = useCallback(async () => {
    setMarketLoading(true);
    try {
      const res = await fetch(`${API}/api/jobs/?limit=500`);
      if (res.ok) {
        const jobs: Array<{
          technologies?: string[]; organization?: string; company?: string;
          matchScore?: number; match_score?: number; workMode?: string; work_mode?: string;
          verificationStatus?: string; verification_status?: string;
        }> = await res.json();
        if (Array.isArray(jobs) && jobs.length > 0) {
          const skillCounts: Record<string, number> = {};
          const companyCounts: Record<string, { count: number; scores: number[] }> = {};
          const workModes: Record<string, number> = {};
          for (const job of jobs) {
            for (const tech of (job.technologies || [])) skillCounts[tech] = (skillCounts[tech] || 0) + 1;
            const co = job.organization || job.company;
            if (co) {
              if (!companyCounts[co]) companyCounts[co] = { count: 0, scores: [] };
              companyCounts[co].count++;
              const sc = job.matchScore ?? job.match_score;
              if (sc) companyCounts[co].scores.push(sc);
            }
            const wm = (job.workMode || job.work_mode || "remote").toLowerCase();
            workModes[wm] = (workModes[wm] || 0) + 1;
          }
          const maxCount = Math.max(...Object.values(skillCounts), 1);
          const top_skills: SkillDemand[] = Object.entries(skillCounts)
            .sort((a, b) => b[1] - a[1]).slice(0, 12)
            .map(([skill, count]) => ({ skill, count, pct: Math.round((count / maxCount) * 100), trend: count > 50 ? "up" : count > 20 ? "stable" : "down" }));
          const top_companies: TopCompany[] = Object.entries(companyCounts)
            .sort((a, b) => b[1].count - a[1].count).slice(0, 8)
            .map(([company, { count, scores }]) => ({ company, job_count: count, avg_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null }));
          const fetchedAt = new Date();
          setData({ ...FALLBACK, total_jobs: jobs.length, verified_jobs: jobs.filter(j => (j.verificationStatus || j.verification_status) === "VERIFIED").length, top_skills: top_skills.length ? top_skills : FALLBACK.top_skills, top_companies: top_companies.length ? top_companies : FALLBACK.top_companies, work_mode_breakdown: Object.keys(workModes).length ? workModes : FALLBACK.work_mode_breakdown, last_updated: fetchedAt.toISOString() });
          setIsFallback(false); setMarketFetchedAt(fetchedAt); setMarketLoading(false); return;
        }
      }
    } catch {}
    setData(FALLBACK); setIsFallback(true); setMarketLoading(false);
  }, []);

  const fetchMarketSalary = async () => {
    setSalaryLoading(true);
    try {
      const res = await fetch(`${API}/api/salary/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(salaryQuery) });
      if (res.ok) { setSalaryResult(await res.json()); setSalaryFetchedAt(new Date()); }
    } catch {} finally { setSalaryLoading(false); }
  };

  useEffect(() => { fetchMarketData(); }, [fetchMarketData]);

  // Pre-fill salary explorer from profile
  useEffect(() => {
    if (!profile) return;
    setSalaryQuery(q => ({
      role: q.role || profile.currentRole || "Senior Software Engineer",
      location: q.location || profile.preferredLocations?.[0] || profile.currentLocation || "United States",
      experience_years: q.experience_years === 5 ? (profile.experienceYears || 5) : q.experience_years,
    }));
  }, [profile]);

  // ── Personal salary fetch ───────────────────────────────────────────────────
  const fetchPersonalSalary = useCallback(async () => {
    if (!role) return;
    setPersonalSalaryStatus("loading");
    try {
      const res = await fetch(`${API}/api/salary/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, experience_years: exp, location: loc }) });
      if (res.ok) {
        setPersonalSalaryData(await res.json());
        setPersonalSalaryStatus("live");
        setPersonalSalaryFetchedAt(new Date());
      } else {
        setPersonalSalaryStatus("error");
      }
    } catch {
      setPersonalSalaryStatus("error");
    }
  }, [role, exp, loc]);

  useEffect(() => {
    if (profileLoading || !profile) return;
    setRole(profile.currentRole || "");
    setExp(typeof profile.experienceYears === "number" ? profile.experienceYears : parseInt(String(profile.experienceYears)) || 0);
    setLoc(inferMarketLocation(profile));
  }, [profileLoading, profile]);

  useEffect(() => { if (activeTab === "report") fetchPersonalSalary(); }, [fetchPersonalSalary, activeTab]);

  const totalWM = Object.values(data.work_mode_breakdown).reduce((a, b) => a + b, 0) || 1;
  // True only for the very first load, before we know whether the live fetch
  // will succeed or fall back — avoids rendering the hard-coded FALLBACK
  // company/work-mode figures (unlabeled) while that's still being decided.
  const marketFirstLoad = marketLoading && !marketFetchedAt && !isFallback;

  // ── My Report computed values ───────────────────────────────────────────────
  const computed = computeSalary(role || "engineer", exp, loc);
  const base = SALARY_BASE[loc] ?? SALARY_BASE["United States (Remote)"];
  const isINR = base.currency === "INR";
  const minSal = personalSalaryData ? (isINR ? personalSalaryData.min_salary / 100000 : personalSalaryData.min_salary / 1000) : computed.min;
  const maxSal = personalSalaryData ? (isINR ? personalSalaryData.max_salary / 100000 : personalSalaryData.max_salary / 1000) : computed.max;
  const demand = personalSalaryData?.market_demand ?? "Very High";
  const yoy    = personalSalaryData?.yoy_growth_pct ?? 14.2;
  const currSalRaw = profile?.currentSalary ?? 0;
  const currSalDisplay = isINR ? currSalRaw / 100000 : currSalRaw / 1000;
  const percentile = currSalRaw > 0 ? computePercentile(isINR ? currSalDisplay : currSalRaw, isINR ? minSal : minSal * 1000, isINR ? maxSal : maxSal * 1000) : null;
  const topSkills = TOP_SKILLS_BY_ROLE(role);
  const targetAsk = isINR ? maxSal * 1.08 : maxSal * 1000 * 1.08;
  const targetDisplay = isINR ? `${base.symbol}${targetAsk.toFixed(1)}L` : `${base.symbol}${Math.round(targetAsk / 1000)}k`;
  const negotiationScript = `Hi [Hiring Manager],\n\nThank you so much for the offer for the ${role || "position"} — I'm genuinely excited about the opportunity at [Company] and the team I'd be joining.\n\nAfter reviewing the offer, I'd like to have a brief conversation about the compensation. Based on my ${exp}+ years of experience in ${(profile?.skills ?? []).slice(0, 2).join(" and ") || "this domain"}, current market data for ${role} roles in ${loc} (${fmtSalary(minSal, loc)}–${fmtSalary(maxSal, loc)} range), and the specific value I bring — I was hoping we could discuss a base of ${targetDisplay}.\n\nI want to be clear: I'm very enthusiastic about this role and [Company] specifically. Compensation is just one factor, and I'm open to discussing the full package including equity, bonus structure, and growth trajectory.\n\nWould you be open to a quick call this week to discuss?\n\nBest regards,\n${profile?.name || "[Your Name]"}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(negotiationScript).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const tabs = [
    { id: "market" as const,  label: "Market Overview",  icon: BarChart3 },
    { id: "report" as const,  label: "My Salary Report", icon: Target    },
  ];

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12 max-w-5xl">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-medium mb-2">
            <BarChart3 className="w-4 h-4" /> Intelligence Hub
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Market <span className="gradient-text">Intelligence</span>
          </h1>
          <p className="text-slate-400 text-sm">Live market signals, skill demand, and personalised salary benchmarks.</p>
        </div>

        {/* Tab switcher */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
          <TabsList className="flex w-full gap-1 p-1 h-auto rounded-xl mb-6 bg-transparent" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            {tabs.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex-1 h-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:shadow-none"
                style={activeTab === id ? {
                  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                  color: "var(--accent-bright)",
                  border: "1px solid var(--border-hover)",
                  boxShadow: "0 0 12px -4px var(--glow-accent)",
                } : { color: "#94a3b8", background: "transparent", border: "1px solid transparent" }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── MARKET TAB ─────────────────────────────────────────────────────── */}
          <TabsContent value="market" className="mt-0">
            {isFallback && (
              <DemoDataBanner message="Showing 2025 benchmark data — live job signals unavailable" />
            )}

            {/* Stats row */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              {marketLoading && !marketFetchedAt && !isFallback ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Loading market data…
                </span>
              ) : !isFallback && data.total_jobs > 0 ? (
                <DataFreshness variant="live" source={`${data.total_jobs.toLocaleString()} tracked jobs`} timestamp={marketFetchedAt} />
              ) : (
                <DataFreshness variant="static" source="2025 benchmark dataset — no live jobs available" />
              )}
              <Button variant="ghost" onClick={fetchMarketData} disabled={marketLoading}
                className="h-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors border border-white/5">
                <RefreshCw className={`w-3.5 h-3.5 ${marketLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Jobs Tracked",  value: data.total_jobs > 0 ? data.total_jobs.toLocaleString() : "—", icon: Building2, color: "text-indigo-400",  bg: "bg-indigo-500/10"  },
                { label: "Verified Live", value: data.verified_jobs > 0 ? data.verified_jobs.toString() : "—", icon: Award,     color: "text-emerald-400", bg: "bg-emerald-500/10" },
                { label: "Top Skill",     value: data.top_skills[0]?.skill || "Python",                         icon: Code,      color: "text-cyan-400",    bg: "bg-cyan-500/10"    },
                { label: "Remote Roles",  value: `${Math.round((data.work_mode_breakdown.remote || 0) / totalWM * 100)}%`, icon: Target, color: "text-violet-400", bg: "bg-violet-500/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className="p-4 glass-card gap-0">
                  <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Skill demand */}
              <Reveal className="lg:col-span-2">
                <Card className="glass-card p-6 h-full gap-0">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />Most In-Demand Skills
                    </h3>
                    <span className="text-xs text-slate-500">by job frequency</span>
                  </div>
                  {marketLoading
                    ? <div className="flex items-center justify-center h-40"><RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" /></div>
                    : <div>{data.top_skills.map(s => <SkillBar key={s.skill} {...s} />)}</div>
                  }
                  {data.emerging_skills.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/10">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />Emerging — Add to Your Profile
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {data.emerging_skills.map(s => (
                          <Badge key={s} variant="outline" className="text-xs px-2.5 py-1 bg-amber-500/10 border-amber-500/20 text-amber-300 rounded-full">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </Reveal>

              {/* Right column */}
              <div className="space-y-5">
                <Reveal delay={0.06}>
                  <Card className="glass-card p-5 gap-0">
                    <h3 className="text-sm font-semibold text-white mb-4">Work Mode Split</h3>
                    {marketFirstLoad ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-5 w-full rounded-full" />)}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(data.work_mode_breakdown).sort((a, b) => b[1] - a[1]).map(([mode, count]) => {
                          const pct = Math.round((count / totalWM) * 100);
                          const colors: Record<string, string> = { remote: "bg-emerald-500", hybrid: "bg-cyan-500", onsite: "bg-violet-500" };
                          return (
                            <div key={mode}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-300 capitalize">{mode}</span>
                                <span className="text-slate-400">{pct}%</span>
                              </div>
                              <div className="bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-full ${colors[mode] || "bg-slate-500"} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </Reveal>

                <Reveal delay={0.12}>
                  <Card className="glass-card p-5 gap-0">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-400" />Actively Hiring
                    </h3>
                    {marketFirstLoad ? (
                      <div className="space-y-2.5">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {data.top_companies.slice(0, 6).map((co, i) => (
                          <div key={co.company} className="flex items-center gap-2">
                            <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                            <span className="text-sm text-slate-200 flex-1 truncate">{co.company}</span>
                            <span className="text-xs text-indigo-400 font-medium">{co.job_count} jobs</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </Reveal>
              </div>
            </div>

            {/* Salary Explorer */}
            <Reveal delay={0.18}>
              <Card className="mt-6 glass-card p-6 gap-0">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />Salary Explorer — 2025 Market Data
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide">Role</label>
                    <input value={salaryQuery.role} onChange={e => setSalaryQuery(q => ({ ...q, role: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                      placeholder="Senior AI Engineer" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide">Location</label>
                    <input value={salaryQuery.location} onChange={e => setSalaryQuery(q => ({ ...q, location: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                      placeholder="United States / Berlin / Remote" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide">Experience (yrs)</label>
                    <input type="number" value={salaryQuery.experience_years}
                      onChange={e => setSalaryQuery(q => ({ ...q, experience_years: parseInt(e.target.value) || 5 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50" />
                  </div>
                </div>
                <Button onClick={fetchMarketSalary} disabled={salaryLoading}
                  className="h-auto flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-colors px-4 py-2 rounded-lg text-sm mb-5">
                  {salaryLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                  {salaryLoading ? "Calculating…" : "Get Salary Range"}
                </Button>

                {salaryResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    {([ ["Minimum", "min_salary", "25th pct"], ["Mid-Market", "mid_salary", "50th pct"], ["Strong Offer", "percentile_75", "75th pct"], ["Negotiate To", "percentile_90", "90th pct"] ] as [string,string,string][]).map(([label, key, note]) => (
                      <div key={key} className="bg-white/5 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                        <p className="text-xl font-bold text-white">{String(salaryResult.currency || "USD")} {typeof salaryResult[key] === "number" ? (salaryResult[key] as number).toLocaleString() : "—"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{note}</p>
                      </div>
                    ))}
                  </div>
                )}
                {salaryResult && typeof salaryResult.negotiation_tip === "string" && salaryResult.negotiation_tip && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-4">
                    <p className="text-xs text-emerald-300">{salaryResult.negotiation_tip}</p>
                  </div>
                )}
                {salaryResult && salaryFetchedAt && (
                  <DataFreshness variant="live" source="salary prediction model" timestamp={salaryFetchedAt} className="mb-4" />
                )}

                {salaryResult && <Separator className="my-4" />}
                <div className={salaryResult ? "mt-4" : ""}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">US Market Reference — Senior Level (2025)</p>
                    <DataFreshness variant="static" source="fixed 2025 benchmark, not specific to your query" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 border-b border-white/10">
                          <th className="text-left pb-2 font-medium">Role</th>
                          <th className="text-right pb-2 font-medium">Min</th>
                          <th className="text-right pb-2 font-medium">Mid</th>
                          <th className="text-right pb-2 font-medium">Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {FALLBACK.salary_bands.map(b => (
                          <tr key={b.role} className="border-b border-white/5 last:border-0">
                            <td className="py-2.5 text-slate-300">{b.role}</td>
                            <td className="py-2.5 text-right text-slate-400">${(b.min / 1000).toFixed(0)}k</td>
                            <td className="py-2.5 text-right text-emerald-400 font-medium">${(b.mid / 1000).toFixed(0)}k</td>
                            <td className="py-2.5 text-right text-slate-400">${(b.max / 1000).toFixed(0)}k</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </Reveal>
          </TabsContent>

          {/* ── MY REPORT TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="report" className="mt-0">
            {!profileLoading && !profile ? (
              <Card className="p-2">
                <EmptyState
                  icon={UserCircle2}
                  title="No profile found"
                  description="Set up your career profile to get personalised salary benchmarks."
                  action={{ label: "Set Up Profile", onClick: () => router.push("/profile") }}
                  size="lg"
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Controls */}
                <div className="space-y-4">
                  <Card className="p-6 h-fit gap-0 space-y-4">
                    <h2 className="text-base font-semibold text-white border-b border-slate-700/50 pb-3">Calculation Parameters</h2>
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> Role Title</label>
                      <input className="input text-sm" placeholder="e.g. Senior Backend Engineer" value={role} onChange={e => setRole(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Years of Experience</label>
                      <div className="flex items-center gap-3">
                        <input type="range" min="0" max="25" value={exp} onChange={e => setExp(parseInt(e.target.value))} className="flex-1 accent-indigo-500" />
                        <span className="w-8 text-right text-sm font-bold text-white">{exp}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Market Location</label>
                      <select className="input text-sm" value={loc} onChange={e => setLoc(e.target.value)}>
                        {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                  </Card>

                  {percentile !== null && (
                    <Card className="p-6 gap-0 bg-linear-to-br from-indigo-900/40 to-purple-900/20 border-indigo-500/20">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4 text-indigo-400" /> Your Salary Percentile
                      </h3>
                      <div className="relative mb-3">
                        <div className="h-3 rounded-full bg-slate-700/60 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percentile}%`, background: "linear-gradient(90deg, #7c3aed, #6366f1, #06b6d4)" }} />
                        </div>
                        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2 border-indigo-500 transition-all duration-700" style={{ left: `calc(${percentile}% - 8px)` }} />
                      </div>
                      <p className="text-2xl font-bold text-indigo-300 mb-1">{percentile}<span className="text-sm text-slate-400">th</span> percentile</p>
                      <p className="text-xs text-slate-400">
                        {percentile >= 75 ? "You're well above market. Strong negotiating position." : percentile >= 50 ? "You're at market rate. Room to negotiate up." : "You're below market. Time to negotiate or switch."}
                      </p>
                    </Card>
                  )}
                </div>

                {/* Results */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Salary Range */}
                  <Card className="p-6 gap-0 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/8 blur-3xl rounded-full pointer-events-none" />
                    <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-400" /> Market Salary Range
                    </h2>
                    {!role ? (
                      <p className="text-slate-500 text-sm text-center py-8">Enter a role to see salary estimates.</p>
                    ) : (
                      <>
                        {personalSalaryStatus === "live" && personalSalaryFetchedAt ? (
                          <DataFreshness variant="live" source="salary prediction model" timestamp={personalSalaryFetchedAt} className="mb-4" />
                        ) : (
                          <DataFreshness variant="static" source="typical market bands for this role & location — not a live lookup" className="mb-4" />
                        )}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-6">
                          <div className="text-center md:text-left">
                            <p className="text-xs font-medium text-slate-400 mb-1">Floor (25th %ile)</p>
                            <p className="text-3xl font-bold text-white">{fmtSalary(minSal, loc)}</p>
                          </div>
                          <div className="flex-1 w-full flex items-center gap-2">
                            <div className="h-2.5 flex-1 rounded-l-full overflow-hidden" style={{ background: "linear-gradient(90deg, rgba(99,102,241,0.2), rgba(99,102,241,0.6))" }} />
                            <div className="w-5 h-5 rounded-full bg-indigo-400 shadow-[0_0_18px_rgba(129,140,248,0.9)] z-10 shrink-0" />
                            <div className="h-2.5 flex-1 rounded-r-full overflow-hidden" style={{ background: "linear-gradient(90deg, rgba(16,185,129,0.6), rgba(16,185,129,0.2))" }} />
                          </div>
                          <div className="text-center md:text-right">
                            <p className="text-xs font-medium text-slate-400 mb-1">Ceiling (90th %ile)</p>
                            <p className="text-3xl font-bold text-emerald-400">{fmtSalary(maxSal, loc)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "Market Demand", value: demand, color: "text-emerald-400" },
                            { label: "YoY Growth",    value: `+${yoy}%`, color: "text-cyan-400" },
                            { label: "Avg Increment", value: "18–22%",   color: "text-indigo-400", note: "typical range" },
                          ].map(({ label, value, color, note }) => (
                            <div key={label} className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/40 text-center">
                              <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                              <p className={`text-base font-bold ${color}`}>{value}</p>
                              {note && <p className="text-[9px] text-slate-600 mt-0.5">{note}</p>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </Card>

                  {/* Top skills + market signals */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-6 gap-0">
                      <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                        <ArrowUp className="w-4 h-4 text-emerald-400" /> Top Paying Skills
                      </h3>
                      <DataFreshness variant="static" source="typical uplift by skill, not computed from live listings" className="mb-3" />
                      <div className="space-y-3">
                        {topSkills.map(([tech, uplift]) => (
                          <div key={tech} className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">{tech}</span>
                            <span className="text-emerald-400 font-semibold text-sm flex items-center gap-1">
                              <ArrowUp className="w-3 h-3" />{isINR ? `₹${uplift * 0.5}L` : `+$${uplift}k`}/yr
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                    <Card className="p-6 gap-0">
                      <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-400" /> Market Signals
                      </h3>
                      <DataFreshness variant="static" source="general commentary, not computed from your live data" className="mb-3" />
                      <div className="space-y-3">
                        {[
                          { color: "border-indigo-500",  title: "AI/ML roles surging",    detail: "+42% YoY demand across all engineering levels" },
                          { color: "border-emerald-500", title: "Remote normalised",       detail: "68% of senior roles now remote-first globally" },
                          { color: "border-amber-500",   title: "Cloud skills premium",   detail: "AWS/GCP certified engineers earn 23% above base" },
                        ].map(({ color, title, detail }) => (
                          <div key={title} className={`text-sm border-l-2 ${color} pl-3`}>
                            <p className="text-white font-medium text-xs">{title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Negotiation Script — a locally-assembled template, not an
                      LLM call (unlike the real AI bio/impact generation in
                      Portfolio Builder), so it's labelled as such rather than
                      branded "AI" to avoid implying a live model call that
                      doesn't happen here. */}
                  <Card className="p-6 gap-0 border-indigo-500/20 bg-indigo-500/3">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" /> Salary Negotiation Script
                      </h3>
                      <Button variant="secondary" onClick={() => setShowNegotiation(p => !p)} className="btn-secondary h-auto py-1.5 px-3 text-xs">
                        {showNegotiation ? "Hide" : "Generate Script"}
                      </Button>
                    </div>
                    <DataFreshness variant="static" source="assembled instantly from a script template using your inputs — no AI call" className="mb-3" />
                    {!showNegotiation ? (
                      <p className="text-xs text-slate-400">Got an offer? Generate a professionally written negotiation email based on your market percentile, skills, and target salary ceiling.</p>
                    ) : (
                      <>
                        <div className="mb-3">
                          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Current Offer ({base.symbol})</label>
                          <input className="input text-sm" placeholder={isINR ? "e.g. 25 (LPA)" : "e.g. 120000"} value={offerAmount} onChange={e => setOfferAmount(e.target.value)} />
                        </div>
                        <div className="relative">
                          <div className="bg-slate-900/70 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-line font-mono">
                            {negotiationScript}
                          </div>
                          <Button variant="secondary" onClick={handleCopy} className="btn-secondary h-auto absolute top-3 right-3 py-1 px-2.5 text-[11px] flex items-center gap-1">
                            {copied ? <><CheckCircle className="w-3 h-3 text-emerald-400" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                          </Button>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">
                          Targeting: <span className="text-indigo-300 font-medium">{targetDisplay}</span> based on {loc} 90th percentile data.
                          {percentile !== null && ` You're currently at the ${percentile}th percentile.`}
                        </p>
                      </>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

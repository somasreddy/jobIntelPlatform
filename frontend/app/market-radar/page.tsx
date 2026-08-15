"use client";
import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/lib/ProfileContext";
import { motionTransition } from "@/lib/motion-tokens";
import DemoDataBanner from "@/components/DemoDataBanner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TrendingUp, TrendingDown, Minus, BarChart3, DollarSign,
  Zap, Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, Target,
  AlertCircle, CheckCircle2, Radar as RadarIcon, List, SatelliteDish,
  Sparkles,
} from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip as ChartTooltip, Legend as ChartLegend, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
  type TooltipContentProps,
} from "recharts";

// NOTE on next/dynamic: recharts is already statically imported above (by the
// Trending Skills tab's Radar/Scatter charts), so this route's initial JS
// bundle pays the recharts cost regardless of what this file adds. The two
// chart components added below (HotSkillsBarChart, SalaryRangeChart) reuse
// that same import rather than introducing a second copy, so wrapping them
// in next/dynamic would not actually defer any bytes — it would just be a
// cosmetic Suspense boundary. Splitting recharts out for real would mean
// converting the existing static import to per-symbol dynamic imports across
// the whole file, which touches the prior agent's Trending Skills code and is
// out of this change's scope, so it's left alone.

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RoleDemand { trend: string; score: number; summary: string; }
interface SalaryMovement { direction: string; pct_change: number; current_range: { min: number; max: number; currency: string }; summary: string; }
interface HotSkill { skill: string; demand_score: number; why: string; }
interface DecliningSkill { skill: string; reason: string; }
interface TrendingSkill {
  name: string;
  demand_score: number;
  yoy_growth: number;
  avg_salary_premium_pct: number;
  category: string;
  note: string;
}

interface RadarData {
  target_role: string;
  location: string;
  role_demand: RoleDemand;
  salary_movement: SalaryMovement;
  hot_skills: HotSkill[];
  declining_skills: DecliningSkill[];
  market_insight: string;
  action_items: string[];
  error?: string;
}

interface SalaryBenchmark {
  role: string;
  location?: string;
  p25: number; p50: number; p75: number; p90: number;
  currency: string;
  total_comp_note: string;
  factors: string[];
  remote_premium: string;
  error?: string;
}

// ─── Salary citation ────────────────────────────────────────────────────────
// backend/api/market.py's /salary-benchmark endpoint (read directly for this
// change) generates every field on this tab from a single LLM prompt — it
// does not query salary_prediction/predictor.py's rule-based table, count
// comparable roles, or hit any live compensation feed. So the honest label
// per the "no fabricated data source" rule is "AI-estimated", not "sourced
// from N comparable roles" or similar. This is intentionally distinct from
// the deterministic, set-overlap ATS match / fit-score figures shown
// elsewhere in the app.
const SALARY_BENCHMARK_METHODOLOGY =
  "AI-estimated from your role, location, experience, and skills — not sourced from live compensation data, a sample of comparable roles, or this platform's rule-based salary model. Treat these percentiles as a directional estimate, not a verified figure.";

/** Small "AI estimate" badge — for LLM-generated numbers, kept visually
 *  distinct from computed/verifiable figures elsewhere in the app. */
function AiEstimateBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${className}`}
      style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)", color: "#d8b4fe" }}
    >
      <Sparkles className="w-2.5 h-2.5" /> AI estimate
    </span>
  );
}

// ─── Demo fallback ──────────────────────────────────────────────────────────
// The Radar tab is a personalised *overview* that auto-loads on mount (no
// user-entered query to misrepresent), so — matching the existing
// DemoDataBanner + mock-fallback convention used elsewhere in this app (see
// app/jobs/[id]/page.tsx) — we show clearly-labelled illustrative content
// instead of a blank tab when the live endpoint can't be reached. Every field
// is generic/rounded and the summaries say outright that it's sample data;
// nothing here claims to be a real market figure.
const DEMO_RADAR: RadarData = {
  target_role: "Software Engineer",
  location: "Remote",
  role_demand: {
    trend: "stable",
    score: 60,
    summary: "Illustrative score — reconnect and hit Refresh to load the live figure for your target role.",
  },
  salary_movement: {
    direction: "flat",
    pct_change: 0,
    current_range: { min: 90000, max: 140000, currency: "USD" },
    summary: "Illustrative range only, shown while the live market feed is unreachable.",
  },
  hot_skills: [
    { skill: "Cloud Platforms (AWS/GCP/Azure)", demand_score: 82, why: "Sample — broadly requested across current postings." },
    { skill: "System Design", demand_score: 76, why: "Sample — increasingly expected at mid-level and above." },
    { skill: "TypeScript", demand_score: 71, why: "Sample — standard across modern web/backend stacks." },
  ],
  declining_skills: [
    { skill: "jQuery", reason: "Sample — superseded by modern component frameworks." },
  ],
  market_insight: "Live market intelligence couldn't be reached, so this tab is showing illustrative sample data instead of your personalised briefing. Press Refresh once you're back online.",
  action_items: [],
};

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "rising") return <ArrowUpRight className="w-5 h-5 text-emerald-400" />;
  if (trend === "declining") return <ArrowDownRight className="w-5 h-5 text-rose-400" />;
  return <Minus className="w-5 h-5 text-slate-400" />;
}

export default function MarketRadarPage() {
  const { token } = useAuth();
  const { profile } = useProfile();
  const [radar, setRadar] = useState<RadarData | null>(null);
  const [radarIsDemo, setRadarIsDemo] = useState(false);
  const [salary, setSalary] = useState<SalaryBenchmark | null>(null);
  const [salaryFetchFailed, setSalaryFetchFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"radar" | "salary" | "skills">("radar");

  // Salary benchmark form — seeded from profile
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [years, setYears] = useState(5);

  // Pre-fill form from profile when it loads
  useEffect(() => {
    if (!profile) return;
    setRole(r => r || profile.currentRole || "");
    setLocation(l => l || profile.preferredLocations?.[0] || profile.currentLocation || "");
    setYears(profile.experienceYears || 5);
  }, [profile]);

  const fetchRadar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/market/radar`, { headers: authHeaders(token) });
      if (res.ok) {
        setRadar(await res.json());
        setRadarIsDemo(false);
      } else {
        // Live endpoint reachable but returned a non-OK status — fall back
        // to clearly-labelled sample data rather than leaving the tab blank.
        setRadar(DEMO_RADAR);
        setRadarIsDemo(true);
      }
    } catch (e) {
      console.error(e);
      setRadar(DEMO_RADAR);
      setRadarIsDemo(true);
    } finally { setLoading(false); }
  }, [token]);

  const fetchSalary = async () => {
    if (!role.trim()) return;
    setSalaryLoading(true);
    setSalaryFetchFailed(false);
    try {
      const res = await fetch(`${API}/api/market/salary-benchmark`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          role,
          location,
          experience_years: years,
          skills: [
            ...(profile?.skills || []),
            ...(profile?.frameworks || []),
          ],
        }),
      });
      if (res.ok) {
        setSalary(await res.json());
      } else {
        // Unlike the Radar overview, this is a specific role/location query
        // the user typed in — we don't fabricate percentile numbers to
        // "answer" it. Surface a clear failure instead (keeps any previous
        // successful result on screen rather than wiping it).
        setSalaryFetchFailed(true);
      }
    } catch (e) {
      console.error(e);
      setSalaryFetchFailed(true);
    }
    finally { setSalaryLoading(false); }
  };

  useEffect(() => { fetchRadar(); }, [fetchRadar]);

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Market Radar
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Real-time market intelligence for your career</p>
          </div>
          <button
            onClick={fetchRadar}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
          {(["radar", "salary", "skills"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={activeTab === tab ? {
                background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                color: "var(--accent-bright)",
                border: "1px solid var(--border-hover)",
              } : { color: "#94a3b8" }}
            >
              {tab === "radar" ? "Market Radar" : tab === "salary" ? "Salary Benchmark" : "Trending Skills"}
            </button>
          ))}
        </div>

        {/* ── RADAR TAB ── */}
        {activeTab === "radar" && (
          loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "var(--accent)" }} />
                <p className="text-sm text-slate-400">Analysing market conditions…</p>
              </div>
            </div>
          ) : radar?.error ? (
            <div className="card p-6 flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{radar.error}</p>
            </div>
          ) : radar ? (
            <div className="space-y-5">
              {radarIsDemo && (
                <DemoDataBanner message="Live market service unreachable — showing sample data" />
              )}

              {/* Role + location */}
              <div className="card p-4 flex items-center gap-3">
                <Target className="w-5 h-5 shrink-0" style={{ color: "var(--accent)" }} />
                <div>
                  <span className="text-sm font-semibold text-white">{radar.target_role}</span>
                  <span className="text-slate-500 mx-2">·</span>
                  <span className="text-sm text-slate-400">{radar.location}</span>
                </div>
              </div>

              {/* 2-col summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Role demand */}
                {radar.role_demand && (
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Role Demand</span>
                      <TrendIcon trend={radar.role_demand.trend} />
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-3xl font-bold text-white">{radar.role_demand.score}</span>
                      <span className="text-slate-500 text-sm mb-1">/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${radar.role_demand.score}%`,
                          background: radar.role_demand.score >= 70 ? "#10b981" : radar.role_demand.score >= 50 ? "#f59e0b" : "#f43f5e",
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">{radar.role_demand.summary}</p>
                  </div>
                )}

                {/* Salary movement */}
                {radar.salary_movement && (
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Salary Movement</span>
                      <span className={`text-sm font-bold flex items-center gap-1 ${
                        radar.salary_movement.direction === "up" ? "text-emerald-400" :
                        radar.salary_movement.direction === "down" ? "text-rose-400" : "text-slate-400"
                      }`}>
                        {radar.salary_movement.direction === "up" ? "↑" : radar.salary_movement.direction === "down" ? "↓" : "→"}
                        {radar.salary_movement.pct_change}%
                      </span>
                    </div>
                    {radar.salary_movement.current_range && (
                      <div className="mb-2">
                        <span className="text-2xl font-bold text-white">
                          ${Math.round(radar.salary_movement.current_range.min / 1000)}k
                        </span>
                        <span className="text-slate-500"> – </span>
                        <span className="text-2xl font-bold text-white">
                          ${Math.round(radar.salary_movement.current_range.max / 1000)}k
                        </span>
                        <span className="text-xs text-slate-500 ml-1">{radar.salary_movement.current_range.currency}</span>
                      </div>
                    )}
                    <p className="text-xs text-slate-500">{radar.salary_movement.summary}</p>
                  </div>
                )}
              </div>

              {/* Hot skills — ranked bar chart */}
              {/*
                The brief asked for a location-keyed heatmap here if the data
                genuinely supports it. It doesn't: /api/market/radar returns a
                single `location` string for the caller's own profile, not a
                set of regions each with their own numeric value — so a real
                choropleth/heatmap grid would have to invent per-location
                numbers that don't exist. Per the "closest honest
                representation" fallback, this instead ranks the one real
                categorical+numeric dataset the endpoint does return: hot
                skills by demand_score.
              */}
              {(radar.hot_skills || []).length > 1 && (
                <motion.div
                  className="card p-5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={motionTransition("base", "outQuint")}
                >
                  <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" style={{ color: "var(--accent)" }} /> Hot Skills — Ranked by Demand
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Per-location comparisons aren&apos;t available from the live data (only your own location is returned) — this ranks the
                    skills genuinely driving demand for {radar.target_role} right now.
                  </p>
                  <HotSkillsBarChart skills={radar.hot_skills} />
                </motion.div>
              )}

              {/* Hot skills */}
              {(radar.hot_skills || []).length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" /> Hot Skills Right Now
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {radar.hot_skills.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                          style={{ background: "color-mix(in srgb, var(--accent) 25%, transparent)" }}>
                          {s.demand_score}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{s.skill}</p>
                          <p className="text-[11px] text-slate-500">{s.why}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Declining skills */}
              {(radar.declining_skills || []).length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-rose-400" /> Declining Demand
                  </h3>
                  <div className="space-y-2">
                    {radar.declining_skills.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-rose-400 font-medium">{s.skill}</span>
                        <span className="text-slate-500">—</span>
                        <span className="text-slate-400 text-xs">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insight + actions */}
              {radar.market_insight && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} /> Market Insight
                  </h3>
                  <p className="text-sm text-slate-300 mb-4 leading-relaxed">{radar.market_insight}</p>
                  {(radar.action_items || []).length > 0 && (
                    <div className="space-y-2">
                      {radar.action_items.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          {a}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Defensive fallback — in practice fetchRadar() always resolves
            // to either live data, the demo fallback, or the error branch
            // above, but this replaces the old bare blank-tab (`null`) with
            // a clear, actionable empty state instead of dead space.
            <EmptyState
              icon={SatelliteDish}
              title="Could not load market data"
              description="We couldn't reach the market intelligence service. Check your connection and try again."
              action={{ label: "Retry", onClick: fetchRadar, icon: RefreshCw }}
            />
          )
        )}

        {/* ── SALARY TAB ── */}
        {activeTab === "salary" && (
          <div className="space-y-5">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Salary Benchmark
              </h3>
              <p className="text-[11px] text-violet-300/80 mb-4 flex items-start gap-1.5">
                <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                Figures below are AI-estimated, not sourced from live compensation data.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <input className="input-field col-span-full sm:col-span-1" placeholder="Role (e.g. Staff Engineer)"
                  value={role} onChange={e => setRole(e.target.value)} />
                <input className="input-field" placeholder="Location (optional)"
                  value={location} onChange={e => setLocation(e.target.value)} />
                <input className="input-field" type="number" placeholder="Years exp."
                  value={years} onChange={e => setYears(+e.target.value)} />
              </div>
              <button
                onClick={fetchSalary}
                disabled={salaryLoading || !role.trim()}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
              >
                {salaryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                Get Benchmark
              </button>
              {salaryFetchFailed && (
                <p className="text-xs text-rose-400 mt-2.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Could not reach the benchmark service. {salary ? "Showing the last successful result below." : "Try again in a moment."}
                </p>
              )}
            </div>

            {salary?.error && (
              <div className="card p-6 flex items-center gap-3 text-rose-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{salary.error}</p>
              </div>
            )}

            {!salary && salaryFetchFailed && (
              <EmptyState
                icon={SatelliteDish}
                title="Could not load salary benchmark"
                description="We couldn't reach the market data service for this query. Check your connection and try again."
                action={{ label: "Retry", onClick: fetchSalary, icon: RefreshCw }}
              />
            )}

            {salary && !salary.error && (
              <motion.div
                className="card p-5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={motionTransition("base", "outQuint")}
              >
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  {salary.role}
                  <AiEstimateBadge />
                </h3>
                <p className="text-xs text-slate-500 mb-1">
                  25th–90th percentile salary band{salary.location ? ` · ${salary.location}` : ""}
                </p>
                <p className="text-[11px] text-violet-300/80 mb-3">
                  {SALARY_BENCHMARK_METHODOLOGY}
                </p>
                {/* Composed range chart — the honest fit for min/median/max
                    percentile bands is a stacked range bar, not a map or
                    scatter: it's one role's salary distribution, not
                    location-keyed data. */}
                <SalaryRangeChart salary={salary} />
                {/* Percentile bars */}
                <div className="space-y-3 mb-4 mt-4">
                  {[
                    { label: "25th percentile", value: salary.p25 },
                    { label: "Median (50th)", value: salary.p50 },
                    { label: "75th percentile", value: salary.p75 },
                    { label: "Top 10% (90th)", value: salary.p90 },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">{label}</span>
                        <span className="font-bold text-white">${Math.round(value / 1000)}k</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(value / salary.p90) * 100}%`,
                            background: "var(--accent)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {salary.total_comp_note && (
                  <p className="text-xs text-slate-400 mb-2 italic">{salary.total_comp_note}</p>
                )}
                {salary.remote_premium && (
                  <p className="text-xs text-slate-400">Remote premium: {salary.remote_premium}</p>
                )}
                {(salary.factors || []).length > 0 && (
                  <div className="mt-3 space-y-1">
                    {salary.factors.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                        <span>•</span>{f}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* ── SKILLS TAB ── */}
        {activeTab === "skills" && (
          <TrendingSkillsPanel token={token} />
        )}
      </main>
    </div>
  );
}

// Theme-aware series colors — reuse the app's accent scale so charts stay
// in sync with whichever of the CSS-variable themes is active.
const CHART_COLORS = [
  "var(--accent)",
  "var(--accent-secondary)",
  "var(--accent-bright)",
  "var(--accent-dark)",
  "var(--accent-deep)",
];

const tooltipContentStyle: CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "0.625rem",
  fontSize: "0.75rem",
};

// Same score-band thresholds already used for the Role Demand progress bar
// above, reused here so a skill's bar color means the same thing everywhere
// on this page.
function demandColor(score: number): string {
  return score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e";
}

// ─── Market Radar tab: Hot Skills ranked bar chart ─────────────────────────
// Ranked horizontal bars are the closest honest fit for `hot_skills`
// ({ skill, demand_score, why }) — real categorical/numeric data, just keyed
// by skill rather than location (see the note above where this is used).
function HotSkillsBarChart({ skills }: { skills: HotSkill[] }) {
  const ranked = [...skills].sort((a, b) => b.demand_score - a.demand_score).slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, ranked.length * 38)}>
      <BarChart data={ranked} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number" domain={[0, 100]}
          tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
        />
        <YAxis
          type="category" dataKey="skill" width={150}
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--bg-elevated)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as HotSkill;
            return (
              <div className="rounded-xl px-3 py-2 max-w-[240px]" style={tooltipContentStyle}>
                <p className="text-sm font-semibold text-white">{d.skill}</p>
                <p className="text-slate-400 mt-1">Demand: <span className="text-white font-medium">{d.demand_score}</span>/100</p>
                <p className="text-slate-500 text-[11px] mt-1">{d.why}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="demand_score" radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive={false}>
          {ranked.map((s) => (
            <Cell key={s.skill} fill={demandColor(s.demand_score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Salary Benchmark tab: percentile range chart ──────────────────────────
// SalaryBenchmark's real fields are p25/p50/p75/p90 for a single role — a
// genuine distribution band, not a location comparison — so a composed
// stacked-range bar (with the median called out via a reference line) is the
// honest fit, rather than forcing it into a map or scatter plot.
function SalaryRangeTooltip({ salary }: { salary: SalaryBenchmark }) {
  const fmt = (v: number) => `$${Math.round(v / 1000)}k`;
  return (
    <div className="rounded-xl px-3 py-2" style={tooltipContentStyle}>
      <p className="text-slate-400">25th percentile: <span className="text-white font-medium">{fmt(salary.p25)}</span></p>
      <p className="text-slate-400">Median (50th): <span className="text-white font-medium">{fmt(salary.p50)}</span></p>
      <p className="text-slate-400">75th percentile: <span className="text-white font-medium">{fmt(salary.p75)}</span></p>
      <p className="text-slate-400">Top 10% (90th): <span className="text-white font-medium">{fmt(salary.p90)}</span></p>
    </div>
  );
}

function SalaryRangeChart({ salary }: { salary: SalaryBenchmark }) {
  const fmt = (v: number) => `$${Math.round(v / 1000)}k`;
  const data = [{
    name: salary.role,
    base: salary.p25,
    q25_50: Math.max(salary.p50 - salary.p25, 0),
    q50_75: Math.max(salary.p75 - salary.p50, 0),
    q75_90: Math.max(salary.p90 - salary.p75, 0),
  }];
  const upperBound = Math.max(Math.ceil((salary.p90 * 1.15) / 10000) * 10000, salary.p90 + 1);

  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 20, left: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number" domain={[0, upperBound]} tickFormatter={fmt}
          tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
        />
        <YAxis type="category" dataKey="name" hide />
        <ChartTooltip cursor={{ fill: "var(--bg-elevated)" }} content={() => <SalaryRangeTooltip salary={salary} />} />
        <Bar dataKey="base" stackId="range" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="q25_50" stackId="range" barSize={30} fill={CHART_COLORS[3]} isAnimationActive={false} />
        <Bar dataKey="q50_75" stackId="range" barSize={30} fill={CHART_COLORS[0]} isAnimationActive={false} />
        <Bar dataKey="q75_90" stackId="range" barSize={30} fill={CHART_COLORS[2]} radius={[0, 6, 6, 0]} isAnimationActive={false} />
        <ReferenceLine
          x={salary.p50} stroke="var(--text-primary)" strokeDasharray="4 3"
          label={{ value: `Median · ${fmt(salary.p50)}`, position: "insideTopRight", fill: "var(--text-secondary)", fontSize: 10 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SkillRadarTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2" style={tooltipContentStyle}>
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2" style={{ color: entry.color }}>
          <span className="font-medium">{entry.name}</span>
          <span className="text-white">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function SkillsRadarChart({ skills }: { skills: TrendingSkill[] }) {
  const topSkills = [...skills].sort((a, b) => b.demand_score - a.demand_score).slice(0, 5);
  const metrics: { key: keyof TrendingSkill; label: string }[] = [
    { key: "demand_score", label: "Demand" },
    { key: "yoy_growth", label: "YoY Growth %" },
    { key: "avg_salary_premium_pct", label: "Salary Premium %" },
  ];
  const chartData = metrics.map(({ key, label }) => {
    const row: Record<string, string | number> = { metric: label };
    topSkills.forEach((s) => { row[s.name] = s[key] as number; });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={chartData} outerRadius="72%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, "auto"]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        {topSkills.map((s, i) => (
          <Radar
            key={s.name}
            name={s.name}
            dataKey={s.name}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            fillOpacity={0.16}
            strokeWidth={2}
          />
        ))}
        <ChartLegend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
        <ChartTooltip content={(props) => <SkillRadarTooltip {...props} />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function SkillScatterTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as TrendingSkill | undefined;
  if (!d) return null;
  return (
    <div className="rounded-xl px-3 py-2" style={tooltipContentStyle}>
      <p className="text-sm font-semibold text-white">
        {d.name} <span className="text-slate-500 font-normal text-xs">· {d.category}</span>
      </p>
      <p className="text-slate-400 mt-1">Demand: <span className="text-white font-medium">{d.demand_score}</span></p>
      <p className="text-slate-400">Salary premium: <span className="text-white font-medium">+{d.avg_salary_premium_pct}%</span></p>
      <p className="text-slate-400">YoY growth: <span className="text-white font-medium">+{d.yoy_growth}%</span></p>
    </div>
  );
}

function SkillsScatterChart({ skills }: { skills: TrendingSkill[] }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          type="number" dataKey="demand_score" name="Demand Score" domain={[0, 100]}
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          label={{ value: "Demand Score", position: "insideBottom", offset: -14, fill: "var(--text-secondary)", fontSize: 12 }}
        />
        <YAxis
          type="number" dataKey="avg_salary_premium_pct" name="Salary Premium %"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          label={{ value: "Salary Premium %", angle: -90, position: "insideLeft", fill: "var(--text-secondary)", fontSize: 12 }}
        />
        <ZAxis type="number" dataKey="yoy_growth" range={[70, 450]} name="YoY Growth %" />
        <ChartTooltip cursor={{ stroke: "var(--border)" }} content={(props) => <SkillScatterTooltip {...props} />} />
        <Scatter name="Skills" data={skills} fill="var(--accent)" fillOpacity={0.75} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

type SkillsView = "radar" | "scatter" | "list";

function TrendingSkillsPanel({ token }: { token: string | null }) {
  const [data, setData] = useState<{ skills: TrendingSkill[] } | null>(null);
  const [domain, setDomain] = useState("software engineering");
  const [level, setLevel] = useState("mid");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<SkillsView>("radar");

  const fetch_ = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/market/trending-skills`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ domain, level }),
      });
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Domain</label>
            <select className="input-field text-sm" value={domain} onChange={e => setDomain(e.target.value)}>
              {["software engineering", "data engineering", "machine learning", "product management", "devops", "frontend", "backend", "full stack"].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Level</label>
            <select className="input-field text-sm" value={level} onChange={e => setLevel(e.target.value)}>
              {["entry", "mid", "senior", "staff", "exec"].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <button onClick={fetch_} disabled={loading} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Fetch Trends
          </button>
        </div>
      </div>

      {data?.skills && data.skills.length > 0 && (
        <>
          {/* View toggle — Radar / Scatter charts, with the original list kept as a fallback view */}
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--bg-elevated)" }}>
            {([
              { key: "radar", label: "Radar", icon: RadarIcon },
              { key: "scatter", label: "Demand vs Comp", icon: BarChart3 },
              { key: "list", label: "List", icon: List },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={view === key ? {
                  background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                  color: "var(--accent-bright)",
                  border: "1px solid var(--border-hover)",
                } : { color: "#94a3b8" }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {view === "radar" && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <RadarIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Top Skills — Demand, Growth &amp; Salary Premium
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Top {Math.min(5, data.skills.length)} skills by demand score, compared across their three market metrics.
              </p>
              <SkillsRadarChart skills={data.skills} />
            </div>
          )}

          {view === "scatter" && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Demand vs. Salary Premium
              </h3>
              <p className="text-xs text-slate-500 mb-3">Bubble size reflects YoY growth. Hover a point for details.</p>
              <SkillsScatterChart skills={data.skills} />
            </div>
          )}

          {view === "list" && (
            <div className="card divide-y divide-white/5">
              {data.skills.map((s, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="w-8 text-center text-sm font-bold text-slate-500">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{s.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">{s.category}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{s.note}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold" style={{ color: "var(--accent-bright)" }}>{s.demand_score}</div>
                    <div className="text-xs text-emerald-400">+{s.yoy_growth}% YoY</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

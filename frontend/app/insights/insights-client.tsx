"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { motionTransition } from "@/lib/motion-tokens";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BarChart3, Target, BookOpen, Activity,
  Loader2, RefreshCw, AlertCircle,
  Zap, HeartPulse, Radar as RadarIcon,
} from "lucide-react";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip as RTooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell,
  RadarChart, Radar as RadarSeries, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

interface FunnelData {
  total: number;
  last_30_days: number;
  last_7_days: number;
  funnel: Record<string, number>;
  rates: { application_to_interview: number; interview_to_offer: number; overall_offer_rate: number };
}

interface TimelinePoint { date: string; count: number; }

interface ResponseRates {
  overall_response_rate: number;
  by_work_mode: Record<string, { total: number; responded: number; rate: number }>;
}

interface HealthData {
  health_score: number;
  breakdown: Record<string, { score: number; label: string; weight: number }>;
  computed_at: string | null;
}

interface StoryStats {
  total_stories: number;
  readiness: string;
  top_themes: [string, number][];
}

// ── Shared UI bits ────────────────────────────────────────────────────────────

/** Scroll-triggered reveal wrapper — mirrors the whileInView convention already
 *  established in PortfolioPublicView.tsx (initial/whileInView/viewport + the
 *  shared motion-tokens transition helper) so chart sections animate in
 *  consistently with the rest of the app. Respects prefers-reduced-motion via
 *  the app-wide MotionConfig wired in layout.tsx. */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ ...motionTransition("slow", "outQuint"), delay }}
    >
      {children}
    </motion.div>
  );
}

function labelizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Pipeline stage colors wired to the app's theme accent scale (CSS custom
// properties) rather than fixed hex values, so the funnel chart stays
// consistent across every theme preset — same rationale as the sibling
// ApplicationsFunnelChart component (frontend/components/ApplicationsFunnelChart.tsx).
const STAGE_COLORS: Record<string, string> = {
  Saved: "var(--text-muted)",
  Applied: "var(--accent-deep)",
  Assessment: "var(--accent-dark)",
  Screening: "var(--accent-hover-deep)",
  Interview: "var(--accent)",
  Offer: "var(--accent-bright)",
  Rejected: "var(--accent-secondary)",
};

const chartTooltipStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

// ── Application funnel chart (genuine multi-stage conversion data) ────────────
function PipelineFunnelChart({ funnel }: { funnel: Record<string, number> }) {
  const data = Object.entries(funnel).map(([stage, count]) => ({
    name: stage,
    value: count,
    label: `${stage} · ${count}`,
    fill: STAGE_COLORS[stage] || "var(--text-muted)",
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <FunnelChart>
        <RTooltip
          formatter={(value, _name, item) => [
            `${value} application${value === 1 ? "" : "s"}`,
            item?.payload?.name ?? "",
          ]}
          contentStyle={chartTooltipStyle}
          itemStyle={{ color: "var(--text-primary)" }}
        />
        <Funnel dataKey="value" data={data} nameKey="name" isAnimationActive>
          <LabelList dataKey="label" position="center" stroke="none" fill="var(--text-primary)" fontSize={11} fontWeight={600} />
          {data.map(d => <Cell key={d.name} fill={d.fill} />)}
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

// ── 60-day activity trend (genuine time-series data) ──────────────────────────
function ActivityAreaChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="insightsActivityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
          interval={Math.max(0, Math.ceil(data.length / 6) - 1)}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis allowDecimals={false} width={24} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <RTooltip
          contentStyle={chartTooltipStyle}
          labelStyle={{ color: "var(--text-secondary)" }}
          itemStyle={{ color: "var(--text-primary)" }}
          labelFormatter={(label) => new Date(`${label}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          formatter={(value) => [`${value} application${value === 1 ? "" : "s"}`, "Applications"]}
        />
        <Area type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} fill="url(#insightsActivityFill)" activeDot={{ r: 4, fill: "var(--accent-bright)" }} isAnimationActive />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Career health breakdown radar (genuine multi-dimensional scoring data) ────
function CareerHealthRadarChart({ breakdown }: { breakdown: HealthData["breakdown"] }) {
  const data = Object.entries(breakdown).map(([key, val]) => ({
    dimension: labelizeKey(key),
    score: val.score,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="dimension" tick={{ fill: "var(--text-secondary)", fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
        <RadarSeries name="Score" dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.28} strokeWidth={2} />
        <RTooltip
          contentStyle={chartTooltipStyle}
          itemStyle={{ color: "var(--text-primary)" }}
          formatter={(value) => [`${value}/100`, "Score"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Rejection Analyzer Modal ──────────────────────────────────────────────────
function RejectionAnalyzer({ token }: { token: string | null }) {
  const [form, setForm] = useState({ job_title: "", job_description: "", rejection_note: "", resume_text: "" });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/insights/rejection-analysis`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(form),
      });
      if (res.ok) setResult(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <Card className="p-5 gap-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-rose-400" /> Rejection Analyzer
      </h3>
      {!result ? (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="input-field w-full text-sm" placeholder="Job title"
              value={form.job_title} onChange={e => setForm(p => ({ ...p, job_title: e.target.value }))} />
            <input className="input-field w-full text-sm" placeholder="Rejection message (if any)"
              value={form.rejection_note} onChange={e => setForm(p => ({ ...p, rejection_note: e.target.value }))} />
          </div>
          <textarea className="input-field w-full text-sm resize-none" rows={3}
            placeholder="Job description (optional — helps with analysis)"
            value={form.job_description} onChange={e => setForm(p => ({ ...p, job_description: e.target.value }))} />
          <Button onClick={analyze} disabled={loading || !form.job_title.trim()}
            className="btn-primary h-auto flex items-center gap-2 px-4 py-2 text-sm w-fit">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Analyse Rejection
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>
            <p className="text-sm font-semibold text-rose-300 mb-1">Most Likely Reason</p>
            <p className="text-sm text-rose-200">{result.most_likely_reason as string}</p>
          </div>
          {(result.fix_plan as Array<{ action: string; priority: string; timeframe: string }>)?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">FIX PLAN</p>
              <div className="space-y-2">
                {(result.fix_plan as Array<{ action: string; priority: string; timeframe: string }>).map((a, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shrink-0 h-fit">{a.priority}</Badge>
                    <div>
                      <p className="text-xs text-white">{a.action}</p>
                      <p className="text-[10px] text-slate-500">{a.timeframe}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {typeof result.morale_boost === "string" && (
            <p className="text-sm text-slate-400 italic border-t border-white/5 pt-3">{result.morale_boost}</p>
          )}
          <Button variant="ghost" onClick={() => setResult(null)} className="h-auto px-0 text-xs text-slate-500 hover:text-slate-300 hover:bg-transparent">
            ← Analyse another
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
function InsightsSkeleton() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </main>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InsightsClient() {
  const { token } = useAuth();
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [responseRates, setResponseRates] = useState<ResponseRates | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stories, setStories] = useState<StoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pipeline" | "health" | "rejection">("pipeline");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, t, r, h, s] = await Promise.all([
        fetch(`${API}/api/insights/funnel`, { headers: authHeaders(token) }),
        fetch(`${API}/api/insights/timeline?days=60`, { headers: authHeaders(token) }),
        fetch(`${API}/api/insights/response-rates`, { headers: authHeaders(token) }),
        fetch(`${API}/api/insights/health-history`, { headers: authHeaders(token) }),
        fetch(`${API}/api/insights/story-bank`, { headers: authHeaders(token) }),
      ]);
      if (f.ok) setFunnel(await f.json());
      if (t.ok) { const d = await t.json(); setTimeline(d.timeline || []); }
      if (r.ok) setResponseRates(await r.json());
      if (h.ok) setHealth(await h.json());
      if (s.ok) setStories(await s.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <InsightsSkeleton />;

  const hasHealthBreakdown = !!health && Object.keys(health.breakdown).length > 0;

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Insights
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Your career performance analytics</p>
          </div>
          <Button onClick={fetchAll} className="btn-primary h-auto flex items-center gap-2 px-4 py-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Applications", value: funnel?.total ?? 0, color: "var(--accent-bright)" },
            { label: "Last 30 Days", value: funnel?.last_30_days ?? 0, color: "#06b6d4" },
            { label: "Response Rate", value: `${responseRates?.overall_response_rate ?? 0}%`, color: "#10b981" },
            { label: "Offer Rate", value: `${funnel?.rates.overall_offer_rate ?? 0}%`, color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-4 text-center gap-0">
              <div className="text-2xl font-bold mb-1" style={{ color }}>{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
          <TabsList className="flex w-full gap-1 mb-5 p-1 h-auto rounded-xl bg-transparent" style={{ background: "var(--bg-elevated)" }}>
            {(["pipeline", "health", "rejection"] as const).map(tab => (
              <TabsTrigger key={tab} value={tab}
                className="flex-1 h-auto py-2 rounded-lg text-sm font-medium capitalize transition-all data-[state=active]:shadow-none"
                style={activeTab === tab ? {
                  background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                  color: "var(--accent-bright)",
                  border: "1px solid var(--border-hover)",
                } : { color: "#94a3b8", background: "transparent", border: "1px solid transparent" }}>
                {tab === "pipeline" ? "Pipeline" : tab === "health" ? "Career Health" : "Rejection Analyzer"}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── PIPELINE TAB ── */}
          <TabsContent value="pipeline" className="space-y-5 mt-0">
            {funnel && funnel.total === 0 ? (
              <Card className="p-2">
                <EmptyState
                  icon={Target}
                  title="No applications yet"
                  description="Once you start applying to roles, your pipeline funnel and 60-day activity trend will appear here."
                  bordered={false}
                />
              </Card>
            ) : (
              <>
                {/* Funnel */}
                {funnel && (
                  <Reveal>
                    <Card className="p-5 gap-0">
                      <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4" style={{ color: "var(--accent)" }} /> Application Funnel
                      </h3>
                      <PipelineFunnelChart funnel={funnel.funnel} />
                      <div className="grid grid-cols-3 gap-3 mt-2 pt-4 border-t border-white/5">
                        <div className="text-center">
                          <div className="text-lg font-bold" style={{ color: "#06b6d4" }}>{funnel.rates.application_to_interview}%</div>
                          <div className="text-[10px] text-slate-500">→ Interview</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold" style={{ color: "#f59e0b" }}>{funnel.rates.interview_to_offer}%</div>
                          <div className="text-[10px] text-slate-500">→ Offer</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold" style={{ color: "#10b981" }}>{funnel.rates.overall_offer_rate}%</div>
                          <div className="text-[10px] text-slate-500">Overall</div>
                        </div>
                      </div>
                    </Card>
                  </Reveal>
                )}

                {/* Activity timeline */}
                {timeline.length > 0 && (
                  <Reveal delay={0.06}>
                    <Card className="p-5 gap-0">
                      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} /> 60-Day Activity
                      </h3>
                      <ActivityAreaChart data={timeline} />
                    </Card>
                  </Reveal>
                )}

                {/* Response rates by work mode */}
                {responseRates && Object.keys(responseRates.by_work_mode).length > 0 && (
                  <Card className="p-5 gap-0">
                    <h3 className="text-sm font-semibold text-white mb-4">Response Rate by Work Mode</h3>
                    <div className="space-y-3">
                      {Object.entries(responseRates.by_work_mode).map(([mode, data]) => (
                        <div key={mode}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-400">{mode}</span>
                            <span className="font-bold text-white">{data.rate}% <span className="font-normal text-slate-500">({data.responded}/{data.total})</span></span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${data.rate}%`, background: "var(--accent)" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Story bank */}
                {stories && (
                  <Card className="p-5 gap-0">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" style={{ color: "var(--accent)" }} /> Interview Story Bank
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-bold text-white">{stories.total_stories}</div>
                      <div>
                        <Badge variant="outline" className={
                          stories.readiness === "ready" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                          stories.readiness === "building" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                          "bg-rose-500/20 text-rose-400 border-rose-500/30"
                        }>{stories.readiness === "ready" ? "Interview Ready" : stories.readiness === "building" ? "Building Up" : "Needs Work"}</Badge>
                        <p className="text-xs text-slate-500 mt-0.5">Target: 10+ stories</p>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ── CAREER HEALTH TAB ── */}
          <TabsContent value="health" className="mt-0">
            {health && (
              hasHealthBreakdown ? (
                <Reveal>
                  <Card className="p-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-center">
                      <div className="flex items-center gap-5">
                        <div className="text-center shrink-0">
                          <div className="text-5xl font-bold" style={{ color: health.health_score >= 70 ? "#10b981" : health.health_score >= 50 ? "#f59e0b" : "#f43f5e" }}>
                            {health.health_score}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">Career Health Score</div>
                        </div>
                        <div className="flex-1 space-y-2">
                          {Object.entries(health.breakdown).map(([key, val]) => {
                            const color = val.score >= 70 ? "#10b981" : val.score >= 50 ? "#f59e0b" : "#f43f5e";
                            return (
                              <div key={key}>
                                <div className="flex justify-between text-[10px] mb-0.5">
                                  <span className="text-slate-400">{labelizeKey(key)}</span>
                                  <span style={{ color }}>{val.score}</span>
                                </div>
                                <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${val.score}%`, background: color }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wide">
                          <RadarIcon className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} /> Dimension Breakdown
                        </h3>
                        <CareerHealthRadarChart breakdown={health.breakdown} />
                      </div>
                    </div>
                  </Card>
                </Reveal>
              ) : (
                <Card className="p-2">
                  <EmptyState
                    icon={HeartPulse}
                    title="Career health not computed yet"
                    description="Build out your career graph — skills, goals, and story bank — to unlock a 6-dimension career health score."
                    action={{ label: "Set Up Career Graph", href: "/career-graph" }}
                  />
                </Card>
              )
            )}
          </TabsContent>

          {/* ── REJECTION ANALYZER TAB ── */}
          <TabsContent value="rejection" className="mt-0">
            <RejectionAnalyzer token={token} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

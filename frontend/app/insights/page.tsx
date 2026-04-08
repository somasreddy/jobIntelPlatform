"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  BarChart3, Target, BookOpen, Activity,
  Loader2, RefreshCw, AlertCircle,
  Zap,
} from "lucide-react";

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
    <div className="card p-5 space-y-4">
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
          <button onClick={analyze} disabled={loading || !form.job_title.trim()}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Analyse Rejection
          </button>
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
                    <span className="text-xs font-bold text-emerald-400 shrink-0">{a.priority}</span>
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
          <button onClick={() => setResult(null)} className="text-xs text-slate-500 hover:text-slate-300">
            ← Analyse another
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InsightsPage() {
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

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
    </div>
  );

  const STAGE_COLORS: Record<string, string> = {
    Saved: "#94a3b8", Applied: "#6366f1", Assessment: "#8b5cf6",
    Screening: "#06b6d4", Interview: "#f59e0b", Offer: "#10b981", Rejected: "#f43f5e",
  };

  const maxTimeline = Math.max(...timeline.map(t => t.count), 1);

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
          <button onClick={fetchAll} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Applications", value: funnel?.total ?? 0, color: "var(--accent-bright)" },
            { label: "Last 30 Days", value: funnel?.last_30_days ?? 0, color: "#06b6d4" },
            { label: "Response Rate", value: `${responseRates?.overall_response_rate ?? 0}%`, color: "#10b981" },
            { label: "Offer Rate", value: `${funnel?.rates.overall_offer_rate ?? 0}%`, color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <div className="text-2xl font-bold mb-1" style={{ color }}>{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
          {(["pipeline", "health", "rejection"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={activeTab === tab ? {
                background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                color: "var(--accent-bright)",
                border: "1px solid var(--border-hover)",
              } : { color: "#94a3b8" }}>
              {tab === "pipeline" ? "Pipeline" : tab === "health" ? "Career Health" : "Rejection Analyzer"}
            </button>
          ))}
        </div>

        {/* ── PIPELINE TAB ── */}
        {activeTab === "pipeline" && (
          <div className="space-y-5">
            {/* Funnel */}
            {funnel && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: "var(--accent)" }} /> Application Funnel
                </h3>
                <div className="space-y-2">
                  {Object.entries(funnel.funnel).map(([stage, count]) => {
                    const maxCount = Math.max(...Object.values(funnel.funnel), 1);
                    const pct = Math.round(count / maxCount * 100);
                    return (
                      <div key={stage}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-400 w-24">{stage}</span>
                          <span className="font-bold text-white">{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: STAGE_COLORS[stage] || "#94a3b8" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5">
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
              </div>
            )}

            {/* Activity timeline (mini spark chart) */}
            {timeline.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} /> 60-Day Activity
                </h3>
                <div className="flex items-end gap-0.5 h-16">
                  {timeline.map((pt, i) => (
                    <div key={i} title={`${pt.date}: ${pt.count}`}
                      className="flex-1 rounded-t-sm transition-all cursor-pointer hover:opacity-80"
                      style={{
                        height: `${Math.max(4, (pt.count / maxTimeline) * 100)}%`,
                        background: pt.count > 0 ? "var(--accent)" : "rgba(255,255,255,0.05)",
                        minWidth: "3px",
                      }} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>60 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            )}

            {/* Response rates by work mode */}
            {responseRates && Object.keys(responseRates.by_work_mode).length > 0 && (
              <div className="card p-5">
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
              </div>
            )}

            {/* Story bank */}
            {stories && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" style={{ color: "var(--accent)" }} /> Interview Story Bank
                </h3>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-white">{stories.total_stories}</div>
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      stories.readiness === "ready" ? "bg-emerald-500/20 text-emerald-400" :
                      stories.readiness === "building" ? "bg-amber-500/20 text-amber-400" :
                      "bg-rose-500/20 text-rose-400"
                    }`}>{stories.readiness === "ready" ? "Interview Ready" : stories.readiness === "building" ? "Building Up" : "Needs Work"}</span>
                    <p className="text-xs text-slate-500 mt-0.5">Target: 10+ stories</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CAREER HEALTH TAB ── */}
        {activeTab === "health" && health && (
          <div className="space-y-4">
            <div className="card p-5 flex items-center gap-5">
              <div className="text-center">
                <div className="text-5xl font-bold" style={{ color: health.health_score >= 70 ? "#10b981" : health.health_score >= 50 ? "#f59e0b" : "#f43f5e" }}>
                  {health.health_score}
                </div>
                <div className="text-xs text-slate-400 mt-1">Career Health Score</div>
              </div>
              <div className="flex-1 space-y-2">
                {Object.entries(health.breakdown).map(([key, val]) => {
                  const color = val.score >= 70 ? "#10b981" : val.score >= 50 ? "#f59e0b" : "#f43f5e";
                  const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">{label}</span>
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
          </div>
        )}

        {/* ── REJECTION ANALYZER TAB ── */}
        {activeTab === "rejection" && <RejectionAnalyzer token={token} />}
      </main>
    </div>
  );
}

"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/lib/ProfileContext";
import {
  TrendingUp, TrendingDown, Minus, BarChart3, DollarSign,
  Zap, Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, Target,
  AlertCircle, CheckCircle2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RoleDemand { trend: string; score: number; summary: string; }
interface SalaryMovement { direction: string; pct_change: number; current_range: { min: number; max: number; currency: string }; summary: string; }
interface HotSkill { skill: string; demand_score: number; why: string; }
interface DecliningSkill { skill: string; reason: string; }

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
  p25: number; p50: number; p75: number; p90: number;
  currency: string;
  total_comp_note: string;
  factors: string[];
  remote_premium: string;
  error?: string;
}

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
  const [salary, setSalary] = useState<SalaryBenchmark | null>(null);
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
      if (res.ok) setRadar(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  const fetchSalary = async () => {
    if (!role.trim()) return;
    setSalaryLoading(true);
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
      if (res.ok) setSalary(await res.json());
    } catch (e) { console.error(e); }
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
          ) : null
        )}

        {/* ── SALARY TAB ── */}
        {activeTab === "salary" && (
          <div className="space-y-5">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Salary Benchmark
              </h3>
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
            </div>

            {salary && !salary.error && (
              <div className="card p-5">
                <h3 className="text-base font-bold text-white mb-4">{salary.role}</h3>
                {/* Percentile bars */}
                <div className="space-y-3 mb-4">
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
              </div>
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

function TrendingSkillsPanel({ token }: { token: string | null }) {
  const [data, setData] = useState<{ skills: Array<{ name: string; demand_score: number; yoy_growth: number; avg_salary_premium_pct: number; category: string; note: string }> } | null>(null);
  const [domain, setDomain] = useState("software engineering");
  const [level, setLevel] = useState("mid");
  const [loading, setLoading] = useState(false);

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

      {data?.skills && (
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
    </div>
  );
}

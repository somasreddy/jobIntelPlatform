"use client";
import { useState, useEffect, useCallback, type ComponentProps } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/lib/AuthContext";
import { loadProfile } from "@/lib/profile";
import { useProfile } from "@/lib/ProfileContext";
import { cn } from "@/lib/utils";
import { durations, easings } from "@/lib/motion-tokens";
import {
  Activity, Target, Award,
  Plus, Trash2, RefreshCw, Loader2, Zap,
  CheckCircle2, Info, Share2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import CareerSkillGraph from "./CareerSkillGraph";
import type { CareerGraph, CareerSkill, CareerGoal, Insight } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

const DIM_LABELS: Record<string, string> = {
  skills_recency:       "Skills Recency",
  profile_completeness: "Profile Completeness",
  application_activity: "Application Activity",
  interview_readiness:  "Interview Readiness",
  goal_alignment:       "Goal Alignment",
  market_demand:        "Market Demand",
};

const SKILL_LEVELS = ["", "Beginner", "Novice", "Intermediate", "Advanced", "Expert"];
const MILESTONE_TYPES = ["job_change", "promotion", "cert", "project", "education"];

function buildLocalGraphFromStorage(): CareerGraph {
  const skills: CareerSkill[] = [];
  try {
    const p = loadProfile();
    if (p) {
      const entries: Array<[string[], string]> = [
        [p.skills || [], "Skills"],
        [p.frameworks || [], "Frameworks"],
        [p.languages || [], "Languages"],
        [p.cicdTools || [], "CI/CD"],
        [p.aiTools || [], "AI Tools"],
      ];
      entries.forEach(([arr, cat]) => {
        arr.forEach((name, i) => skills.push({
          id: `local-${cat}-${i}`,
          skill_name: name,
          category: cat,
          level: 3,
          verified: false,
          last_used_year: new Date().getFullYear(),
          trending_score: 0,
        }));
      });
    }
  } catch { /* ignore */ }
  return {
    graph_id: "local",
    health_score: Math.min(60, skills.length * 6),
    health_breakdown: {},
    onboarding_complete: skills.length > 0,
    last_computed: null,
    skills,
    goals: [],
    milestones: [],
  };
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#06b6d4" : score >= 40 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-white">{score}</div>
        <div className="text-[10px] text-slate-400">/ 100</div>
      </div>
    </div>
  );
}

// Thin wrapper that keeps the shadcn Card primitive (structure/semantics)
// while neutralizing its default flex/gap/padding/shadow utilities so the
// app's existing `.card` look (glass blur, hover glow, gradient ring — all
// defined in globals.css) renders exactly as it did before the migration.
function Panel({ className, ...props }: ComponentProps<typeof Card>) {
  return <Card className={cn("card block gap-0 rounded-none border-0 p-0 shadow-none", className)} {...props} />;
}

// Small entrance micro-interaction for whichever tab panel just mounted —
// Radix unmounts inactive TabsContent, so this fires a fresh fade+rise each
// time the user switches tabs. Tokens come from lib/motion-tokens.ts;
// prefers-reduced-motion is handled globally via the root MotionConfig.
function TabFade({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durations.base, ease: easings.outQuint }}
    >
      {children}
    </motion.div>
  );
}

type TabKey = "health" | "skills" | "goals" | "milestones" | "graph";
const TAB_LABELS: Record<TabKey, string> = {
  health: "Health Score",
  skills: "Skills",
  goals: "Goals",
  milestones: "Milestones",
  graph: "Graph",
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CareerGraphClient() {
  const { token } = useAuth();
  const { profile } = useProfile();

  const [graph, setGraph] = useState<CareerGraph | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("health");

  // Skill editor
  const [newSkill, setNewSkill] = useState({ skill_name: "", level: 3, category: "", last_used_year: new Date().getFullYear() });
  const [savingSkill, setSavingSkill] = useState(false);

  // Goal editor
  const [goal, setGoal] = useState<Partial<CareerGoal>>({});
  const [savingGoal, setSavingGoal] = useState(false);

  // Milestone editor
  const [newMilestone, setNewMilestone] = useState({ type: "job_change", title: "", company: "", milestone_date: "", impact_statement: "" });
  const [savingMilestone, setSavingMilestone] = useState(false);

  const [isOffline, setIsOffline] = useState(false);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/career-graph/`, { headers: authHeaders(token) });
      if (res.ok) {
        const data: CareerGraph = await res.json();
        // If API returns no skills, merge in profile skills so graph isn't empty
        if (data.skills.length === 0) {
          const local = buildLocalGraphFromStorage();
          data.skills = local.skills;
        }
        setGraph(data);
        setIsOffline(false);
        if (data.goals?.[0]) setGoal(data.goals[0]);
      } else {
        setGraph(buildLocalGraphFromStorage());
        setIsOffline(true);
      }
    } catch {
      setGraph(buildLocalGraphFromStorage());
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const localRecompute = useCallback(() => {
    const skills = graph?.skills ?? [];
    const skillScore = Math.min(100, skills.length * 12);
    const goalScore = (graph?.goals?.length ?? 0) > 0 ? 80 : 25;
    const milestoneScore = (graph?.milestones?.length ?? 0) > 0 ? 75 : 30;
    const healthScore = Math.round(skillScore * 0.5 + goalScore * 0.3 + milestoneScore * 0.2);
    setGraph(prev => prev ? {
      ...prev,
      health_score: healthScore,
      health_breakdown: {
        skills_recency:       { score: skillScore, label: `${skills.length} skills in profile`, weight: 0.5 },
        goal_alignment:       { score: goalScore, label: "Career goals set", weight: 0.3 },
        interview_readiness:  { score: milestoneScore, label: "Career milestones", weight: 0.2 },
      },
      last_computed: new Date().toISOString(),
    } : prev);
    const newInsights: Insight[] = [];
    if (skills.length < 5) newInsights.push({ dimension: "skills_recency", current_score: skillScore, label: "Skills", potential_gain: 100 - skillScore, action: "Add at least 5 skills to increase your health score" });
    if ((graph?.goals?.length ?? 0) === 0) newInsights.push({ dimension: "goal_alignment", current_score: goalScore, label: "Goals", potential_gain: 80 - goalScore, action: "Set a career goal in the Goals tab" });
    if ((graph?.milestones?.length ?? 0) === 0) newInsights.push({ dimension: "interview_readiness", current_score: milestoneScore, label: "Milestones", potential_gain: 75 - milestoneScore, action: "Add career milestones to strengthen your profile" });
    setInsights(newInsights);
  }, [graph]);

  const recomputeHealth = async () => {
    setComputing(true);
    try {
      const res = await fetch(`${API}/api/career-graph/compute-health`, {
        method: "POST",
        headers: authHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
        await fetchGraph();
      } else {
        localRecompute();
      }
    } catch {
      localRecompute();
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // Seed the Goals form from profile whenever goal fields are still empty
  useEffect(() => {
    if (!profile) return;
    setGoal(prev => ({
      ...prev,
      target_role:       prev.target_role       || profile.currentRole || undefined,
      target_location:   prev.target_location   || profile.preferredLocations?.[0] || profile.currentLocation || undefined,
      target_salary_min: prev.target_salary_min || (profile.currentSalary > 0 ? profile.currentSalary : undefined),
      target_salary_max: prev.target_salary_max || (profile.currentSalary > 0 ? Math.round(profile.currentSalary * 1.3) : undefined),
      work_mode:         prev.work_mode         || (profile.workMode !== "Any" ? profile.workMode : undefined) || undefined,
    }));
  }, [profile]);

  // ── Skill save ──────────────────────────────────────────────────────────────
  const saveSkill = async () => {
    if (!newSkill.skill_name.trim()) return;
    setSavingSkill(true);
    const existing = graph?.skills.map(s => ({
      skill_name: s.skill_name, level: s.level,
      category: s.category, last_used_year: s.last_used_year,
      verified: s.verified, trending_score: s.trending_score, years_experience: 0,
    })) || [];
    const updated = [
      ...existing.filter(s => s.skill_name.toLowerCase() !== newSkill.skill_name.toLowerCase()),
      { ...newSkill, verified: false, trending_score: 0, years_experience: 0 },
    ];
    try {
      await fetch(`${API}/api/career-graph/skills`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(updated),
      });
      setNewSkill({ skill_name: "", level: 3, category: "", last_used_year: new Date().getFullYear() });
      await fetchGraph();
    } catch (e) { console.error(e); }
    finally { setSavingSkill(false); }
  };

  const deleteSkill = async (name: string) => {
    await fetch(`${API}/api/career-graph/skills/${encodeURIComponent(name)}`, {
      method: "DELETE", headers: authHeaders(token),
    });
    await fetchGraph();
  };

  // ── Goal save ───────────────────────────────────────────────────────────────
  const saveGoal = async () => {
    setSavingGoal(true);
    try {
      await fetch(`${API}/api/career-graph/goals`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(goal),
      });
      await fetchGraph();
    } catch (e) { console.error(e); }
    finally { setSavingGoal(false); }
  };

  // ── Milestone save ──────────────────────────────────────────────────────────
  const saveMilestone = async () => {
    if (!newMilestone.title.trim()) return;
    setSavingMilestone(true);
    try {
      await fetch(`${API}/api/career-graph/milestones`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(newMilestone),
      });
      setNewMilestone({ type: "job_change", title: "", company: "", milestone_date: "", impact_statement: "" });
      await fetchGraph();
    } catch (e) { console.error(e); }
    finally { setSavingMilestone(false); }
  };

  const deleteMilestone = async (id: string) => {
    await fetch(`${API}/api/career-graph/milestones/${id}`, {
      method: "DELETE", headers: authHeaders(token),
    });
    await fetchGraph();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
    </div>
  );

  const healthScore = graph?.health_score ?? 0;
  const breakdown = graph?.health_breakdown ?? {};
  const skills = graph?.skills ?? [];
  const goals = graph?.goals ?? [];
  const milestones = graph?.milestones ?? [];
  const graphIsEmpty = skills.length === 0 && goals.length === 0 && milestones.length === 0;

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-5xl">

        {/* Offline banner */}
        {isOffline && (
          <div className="mb-4 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", color: "var(--accent-bright)" }}>
            <Activity className="w-3.5 h-3.5 shrink-0" />
            Showing profile data — backend database offline. Skills, goals and milestones need the backend running to persist.
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Activity className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Career Graph
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Your persistent AI model of career fitness</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={recomputeHealth} disabled={computing} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm h-auto">
                {computing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Recompute
              </Button>
            </TooltipTrigger>
            <TooltipContent>Recomputes your health score from your latest skills, goals, and milestones</TooltipContent>
          </Tooltip>
        </div>

        {/* Tab strip */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
          <TabsList className="w-full h-auto gap-1 mb-6 p-1 rounded-xl bg-transparent" style={{ background: "var(--bg-elevated)" }}>
            {(Object.keys(TAB_LABELS) as TabKey[]).map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="flex-1 h-auto py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:shadow-none"
                style={activeTab === tab ? {
                  background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                  color: "var(--accent-bright)",
                  border: "1px solid var(--border-hover)",
                } : { color: "#94a3b8" }}
              >
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── HEALTH TAB ── */}
          <TabsContent value="health" className="mt-0">
          <TabFade className="space-y-6">
            {/* Score summary */}
            <Panel className="p-6 flex flex-col sm:flex-row items-center gap-6">
              <ScoreRing score={healthScore} size={130} />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">
                  {healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Fair" : "Needs Work"}
                </h2>
                <p className="text-slate-400 text-sm mb-3">
                  {healthScore >= 80
                    ? "You're in great shape for your job search."
                    : "Here are your biggest improvement opportunities."}
                </p>
                {graph?.last_computed && (
                  <p className="text-xs text-slate-500">
                    Last computed {new Date(graph.last_computed).toLocaleString()}
                  </p>
                )}
                <Button
                  variant="ghost"
                  onClick={recomputeHealth}
                  disabled={computing}
                  className="mt-3 h-auto p-0 text-xs flex items-center gap-1.5 transition-colors hover:bg-transparent"
                  style={{ color: "var(--accent-bright)" }}
                >
                  {computing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                  Recompute now
                </Button>
              </div>
            </Panel>

            {/* Breakdown grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(breakdown).map(([key, val]) => {
                const pct = val.score;
                const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#06b6d4" : pct >= 40 ? "#f59e0b" : "#f43f5e";
                return (
                  <Panel key={key} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-300">{DIM_LABELS[key] || key}</span>
                      <span className="text-sm font-bold" style={{ color }}>{pct}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">{val.label}</p>
                  </Panel>
                );
              })}
            </div>

            {/* Insights */}
            {insights.length > 0 && (
              <Panel className="p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  Top Improvement Actions
                </h3>
                <div className="space-y-3">
                  {insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white"
                        style={{ background: "color-mix(in srgb, var(--accent) 30%, transparent)" }}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white">{ins.action}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {DIM_LABELS[ins.dimension]} · current: {ins.current_score} · potential gain: +{ins.potential_gain}pts
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </TabFade>
          </TabsContent>

          {/* ── SKILLS TAB ── */}
          <TabsContent value="skills" className="mt-0">
          <TabFade className="space-y-6">
            {/* Add skill */}
            <Panel className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Add Skill
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <input
                  className="input-field col-span-2 sm:col-span-1"
                  placeholder="Skill name"
                  value={newSkill.skill_name}
                  onChange={e => setNewSkill(p => ({ ...p, skill_name: e.target.value }))}
                />
                <select
                  className="input-field"
                  value={newSkill.level}
                  onChange={e => setNewSkill(p => ({ ...p, level: +e.target.value }))}
                >
                  {[1,2,3,4,5].map(l => <option key={l} value={l}>{SKILL_LEVELS[l]}</option>)}
                </select>
                <input
                  className="input-field"
                  placeholder="Category"
                  value={newSkill.category}
                  onChange={e => setNewSkill(p => ({ ...p, category: e.target.value }))}
                />
                <input
                  className="input-field"
                  type="number"
                  placeholder="Last used year"
                  value={newSkill.last_used_year}
                  onChange={e => setNewSkill(p => ({ ...p, last_used_year: +e.target.value }))}
                />
              </div>
              <Button
                onClick={saveSkill}
                disabled={savingSkill || !newSkill.skill_name.trim()}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm h-auto"
              >
                {savingSkill ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add Skill
              </Button>
            </Panel>

            {/* Skills list */}
            <Panel className="divide-y divide-white/5">
              {skills.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">No skills yet — add some above.</p>
              )}
              {skills.map(sk => (
                <div key={sk.id} className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{sk.skill_name}</span>
                      {sk.verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {SKILL_LEVELS[sk.level]} · {sk.category || "General"} · {sk.last_used_year ? `Used ${sk.last_used_year}` : "Year unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(l => (
                        <div
                          key={l}
                          className="w-2 h-2 rounded-full"
                          style={{ background: l <= sk.level ? "var(--accent)" : "rgba(255,255,255,0.1)" }}
                        />
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => deleteSkill(sk.skill_name)}
                      className="h-auto w-auto p-1 ml-2 text-slate-600 hover:text-rose-400 hover:bg-transparent"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </Panel>
          </TabFade>
          </TabsContent>

          {/* ── GOALS TAB ── */}
          <TabsContent value="goals" className="mt-0">
          <TabFade>
            <Panel className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Career Target
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target Role</label>
                  <input className="input-field w-full" placeholder="e.g. Senior Engineer"
                    value={goal.target_role || ""} onChange={e => setGoal(p => ({ ...p, target_role: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target Location</label>
                  <input className="input-field w-full" placeholder="e.g. Remote, Berlin"
                    value={goal.target_location || ""} onChange={e => setGoal(p => ({ ...p, target_location: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min Salary (USD/yr)</label>
                  <input className="input-field w-full" type="number" placeholder="120000"
                    value={goal.target_salary_min || ""} onChange={e => setGoal(p => ({ ...p, target_salary_min: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Salary (USD/yr)</label>
                  <input className="input-field w-full" type="number" placeholder="160000"
                    value={goal.target_salary_max || ""} onChange={e => setGoal(p => ({ ...p, target_salary_max: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Timeline (months)</label>
                  <input className="input-field w-full" type="number" placeholder="6"
                    value={goal.timeline_months || ""} onChange={e => setGoal(p => ({ ...p, timeline_months: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Work Mode</label>
                  <select className="input-field w-full"
                    value={goal.work_mode || ""} onChange={e => setGoal(p => ({ ...p, work_mode: e.target.value }))}>
                    <option value="">Any</option>
                    <option>Remote</option><option>Hybrid</option><option>On-site</option>
                  </select>
                </div>
              </div>
              <Button
                onClick={saveGoal}
                disabled={savingGoal}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm h-auto"
              >
                {savingGoal ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Save Goals
              </Button>
            </Panel>
          </TabFade>
          </TabsContent>

          {/* ── MILESTONES TAB ── */}
          <TabsContent value="milestones" className="mt-0">
          <TabFade className="space-y-6">
            {/* Add milestone */}
            <Panel className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Add Milestone
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <select className="input-field"
                  value={newMilestone.type} onChange={e => setNewMilestone(p => ({ ...p, type: e.target.value }))}>
                  {MILESTONE_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
                <input className="input-field" placeholder="Title (e.g. Promoted to Senior)"
                  value={newMilestone.title} onChange={e => setNewMilestone(p => ({ ...p, title: e.target.value }))} />
                <input className="input-field" placeholder="Company"
                  value={newMilestone.company} onChange={e => setNewMilestone(p => ({ ...p, company: e.target.value }))} />
                <input className="input-field" placeholder="Date (YYYY-MM)" pattern="\d{4}-\d{2}"
                  value={newMilestone.milestone_date} onChange={e => setNewMilestone(p => ({ ...p, milestone_date: e.target.value }))} />
                <textarea className="input-field col-span-full resize-none" rows={2}
                  placeholder="Impact statement — what did you achieve?"
                  value={newMilestone.impact_statement}
                  onChange={e => setNewMilestone(p => ({ ...p, impact_statement: e.target.value }))}
                />
              </div>
              <Button
                onClick={saveMilestone}
                disabled={savingMilestone || !newMilestone.title.trim()}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm h-auto"
              >
                {savingMilestone ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add Milestone
              </Button>
            </Panel>

            {/* Timeline */}
            <div className="space-y-3">
              {milestones.length === 0 && (
                <Panel className="p-6 text-center text-sm text-slate-500">
                  No milestones yet — track your career journey above.
                </Panel>
              )}
              {milestones.map((m, i) => (
                <Panel key={m.id} className="p-4 flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "color-mix(in srgb, var(--accent) 25%, transparent)" }}
                    >
                      <Award className="w-4 h-4" style={{ color: "var(--accent-bright)" }} />
                    </div>
                    {i < milestones.length - 1 && (
                      <div className="w-px flex-1 mt-1" style={{ background: "var(--border)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge
                          className="rounded-full uppercase tracking-wide font-semibold text-[11px] border-transparent mr-2"
                          style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent-bright)" }}
                        >
                          {m.type.replace("_", " ")}
                        </Badge>
                        {m.milestone_date && (
                          <span className="text-xs text-slate-500">{m.milestone_date}</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => deleteMilestone(m.id)}
                        className="h-auto w-auto p-1 shrink-0 text-slate-600 hover:text-rose-400 hover:bg-transparent"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <p className="text-sm font-semibold text-white mt-1">{m.title}</p>
                    {m.company && <p className="text-xs text-slate-400">{m.company}</p>}
                    {m.impact_statement && <p className="text-xs text-slate-500 mt-1 italic">&quot;{m.impact_statement}&quot;</p>}
                  </div>
                </Panel>
              ))}
            </div>
          </TabFade>
          </TabsContent>

          {/* ── GRAPH TAB ── */}
          <TabsContent value="graph" className="mt-0">
          <TabFade>
            <Panel className="p-5">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  Career Skill Graph
                </h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-slate-500 cursor-help">
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[260px]">
                    Your CareerGraph, laid out as its real relationships: skills grouped by
                    category, your active goal, and milestones chained in chronological order —
                    all linked to the central health hub. Hover any node for details.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                A live map of your skills, goal, and milestones — the same data as the other tabs, drawn as a graph.
              </p>

              {graphIsEmpty ? (
                <EmptyState
                  icon={Share2}
                  title="Nothing to graph yet"
                  description="Add a few skills, a career goal, or a milestone and they'll appear here as a connected graph."
                  bordered={false}
                />
              ) : (
                <>
                  <Separator className="mb-5" />
                  <CareerSkillGraph
                    skills={skills}
                    goals={goals}
                    milestones={milestones}
                    healthScore={healthScore}
                  />
                </>
              )}
            </Panel>
          </TabFade>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

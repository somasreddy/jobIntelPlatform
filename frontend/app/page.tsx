"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Activity, Briefcase, Target, BookOpen, BarChart3,
  ArrowRight, CheckCircle2, Circle, Zap, TrendingUp,
  Users, Award, ChevronRight, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/lib/ProfileContext";
import { CandidateProfile } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HealthData {
  health_score: number;
  breakdown: Record<string, { score: number; label: string; weight: number }>;
  insights: Array<{ dimension: string; suggestion: string; potential_gain: number }>;
}

interface FunnelData {
  stages: Array<{ stage: string; count: number }>;
  total: number;
  last_30_days: number;
  response_rate: number;
  offer_rate: number;
}

interface JobMatch {
  id: string;
  title: string;
  organization: string;
  location: string;
  fitScore?: number;
  fitBadge?: string;
  salary_min?: number;
  salary_max?: number;
  work_mode?: string;
}

interface LearningPath {
  id: string;
  skill_name: string;
  progress_pct: number;
  status: string;
  estimated_hours: number;
}

interface CampaignTodo {
  id: string;
  text: string;
  priority: string;
  category: string;
  done?: boolean;
}

function profileSkills(profile: CandidateProfile | null): string[] {
  if (!profile) return [];
  return Array.from(new Set([
    ...(profile.skills ?? []),
    ...(profile.frameworks ?? []),
    ...(profile.languages ?? []),
    ...(profile.cicdTools ?? []),
    ...(profile.aiTools ?? []),
  ].map((skill) => skill.trim()).filter(Boolean)));
}

function buildLocalHealth(profile: CandidateProfile | null): HealthData | null {
  if (!profile) return null;
  const skills = profileSkills(profile);
  const skillScore = Math.min(100, Math.round((skills.length / 12) * 100));
  const expScore = Math.min(100, Math.round(((profile.experienceYears || 0) / 10) * 100));
  const completedFields = [profile.name, profile.currentRole, profile.currentLocation, profile.workMode, profile.currency].filter(Boolean).length;
  const profileScore = Math.min(100, Math.round((completedFields / 5) * 70) + (profile.resumeText ? 30 : 0));
  const aiScore = Math.min(100, Math.round(((profile.aiTools?.length || 0) / 5) * 100));
  const total = Math.round(skillScore * 0.4 + expScore * 0.25 + profileScore * 0.25 + aiScore * 0.1);
  const weakest = [
    { dimension: "skills", score: skillScore, suggestion: "Add high-demand skills from your target job descriptions.", potential_gain: Math.max(0, 100 - skillScore) },
    { dimension: "experience", score: expScore, suggestion: "Add quantified achievements and recent role milestones.", potential_gain: Math.max(0, 100 - expScore) },
    { dimension: "profile", score: profileScore, suggestion: "Complete location, work mode, salary, and resume text for stronger matching.", potential_gain: Math.max(0, 100 - profileScore) },
    { dimension: "ai_tools", score: aiScore, suggestion: "Add AI-assisted delivery tools you actively use.", potential_gain: Math.max(0, 100 - aiScore) },
  ].sort((a, b) => a.score - b.score)[0];

  return {
    health_score: total,
    breakdown: {
      skills: { score: skillScore, label: `${skills.length} skills`, weight: 0.4 },
      experience: { score: expScore, label: `${profile.experienceYears || 0} yrs experience`, weight: 0.25 },
      profile: { score: profileScore, label: "Profile completeness", weight: 0.25 },
      ai_tools: { score: aiScore, label: `${profile.aiTools?.length || 0} AI tools`, weight: 0.1 },
    },
    insights: [{ dimension: weakest.dimension, suggestion: weakest.suggestion, potential_gain: weakest.potential_gain }],
  };
}

function buildProfileTodos(profile: CandidateProfile | null): CampaignTodo[] {
  if (!profile) return [];
  const role = profile.currentRole || "target role";
  const location = profile.preferredLocations?.[0] || profile.currentLocation || "your target market";
  return [
    { id: "profile-search-jobs", text: `Search fresh ${role} openings in ${location}`, priority: "high", category: "jobs" },
    { id: "profile-tailor-resume", text: "Tailor your resume against one high-fit JD", priority: "high", category: "resume" },
    { id: "profile-interview-drill", text: `Practice 3 interview questions for ${role}`, priority: "medium", category: "interview" },
  ];
}

function buildProfilePaths(profile: CandidateProfile | null): LearningPath[] {
  if (!profile) return [];
  return profileSkills(profile).slice(0, 3).map((skill, index) => ({
    id: `profile-path-${skill.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    skill_name: skill,
    progress_pct: Math.max(15, 35 - index * 5),
    status: "active",
    estimated_hours: 6 + index * 2,
  }));
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 75 ? "var(--accent-bright)" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: accent
            ? "linear-gradient(135deg, var(--accent-deep), var(--accent))"
            : "var(--bg-elevated)",
        }}>
        <Icon className="w-5 h-5" style={{ color: accent ? "white" : "var(--accent-bright)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-white leading-tight">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--accent-bright)" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Fit Badge ─────────────────────────────────────────────────────────────────
function FitBadge({ score, badge }: { score?: number; badge?: string }) {
  if (!score) return null;
  const color = score >= 85 ? "#10b981" : score >= 70 ? "#3b82f6" : score >= 55 ? "#f59e0b" : "#6b7280";
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {score}% {badge}
    </span>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { authHeader } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  const [health, setHealth] = useState<HealthData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [todos, setTodos] = useState<CampaignTodo[]>([]);
  const [doneTodos, setDoneTodos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const profileKey = useMemo(() => {
    if (!profile) return "no-profile";
    return JSON.stringify({
      name: profile.name,
      role: profile.currentRole,
      exp: profile.experienceYears,
      location: profile.currentLocation,
      preferred: profile.preferredLocations,
      workMode: profile.workMode,
      skills: profileSkills(profile),
      certs: profile.certifications,
      resume: Boolean(profile.resumeText),
    });
  }, [profile]);

  const localHealth = useMemo(() => buildLocalHealth(profile), [profileKey, profile]);
  const fallbackTodos = useMemo(() => buildProfileTodos(profile), [profileKey, profile]);
  const fallbackPaths = useMemo(() => buildProfilePaths(profile), [profileKey, profile]);

  const load = useCallback(async () => {
    setLoading(true);
    const h = authHeader();
    try {
      const [healthRes, funnelRes, jobsRes, pathsRes, todosRes] = await Promise.allSettled([
        fetch(`${API}/api/career-graph/`, { headers: h }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/api/insights/funnel`, { headers: h }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/api/jobs/?limit=5`, { headers: h }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/api/learning/paths`, { headers: h }).then(r => r.ok ? r.json() : null),
        fetch(`${API}/api/campaign/daily-todos`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: "{}" }).then(r => r.ok ? r.json() : null),
      ]);

      if (healthRes.status === "fulfilled" && healthRes.value) setHealth(healthRes.value);
      if (funnelRes.status === "fulfilled" && funnelRes.value) setFunnel(funnelRes.value);
      if (jobsRes.status === "fulfilled" && jobsRes.value) setJobs((jobsRes.value.jobs || jobsRes.value || []).slice(0, 5));
      if (pathsRes.status === "fulfilled" && pathsRes.value) setPaths((pathsRes.value || []).filter((p: LearningPath) => p.status === "active").slice(0, 3));
      if (todosRes.status === "fulfilled" && todosRes.value?.todos) setTodos(todosRes.value.todos.slice(0, 3));
    } catch { /* graceful degradation */ }
    setLoading(false);
  }, [authHeader]);

  useEffect(() => {
    if (!profileLoading) void load();
  }, [load, profileLoading, profileKey]);

  const displayHealth = localHealth ?? health;
  const displayTodos = todos.length > 0 ? todos : fallbackTodos;
  const displayPaths = [
    ...fallbackPaths,
    ...paths.filter((path) => !fallbackPaths.some((fallback) => fallback.skill_name.toLowerCase() === path.skill_name.toLowerCase())),
  ].slice(0, 3);
  const healthScore = displayHealth?.health_score ?? 0;
  const topInsight = displayHealth?.insights?.[0];

  // Funnel pipeline stages
  const stages = funnel?.stages ?? [];
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  // Market pulse mock (replace with real data when market radar endpoint ready)
  const pulse = [
    { label: "AI/ML roles", trend: "+18%", hot: true },
    { label: "Rust engineers", trend: "+12%", hot: true },
    { label: "Java legacy", trend: "-5%", hot: false },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Career Command Center</h1>
            <p className="text-sm text-slate-400 mt-0.5">Your AI-powered career operating system</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--accent-bright)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Career Health" value={`${healthScore}%`}
            sub={healthScore >= 70 ? "On track" : "Needs attention"}
            icon={Activity} accent />
          <StatCard label="Applications" value={funnel?.total ?? "–"}
            sub={`${funnel?.last_30_days ?? 0} this month`} icon={Briefcase} />
          <StatCard label="Response Rate" value={funnel ? `${funnel.response_rate}%` : "–"}
            sub="Replies received" icon={Users} />
          <StatCard label="Active Paths" value={displayPaths.length}
            sub={paths.length > 0 ? "Learning in progress" : "From profile skills"} icon={BookOpen} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Health Ring + Today's Actions */}
          <div className="space-y-6">
            {/* Health Score Card */}
            <div className="rounded-2xl p-6"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Career Health</h2>
                <Link href="/career-graph" className="text-xs flex items-center gap-1"
                  style={{ color: "var(--accent-bright)" }}>
                  Details <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <ScoreRing score={healthScore} size={100} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-white">{healthScore}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {Object.entries(displayHealth?.breakdown ?? {}).slice(0, 4).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>{val.label ?? key}</span>
                        <span>{val.score}</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: "var(--border)" }}>
                        <div className="h-1 rounded-full transition-all"
                          style={{ width: `${val.score}%`, background: "var(--accent)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {topInsight && (
                <div className="mt-4 rounded-xl p-3 text-xs"
                  style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent-bright)" }}>
                  <Zap className="w-3 h-3 inline mr-1" />
                  {topInsight.suggestion}
                </div>
              )}
            </div>

            {/* Today's 3 Actions */}
            <div className="rounded-2xl p-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Today&apos;s Actions</h2>
                <Link href="/campaign" className="text-xs flex items-center gap-1"
                  style={{ color: "var(--accent-bright)" }}>
                  Full plan <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {displayTodos.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-500">No tasks yet</p>
                  <Link href="/campaign" className="mt-2 inline-block text-xs"
                    style={{ color: "var(--accent-bright)" }}>
                    Generate today&apos;s plan →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayTodos.map((todo) => {
                    const done = doneTodos.has(todo.id);
                    return (
                      <button key={todo.id}
                        onClick={() => setDoneTodos(prev => {
                          const n = new Set(prev);
                          if (done) { n.delete(todo.id); } else { n.add(todo.id); }
                          return n;
                        })}
                        className="w-full flex items-start gap-3 text-left group">
                        {done
                          ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent-bright)" }} />
                          : <Circle className="w-4 h-4 mt-0.5 shrink-0 text-slate-600 group-hover:text-slate-400" />
                        }
                        <span className={`text-xs leading-relaxed ${done ? "line-through text-slate-500" : "text-slate-300"}`}>
                          {todo.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Market Pulse */}
            <div className="rounded-2xl p-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Market Pulse</h2>
                <Link href="/market-radar" className="text-xs flex items-center gap-1"
                  style={{ color: "var(--accent-bright)" }}>
                  Full radar <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {pulse.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="font-semibold"
                      style={{ color: item.hot ? "#10b981" : "#ef4444" }}>
                      <TrendingUp className={`w-3 h-3 inline mr-0.5 ${!item.hot ? "rotate-180" : ""}`} />
                      {item.trend}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Centre: Pipeline Funnel */}
          <div className="rounded-2xl p-6"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white">Application Pipeline</h2>
              <Link href="/applications" className="text-xs flex items-center gap-1"
                style={{ color: "var(--accent-bright)" }}>
                Full pipeline <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {stages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Briefcase className="w-10 h-10 text-slate-600" />
                <p className="text-xs text-slate-500 text-center">No applications yet.<br />Start tracking your pipeline.</p>
                <Link href="/jobs" className="px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: "var(--accent)", color: "white" }}>
                  Find Jobs
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stages.map((s, i) => (
                  <div key={s.stage}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 capitalize">{s.stage.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-white">{s.count}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div className="h-2 rounded-full transition-all"
                        style={{
                          width: `${(s.count / maxCount) * 100}%`,
                          background: `hsl(${240 - i * 30}, 70%, 60%)`,
                        }} />
                    </div>
                  </div>
                ))}
                <div className="pt-3 mt-3 grid grid-cols-2 gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{funnel?.response_rate ?? 0}%</p>
                    <p className="text-[10px] text-slate-400">Response Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{funnel?.offer_rate ?? 0}%</p>
                    <p className="text-[10px] text-slate-400">Offer Rate</p>
                  </div>
                </div>
              </div>
            )}

            {/* Learning Strip */}
            <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Learning Progress</h3>
                <Link href="/learn" className="text-xs flex items-center gap-1"
                  style={{ color: "var(--accent-bright)" }}>
                  All paths <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {displayPaths.length === 0 ? (
                <p className="text-xs text-slate-500">No active paths. <Link href="/learn" style={{ color: "var(--accent-bright)" }}>Start learning →</Link></p>
              ) : (
                <div className="space-y-3">
                  {displayPaths.map((p) => (
                    <div key={p.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300 truncate max-w-[60%]">{p.skill_name}</span>
                        <span style={{ color: "var(--accent-bright)" }}>{p.progress_pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                        <div className="h-1.5 rounded-full transition-all"
                          style={{ width: `${p.progress_pct}%`, background: "var(--accent)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Top Job Matches */}
          <div className="rounded-2xl p-6"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white">Top Job Matches</h2>
              <Link href="/jobs" className="text-xs flex items-center gap-1"
                style={{ color: "var(--accent-bright)" }}>
                All jobs <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Target className="w-10 h-10 text-slate-600" />
                <p className="text-xs text-slate-500 text-center">No matches loaded.<br />Complete your profile for better fits.</p>
                <Link href="/profile" className="px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: "var(--accent)", color: "white" }}>
                  Build Profile
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-xl p-3 transition-colors cursor-pointer"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{job.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">{job.organization}</p>
                      </div>
                      <FitBadge score={job.fitScore} badge={job.fitBadge} />
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {job.location && (
                        <span className="text-[10px] text-slate-500">{job.location}</span>
                      )}
                      {job.work_mode && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: "var(--border)", color: "var(--accent-bright)" }}>
                          {job.work_mode}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <Link href="/jobs"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-medium mt-2 transition-all"
                  style={{ border: "1px solid var(--border)", color: "var(--accent-bright)" }}>
                  View all matches <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Quick Actions */}
            <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold text-white mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: "/interview", label: "Practice Interview", icon: Award },
                  { href: "/intelligence", label: "Intel Tools", icon: Zap },
                  { href: "/market-radar", label: "Market Radar", icon: BarChart3 },
                  { href: "/insights", label: "Analytics", icon: Activity },
                ].map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      color: "#94a3b8",
                    }}>
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-bright)" }} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

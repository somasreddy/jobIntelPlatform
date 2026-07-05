"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Circle,
  FileText,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/lib/ProfileContext";
import { CandidateProfile } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    { dimension: "skills", score: skillScore, suggestion: "Add role-specific skills from your target job descriptions.", potential_gain: Math.max(0, 100 - skillScore) },
    { dimension: "experience", score: expScore, suggestion: "Add recent achievements with numbers and outcomes.", potential_gain: Math.max(0, 100 - expScore) },
    { dimension: "profile", score: profileScore, suggestion: "Complete role, location, salary, work mode, and resume text.", potential_gain: Math.max(0, 100 - profileScore) },
    { dimension: "ai_tools", score: aiScore, suggestion: "Add AI tools you actively use in delivery work.", potential_gain: Math.max(0, 100 - aiScore) },
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
    { id: "profile-search-jobs", text: `Find fresh ${role} openings in ${location}`, priority: "high", category: "jobs" },
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

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 75 ? "var(--accent-bright)" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.7s ease" }}
      />
    </svg>
  );
}

function MetricTile({ label, value, sub, icon: Icon, accent = false }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg p-4 flex items-center gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: accent ? "linear-gradient(135deg, var(--accent-deep), var(--accent))" : "var(--bg-elevated)" }}
      >
        <Icon className="w-4 h-4" style={{ color: accent ? "white" : "var(--accent-bright)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-white leading-tight">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--accent-bright)" }}>{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, actionHref, actionLabel }: { title: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="text-xs inline-flex items-center gap-1" style={{ color: "var(--accent-bright)" }}>
          {actionLabel} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function FitBadge({ score, badge }: { score?: number; badge?: string }) {
  if (!score) return null;
  const color = score >= 85 ? "#10b981" : score >= 70 ? "#3b82f6" : score >= 55 ? "#f59e0b" : "#6b7280";
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {score}% {badge}
    </span>
  );
}

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
        fetch(`${API}/api/career-graph/`, { headers: h }).then((r) => r.ok ? r.json() : null),
        fetch(`${API}/api/insights/funnel`, { headers: h }).then((r) => r.ok ? r.json() : null),
        fetch(`${API}/api/jobs/?limit=5`, { headers: h }).then((r) => r.ok ? r.json() : null),
        fetch(`${API}/api/learning/paths`, { headers: h }).then((r) => r.ok ? r.json() : null),
        fetch(`${API}/api/campaign/daily-todos`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: "{}" }).then((r) => r.ok ? r.json() : null),
      ]);

      if (healthRes.status === "fulfilled" && healthRes.value) setHealth(healthRes.value);
      if (funnelRes.status === "fulfilled" && funnelRes.value) setFunnel(funnelRes.value);
      if (jobsRes.status === "fulfilled" && jobsRes.value) setJobs((jobsRes.value.jobs || jobsRes.value || []).slice(0, 5));
      if (pathsRes.status === "fulfilled" && pathsRes.value) setPaths((pathsRes.value || []).filter((p: LearningPath) => p.status === "active").slice(0, 3));
      if (todosRes.status === "fulfilled" && todosRes.value?.todos) setTodos(todosRes.value.todos.slice(0, 3));
    } catch {
      // graceful degradation
    }
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
  const stages = funnel?.stages ?? [];
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const profileReady = Boolean(profile?.name && profile?.currentRole);
  const role = profile?.currentRole || "your target role";
  const location = profile?.preferredLocations?.[0] || profile?.currentLocation || "your target market";

  const primaryActions = profileReady
    ? [
        { href: "/jobs", title: "Find matched jobs", body: `Search live openings for ${role} in ${location}.`, icon: Search, accent: true },
        { href: "/profile?tab=match", title: "Tailor resume", body: "Paste a JD and generate a focused ATS resume.", icon: FileText },
        { href: "/interview", title: "Practice interview", body: "Generate questions from your role and skills.", icon: Award },
      ]
    : [
        { href: "/profile", title: "Complete profile", body: "Add role, experience, location, and skills first.", icon: Target, accent: true },
        { href: "/profile?tab=resume", title: "Add resume", body: "Upload or paste your master resume.", icon: FileText },
        { href: "/jobs", title: "Browse jobs", body: "You can still search manually while setup continues.", icon: Search },
      ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--accent-bright)" }}>Command Center</p>
            <h1 className="text-2xl font-bold text-white mt-1">What to do next</h1>
            <p className="text-sm text-slate-400 mt-1">
              {profileReady ? `${role} - ${profile?.experienceYears || 0} yrs - ${location}` : "Set up your profile once. The rest of the platform follows it."}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-all md:self-start"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--accent-bright)" }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex flex-col lg:flex-row gap-5">
            <div className="lg:w-72 flex items-center gap-4">
              <div className="relative shrink-0">
                <ScoreRing score={healthScore} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">{healthScore}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Career readiness</p>
                <p className="text-xs text-slate-400 mt-1">{topInsight?.suggestion || "Complete your profile to unlock guidance."}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
              {primaryActions.map(({ href, title, body, icon: Icon, accent }) => (
                <Link
                  key={title}
                  href={href}
                  className="rounded-lg p-4 group transition-all"
                  style={{
                    background: accent ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--bg-elevated)",
                    border: accent ? "1px solid var(--border-hover)" : "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <Icon className="w-5 h-5" style={{ color: "var(--accent-bright)" }} />
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricTile label="Applications" value={funnel?.total ?? 0} sub={`${funnel?.last_30_days ?? 0} this month`} icon={Briefcase} />
          <MetricTile label="Response Rate" value={funnel ? `${funnel.response_rate}%` : "0%"} sub="Replies received" icon={Users} />
          <MetricTile label="Learning Focus" value={displayPaths.length} sub={displayPaths[0]?.skill_name || "From profile skills"} icon={BookOpen} />
          <MetricTile label="Profile Fit" value={`${healthScore}%`} sub={healthScore >= 70 ? "Ready to apply" : "Improve before applying"} icon={Activity} accent />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
          <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <SectionHeader title="Today" actionHref="/campaign" actionLabel="Open plan" />
            {displayTodos.length === 0 ? (
              <div className="rounded-lg p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-medium text-white">Start with profile setup</p>
                <p className="text-xs text-slate-400 mt-1">Once role and skills are saved, this area becomes your daily action list.</p>
                <Link href="/profile" className="btn-primary inline-flex items-center gap-2 text-sm mt-4">
                  Complete profile <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {displayTodos.map((todo) => {
                  const done = doneTodos.has(todo.id);
                  return (
                    <button
                      key={todo.id}
                      onClick={() => setDoneTodos((prev) => {
                        const next = new Set(prev);
                        if (done) next.delete(todo.id); else next.add(todo.id);
                        return next;
                      })}
                      className="w-full rounded-lg p-3 flex items-start gap-3 text-left transition-colors"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                    >
                      {done ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent-bright)" }} /> : <Circle className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />}
                      <span className={`text-sm leading-relaxed ${done ? "line-through text-slate-500" : "text-slate-200"}`}>{todo.text}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <SectionHeader title="Learning focus" actionHref="/learn" actionLabel="Open learning" />
            {displayPaths.length === 0 ? (
              <p className="text-sm text-slate-400">Add skills in your profile to get focused learning suggestions.</p>
            ) : (
              <div className="space-y-3">
                {displayPaths.map((path) => (
                  <div key={path.id} className="rounded-lg p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-sm font-medium text-white truncate">{path.skill_name}</p>
                      <span className="text-xs" style={{ color: "var(--accent-bright)" }}>{path.progress_pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${path.progress_pct}%`, background: "var(--accent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
          <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <SectionHeader title="Job matches" actionHref="/jobs" actionLabel="Search jobs" />
            {jobs.length === 0 ? (
              <div className="rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <div>
                  <p className="text-sm font-medium text-white">No matched jobs loaded yet</p>
                  <p className="text-xs text-slate-400 mt-1">Use the dork job search to bring fresh openings into this dashboard.</p>
                </div>
                <Link href="/jobs" className="btn-primary inline-flex items-center justify-center gap-2 text-sm">
                  Find jobs <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <Link key={job.id} href="/jobs" className="rounded-lg p-3 flex items-start justify-between gap-3 transition-colors" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{job.title}</p>
                      <p className="text-xs text-slate-400 truncate">{job.organization}{job.location ? ` - ${job.location}` : ""}</p>
                    </div>
                    <FitBadge score={job.fitScore} badge={job.fitBadge} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <SectionHeader title="Pipeline" actionHref="/applications" actionLabel="Open pipeline" />
            {stages.length === 0 ? (
              <div className="rounded-lg p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-medium text-white">No applications tracked</p>
                <p className="text-xs text-slate-400 mt-1">After applying, track status here so follow-ups do not slip.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 capitalize">{stage.stage.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-white">{stage.count}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div className="h-2 rounded-full" style={{ width: `${(stage.count / maxCount) * 100}%`, background: `hsl(${42 + index * 35}, 82%, 55%)` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <SectionHeader title="Useful tools" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/interview", label: "Interview prep", icon: Award },
              { href: "/intelligence", label: "Job intelligence", icon: Zap },
              { href: "/market-radar", label: "Market radar", icon: BarChart3 },
              { href: "/insights", label: "Analytics", icon: TrendingUp },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="rounded-lg p-3 flex items-center gap-2 text-sm font-medium" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "#cbd5e1" }}>
                <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--accent-bright)" }} />
                {label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

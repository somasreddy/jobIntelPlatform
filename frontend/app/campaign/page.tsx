"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/AppDataContext";
import { useProfile } from "@/lib/ProfileContext";
import {
  Target, Flame, CheckCircle2, Circle, ArrowRight,
  Briefcase, MessageSquare, FileText, BookOpen,
  TrendingUp, Trophy, Clock, Plus, Zap, ChevronRight,
  Calendar, MapPin, DollarSign, AlertCircle, RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Todo {
  task: string;
  type: "apply" | "evaluate" | "outreach" | "prep" | "admin";
  priority: "high" | "medium" | "low";
  time_minutes: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  apply:         { icon: Briefcase,   color: "text-indigo-400",  label: "Apply"    },
  evaluate:      { icon: Zap,         color: "text-cyan-400",    label: "Evaluate" },
  outreach:      { icon: MessageSquare, color: "text-violet-400", label: "Outreach" },
  prep:          { icon: BookOpen,    color: "text-amber-400",   label: "Prep"     },
  admin:         { icon: FileText,    color: "text-slate-400",   label: "Admin"    },
};

const PRIORITY_DOT: Record<string, string> = {
  high:   "bg-rose-500",
  medium: "bg-amber-500",
  low:    "bg-slate-500",
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-10 text-right">{value}/{max}</span>
    </div>
  );
}

// ── Setup Wizard ──────────────────────────────────────────────────────────────
function CampaignSetup({ onCreated }: { onCreated: () => void }) {
  const { profile } = useProfile();
  const [form, setForm] = useState({
    name: "My Job Search",
    target_role: "",
    target_salary_min: "",
    target_salary_max: "",
    target_currency: "USD",
    target_location: "",
    work_mode: "hybrid",
    deadline_date: "",
    daily_goal_apply: 3,
    daily_goal_evaluate: 5,
    daily_goal_outreach: 2,
  });
  const [loading, setLoading] = useState(false);

  // Pre-fill from profile once loaded
  useEffect(() => {
    if (!profile) return;
    setForm(f => ({
      ...f,
      target_role: f.target_role || profile.currentRole || "",
      target_location: f.target_location || profile.preferredLocations?.[0] || profile.currentLocation || "",
      target_currency: f.target_currency || profile.currency || "USD",
      work_mode: f.work_mode === "hybrid" && profile.workMode && profile.workMode !== "Any"
        ? profile.workMode.toLowerCase()
        : f.work_mode,
      target_salary_min: f.target_salary_min || (profile.currentSalary > 0 ? String(Math.round(profile.currentSalary * 1.1)) : ""),
    }));
  }, [profile]);

  const { authHeaders } = useAppData();
  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/campaign/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...form,
          target_salary_min: form.target_salary_min ? parseInt(form.target_salary_min) : undefined,
          target_salary_max: form.target_salary_max ? parseInt(form.target_salary_max) : undefined,
        }),
      });
      if (res.ok) onCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4 border border-white/10">
          <Target className="w-8 h-8 text-cyan-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Start Your Campaign</h1>
        <p className="text-slate-400">Set a goal. Track every action. Land the offer.</p>
      </div>

      <div className="glass-card p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Campaign Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Target Role</label>
            <input value={form.target_role} onChange={e => setForm(f => ({ ...f, target_role: e.target.value }))}
              placeholder="Senior AI Engineer" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Target Location</label>
            <input value={form.target_location} onChange={e => setForm(f => ({ ...f, target_location: e.target.value }))}
              placeholder="Remote / Berlin / New York" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Salary Min ({form.target_currency})</label>
            <input type="number" value={form.target_salary_min} onChange={e => setForm(f => ({ ...f, target_salary_min: e.target.value }))}
              placeholder="120000" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Salary Max ({form.target_currency})</label>
            <input type="number" value={form.target_salary_max} onChange={e => setForm(f => ({ ...f, target_salary_max: e.target.value }))}
              placeholder="180000" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Work Mode</label>
            <select value={form.work_mode} onChange={e => setForm(f => ({ ...f, work_mode: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50">
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Target Date</label>
            <input type="date" value={form.deadline_date} onChange={e => setForm(f => ({ ...f, deadline_date: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50" />
          </div>
        </div>

        <div className="border-t border-white/10 pt-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">Daily Goals</p>
          <div className="grid grid-cols-3 gap-3">
            {(["apply", "evaluate", "outreach"] as const).map(type => {
              const key = `daily_goal_${type}` as keyof typeof form;
              const meta = TYPE_META[type];
              return (
                <div key={type} className="bg-white/5 rounded-lg p-3">
                  <div className={`flex items-center gap-1.5 mb-2 ${meta.color}`}>
                    <meta.icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium capitalize">{type}</span>
                  </div>
                  <input type="number" min={1} max={20} value={form[key] as number}
                    onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-transparent text-white text-lg font-bold focus:outline-none" />
                  <p className="text-xs text-slate-500">per day</p>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={submit} disabled={loading}
          className="w-full bg-linear-to-r from-cyan-500 to-violet-500 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
          {loading ? "Creating..." : "Launch Campaign"}
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function CampaignPage() {
  const {
    campaign: campaignInfo, todayProgress, pipelineSummary,
    campaignLoading, refreshCampaign, logAction: ctxLogAction, authHeaders,
  } = useAppData();

  const [todos, setTodos] = useState<{ todos: Todo[]; motivation: string } | null>(null);
  const [completedTodos, setCompletedTodos] = useState<Set<number>>(new Set());
  const [todosLoading, setTodosLoading] = useState(false);

  const fetchTodos = useCallback(async (campaignId: string) => {
    setTodosLoading(true);
    try {
      const res = await fetch(`${API}/api/campaign/${campaignId}/daily-todos`, { headers: authHeaders() });
      if (res.ok) setTodos(await res.json());
    } catch {}
    finally { setTodosLoading(false); }
  }, [authHeaders]);

  useEffect(() => {
    if (campaignInfo?.id) fetchTodos(campaignInfo.id);
  }, [campaignInfo?.id, fetchTodos]);

  const logAction = async (type: string) => {
    await ctxLogAction(type as Parameters<typeof ctxLogAction>[0]);
    // re-fetch todos since pipeline state may have changed
  };

  if (campaignLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
      </main>
    );
  }

  if (!campaignInfo) {
    return <CampaignSetup onCreated={refreshCampaign} />;
  }

  const c = campaignInfo;
  const p = todayProgress ?? { applications_sent: 0, applications_goal: 0, evaluations_done: 0, evaluations_goal: 0, outreaches_sent: 0, outreaches_goal: 0 };
  const ps = pipelineSummary ?? { total_applications: 0, interviews: 0, offers: 0 };

  const totalGoal = p.applications_goal + p.evaluations_goal + p.outreaches_goal;
  const totalDone = p.applications_sent + p.evaluations_done + p.outreaches_sent;
  const dayPct = totalGoal > 0 ? Math.min(100, Math.round((totalDone / totalGoal) * 100)) : 0;

  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{c.name}</h1>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-400">
            {c.target_role && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{c.target_role}</span>}
            {c.target_location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{c.target_location}</span>}
            {c.target_salary && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{c.target_salary}</span>}
            {c.days_remaining !== null && (
              <span className={`flex items-center gap-1 ${c.days_remaining <= 7 ? "text-rose-400" : ""}`}>
                <Calendar className="w-3.5 h-3.5" />{c.days_remaining}d remaining
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="text-orange-300 font-bold text-lg">{c.current_streak}</span>
            <span className="text-orange-400/70 text-xs">day streak</span>
          </div>
          {c.longest_streak > c.current_streak && (
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 text-sm">Best: {c.longest_streak}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Today's progress + pipeline */}
        <div className="lg:col-span-1 space-y-5">
          {/* Today's goal ring */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Today&apos;s Progress</h3>
              <span className={`text-lg font-bold ${dayPct === 100 ? "text-emerald-400" : "text-cyan-400"}`}>
                {dayPct}%
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span className="flex items-center gap-1"><Briefcase className="w-3 h-3 text-indigo-400" />Applications</span>
                </div>
                <ProgressBar value={p.applications_sent} max={p.applications_goal} color="bg-indigo-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-cyan-400" />Evaluations</span>
                </div>
                <ProgressBar value={p.evaluations_done} max={p.evaluations_goal} color="bg-cyan-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-violet-400" />Outreach</span>
                </div>
                <ProgressBar value={p.outreaches_sent} max={p.outreaches_goal} color="bg-violet-500" />
              </div>
            </div>

            {/* Quick-log buttons */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["apply", "evaluate", "outreach"] as const).map(type => {
                const meta = TYPE_META[type];
                return (
                  <button key={type} onClick={() => logAction(type)}
                    className={`text-xs py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${meta.color} flex items-center justify-center gap-1`}>
                    <Plus className="w-3 h-3" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pipeline summary */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Pipeline Summary</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-white">{ps.total_applications}</p>
                <p className="text-xs text-slate-400">Applications</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">{ps.interviews}</p>
                <p className="text-xs text-slate-400">Interviews</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{ps.offers}</p>
                <p className="text-xs text-slate-400">Offers</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/applications" className="flex items-center justify-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded-lg py-2 transition-colors">
                <Briefcase className="w-3.5 h-3.5" />View Pipeline
              </Link>
              <Link href="/insights" className="flex items-center justify-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 rounded-lg py-2 transition-colors">
                <TrendingUp className="w-3.5 h-3.5" />Analytics
              </Link>
            </div>
          </div>

          {/* Quick links */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
            <div className="space-y-1.5">
              {[
                { href: "/jobs",         icon: Briefcase,     label: "Find new jobs",           color: "text-indigo-400" },
                { href: "/resume",       icon: FileText,      label: "Generate ATS resume",     color: "text-violet-400" },
                { href: "/interview",    icon: BookOpen,      label: "Practice interview",       color: "text-amber-400" },
                { href: "/power-tools",  icon: Zap,           label: "Power tools",             color: "text-cyan-400" },
                { href: "/intelligence", icon: TrendingUp,    label: "Market intelligence",     color: "text-emerald-400" },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-slate-300 hover:text-white group">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-sm flex-1">{label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Daily todos */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6 h-full">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-white">Today&apos;s Action Plan</h3>
                <p className="text-xs text-slate-500 mt-0.5">AI-generated based on your pipeline state</p>
              </div>
              <button onClick={() => c.id && fetchTodos(c.id)} disabled={todosLoading}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
                <RefreshCw className={`w-3.5 h-3.5 ${todosLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {todosLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Generating your personalized plan...</p>
                </div>
              </div>
            ) : todos ? (
              <>
                {todos.motivation && (
                  <div className="mb-5 p-3 bg-linear-to-r from-cyan-500/10 to-violet-500/10 border border-white/10 rounded-lg">
                    <p className="text-sm text-slate-300 italic">&ldquo;{todos.motivation}&rdquo;</p>
                  </div>
                )}
                <div className="space-y-3">
                  {todos.todos.map((todo, i) => {
                    const meta   = TYPE_META[todo.type] || TYPE_META.admin;
                    const done   = completedTodos.has(i);
                    const Icon   = meta.icon;
                    return (
                      <div key={i}
                        onClick={() => {
                          setCompletedTodos(prev => {
                            const next = new Set(prev);
                            if (done) next.delete(i); else { next.add(i); logAction(todo.type); }
                            return next;
                          });
                        }}
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          done
                            ? "bg-white/3 border-white/5 opacity-50"
                            : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20"
                        }`}>
                        <div className="mt-0.5">
                          {done
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            : <Circle className="w-5 h-5 text-slate-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${done ? "line-through text-slate-500" : "text-slate-200"}`}>
                            {todo.task}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className={`flex items-center gap-1 text-xs ${meta.color}`}>
                              <Icon className="w-3 h-3" />
                              {meta.label}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              {todo.time_minutes}m
                            </span>
                            <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[todo.priority]}`} />
                          </div>
                        </div>
                        {!done && (
                          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {completedTodos.size}/{todos.todos.length} tasks completed
                  </span>
                  {completedTodos.size === todos.todos.length && todos.todos.length > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <Trophy className="w-3.5 h-3.5" />Daily goal achieved!
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <AlertCircle className="w-8 h-8 text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">Could not load daily plan</p>
                <button onClick={() => c.id && fetchTodos(c.id)}
                  className="mt-3 text-xs text-cyan-400 hover:text-cyan-300">
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

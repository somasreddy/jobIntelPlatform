"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useAppData } from "@/lib/AppDataContext";
import { useProfile } from "@/lib/ProfileContext";
import {
  Target, Flame, CheckCircle2, Circle, ArrowRight,
  Briefcase, MessageSquare, FileText, BookOpen,
  TrendingUp, Trophy, Clock, Plus, Zap, ChevronRight,
  Calendar, MapPin, DollarSign, AlertCircle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { durations, easings } from "@/lib/motion-tokens";

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

// ── Motion variants — shared stagger/reveal choreography for list-like groups ──
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const fadeUpItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: durations.base, ease: easings.outQuint } },
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className={`h-full ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: durations.slow, ease: easings.outQuint }}
        />
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
  const [error, setError] = useState<string | null>(null);

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

  const saveLocally = () => {
    const c = {
      id: `local-${Date.now()}`,
      name: form.name,
      target_role: form.target_role || null,
      target_salary: form.target_salary_min
        ? `${form.target_currency} ${parseInt(form.target_salary_min).toLocaleString()}${form.target_salary_max ? `–${parseInt(form.target_salary_max).toLocaleString()}` : "+"}`
        : null,
      target_location: form.target_location || null,
      work_mode: form.work_mode,
      days_remaining: form.deadline_date
        ? Math.max(0, Math.round((new Date(form.deadline_date).getTime() - Date.now()) / 86400000))
        : null,
      current_streak: 0,
      longest_streak: 0,
    };
    const data = {
      campaign: c,
      today_progress: {
        applications_sent: 0, applications_goal: form.daily_goal_apply,
        evaluations_done: 0,  evaluations_goal: form.daily_goal_evaluate,
        outreaches_sent: 0,   outreaches_goal: form.daily_goal_outreach,
      },
      pipeline_summary: { total_applications: 0, interviews: 0, offers: 0 },
    };
    localStorage.setItem("ji_campaign", JSON.stringify(data));
  };

  const submit = async () => {
    if (!form.target_role.trim()) { setError("Please enter a target role."); return; }
    setLoading(true);
    setError(null);
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
      if (res.ok) {
        onCreated();
        return;
      }
      // Backend error (e.g. no DB) — fall back to localStorage so it still works
      if (res.status >= 500) {
        saveLocally();
        onCreated();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.detail ?? `Server error (${res.status})`);
    } catch {
      // Network unreachable — save locally so the campaign still works
      saveLocally();
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { icon: Target,      color: "text-cyan-400",   bg: "bg-cyan-500/10",   title: "1. Set Your Goal",    desc: "Define target role, salary, location and deadline" },
    { icon: CheckCircle2,color: "text-violet-400", bg: "bg-violet-500/10", title: "2. Track Daily",      desc: "Log applications, outreach & evaluations every day" },
    { icon: Trophy,      color: "text-amber-400",  bg: "bg-amber-500/10",  title: "3. Build Momentum",  desc: "Maintain your streak — the AI generates your daily plan" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: durations.base, ease: easings.outQuint }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4 border border-white/10">
          <Target className="w-8 h-8 text-cyan-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Start Your Campaign</h1>
        <p className="text-slate-400">Set a goal. Track every action. Land the offer.</p>
      </motion.div>

      {/* How it works */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-3 mb-8"
      >
        {steps.map(({ icon: Icon, color, bg, title, desc }) => (
          <motion.div key={title} variants={fadeUpItem}>
            <Card className="gap-0 border-white/8 p-3 text-center backdrop-blur-xl">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-xs font-semibold ${color} mb-1`}>{title}</p>
              <p className="text-xs text-slate-500 leading-snug">{desc}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: durations.slow, ease: easings.outQuint, delay: 0.12 }}
      >
        <Card className="gap-0 space-y-5 p-8 backdrop-blur-xl">
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
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-3 gap-3">
              {(["apply", "evaluate", "outreach"] as const).map(type => {
                const key = `daily_goal_${type}` as keyof typeof form;
                const meta = TYPE_META[type];
                return (
                  <motion.div key={type} variants={fadeUpItem} className="bg-white/5 rounded-lg p-3">
                    <div className={`flex items-center gap-1.5 mb-2 ${meta.color}`}>
                      <meta.icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium capitalize">{type}</span>
                    </div>
                    <input type="number" min={1} max={20} value={form[key] as number}
                      onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-transparent text-white text-lg font-bold focus:outline-none" />
                    <p className="text-xs text-slate-500">per day</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: durations.fast, ease: easings.smooth }}
                className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 overflow-hidden"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div whileHover={{ scale: loading ? 1 : 1.01 }} whileTap={{ scale: loading ? 1 : 0.98 }}>
            <Button
              onClick={submit}
              disabled={loading}
              className="w-full h-auto bg-linear-to-r from-cyan-500 to-violet-500 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              {loading ? "Creating..." : "Launch Campaign"}
            </Button>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}

// ── Loading skeleton for the dashboard (campaign context still resolving) ──────
function CampaignDashboardSkeleton() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-5">
          {[0, 1, 2].map(i => (
            <Card key={i} className="gap-4 py-5 backdrop-blur-xl">
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="lg:col-span-2">
          <Card className="h-full gap-4 py-6 backdrop-blur-xl">
            <CardContent className="space-y-3">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-16 w-full rounded-lg" />
              {[0, 1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function CampaignDashboard() {
  const {
    campaign: campaignInfo, todayProgress, pipelineSummary,
    campaignLoading, refreshCampaign, logAction: ctxLogAction, authHeaders,
  } = useAppData();

  const [todos, setTodos] = useState<{ todos: Todo[]; motivation: string } | null>(null);
  const [completedTodos, setCompletedTodos] = useState<Set<number>>(new Set());
  const [todosLoading, setTodosLoading] = useState(false);

  const defaultTodos = useCallback((c: typeof campaignInfo) => ({
    motivation: "Consistency beats intensity — even 2 focused hours a day compounds into results.",
    todos: [
      { task: `Research 5 companies hiring for ${c?.target_role || "your target role"} and evaluate fit`, type: "evaluate" as const, priority: "high" as const, time_minutes: 30 },
      { task: `Apply to ${todayProgress?.applications_goal ?? 3} jobs that match your profile above 70%`, type: "apply" as const, priority: "high" as const, time_minutes: 45 },
      { task: `Send ${todayProgress?.outreaches_goal ?? 2} personalized LinkedIn messages to hiring managers`, type: "outreach" as const, priority: "medium" as const, time_minutes: 20 },
      { task: "Write or refine one STAR story for your most recent achievement", type: "prep" as const, priority: "medium" as const, time_minutes: 15 },
      { task: "Follow up on applications older than 7 days with no response", type: "admin" as const, priority: "low" as const, time_minutes: 10 },
    ],
  }), [todayProgress]);

  const fetchTodos = useCallback(async (campaignId: string) => {
    setTodosLoading(true);
    try {
      // Local campaigns can't call the API — show defaults immediately
      if (campaignId.startsWith("local-")) {
        setTodos(defaultTodos(campaignInfo));
        return;
      }
      const res = await fetch(`${API}/api/campaign/${campaignId}/daily-todos`, { headers: authHeaders() });
      if (res.ok) {
        setTodos(await res.json());
      } else {
        setTodos(defaultTodos(campaignInfo));
      }
    } catch {
      setTodos(defaultTodos(campaignInfo));
    } finally {
      setTodosLoading(false);
    }
  }, [authHeaders, defaultTodos, campaignInfo]);

  useEffect(() => {
    if (campaignInfo?.id) fetchTodos(campaignInfo.id);
  }, [campaignInfo?.id, fetchTodos]);

  const logAction = async (type: string) => {
    await ctxLogAction(type as Parameters<typeof ctxLogAction>[0]);
    // re-fetch todos since pipeline state may have changed
  };

  if (campaignLoading) {
    return <CampaignDashboardSkeleton />;
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

  const quickActions = [
    { href: "/jobs",         icon: Briefcase,     label: "Find new jobs",           color: "text-indigo-400" },
    { href: "/resume",       icon: FileText,      label: "Generate ATS resume",     color: "text-violet-400" },
    { href: "/interview",    icon: BookOpen,      label: "Practice interview",       color: "text-amber-400" },
    { href: "/power-tools",  icon: Zap,           label: "Power tools",             color: "text-cyan-400" },
    { href: "/intelligence", icon: TrendingUp,    label: "Market intelligence",     color: "text-emerald-400" },
  ];

  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: durations.base, ease: easings.outQuint }}
        className="flex items-start justify-between mb-8"
      >
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
          <Badge className="gap-1.5 rounded-xl border-orange-500/20 bg-orange-500/10 px-4 py-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="text-orange-300 font-bold text-lg">{c.current_streak}</span>
            <span className="text-orange-400/70 text-xs font-normal">day streak</span>
          </Badge>
          {c.longest_streak > c.current_streak && (
            <Badge variant="outline" className="gap-1.5 rounded-xl border-white/10 bg-white/5 px-3 py-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 text-sm font-normal">Best: {c.longest_streak}</span>
            </Badge>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }} className="inline-block">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Reset your campaign and start a new one?")) {
                      localStorage.removeItem("ji_campaign");
                      refreshCampaign();
                    }
                  }}
                  className="h-auto text-xs text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded-lg"
                >
                  Reset
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>Clear this campaign and start a new one</TooltipContent>
          </Tooltip>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Today's progress + pipeline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.slow, ease: easings.outQuint }}
          className="lg:col-span-1 space-y-5"
        >
          {/* Today's goal ring */}
          <Card className="gap-4 py-5 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between px-5">
              <CardTitle className="text-sm font-semibold text-white">Today&apos;s Progress</CardTitle>
              <span className={`text-lg font-bold ${dayPct === 100 ? "text-emerald-400" : "text-cyan-400"}`}>
                {dayPct}%
              </span>
            </CardHeader>
            <CardContent className="px-5 space-y-3">
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

              {/* Quick-log buttons */}
              <motion.div variants={staggerContainer} initial="hidden" animate="show" className="!mt-4 grid grid-cols-3 gap-2">
                {(["apply", "evaluate", "outreach"] as const).map(type => {
                  const meta = TYPE_META[type];
                  return (
                    <motion.div key={type} variants={fadeUpItem} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}>
                      <Button
                        variant="ghost"
                        onClick={() => logAction(type)}
                        className={`w-full h-auto text-xs py-1.5 rounded-lg bg-white/5 hover:bg-white/10 ${meta.color} flex items-center justify-center gap-1`}
                      >
                        <Plus className="w-3 h-3" />
                        {meta.label}
                      </Button>
                    </motion.div>
                  );
                })}
              </motion.div>
            </CardContent>
          </Card>

          {/* Pipeline summary */}
          <Card className="gap-4 py-5 backdrop-blur-xl">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-semibold text-white">Pipeline Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
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
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Button asChild variant="ghost" className="w-full h-auto text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 rounded-lg py-2">
                    <Link href="/applications" className="flex items-center justify-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" />View Pipeline
                    </Link>
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Button asChild variant="ghost" className="w-full h-auto text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/15 rounded-lg py-2">
                    <Link href="/insights" className="flex items-center justify-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />Analytics
                    </Link>
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card className="gap-3 py-5 backdrop-blur-xl">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-semibold text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-1.5">
                {quickActions.map(({ href, icon: Icon, label, color }) => (
                  <motion.div key={href} variants={fadeUpItem} whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}>
                    <Link href={href}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-slate-300 hover:text-white group">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-sm flex-1">{label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right — Daily todos */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.slow, ease: easings.outQuint, delay: 0.08 }}
          className="lg:col-span-2"
        >
          <Card className="h-full gap-4 py-6 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between px-6">
              <div>
                <CardTitle className="text-base font-semibold text-white">Today&apos;s Action Plan</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">AI-generated based on your pipeline state</p>
              </div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => c.id && fetchTodos(c.id)}
                  disabled={todosLoading}
                  className="h-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${todosLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </motion.div>
            </CardHeader>

            <CardContent className="px-6">
              {todosLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  {[0, 1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                  <p className="text-xs text-slate-500 text-center pt-1">Generating your personalized plan…</p>
                </div>
              ) : todos ? (
                <>
                  {todos.motivation && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: durations.base, ease: easings.smooth }}
                      className="mb-5 p-3 bg-linear-to-r from-cyan-500/10 to-violet-500/10 border border-white/10 rounded-lg"
                    >
                      <p className="text-sm text-slate-300 italic">&ldquo;{todos.motivation}&rdquo;</p>
                    </motion.div>
                  )}
                  <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
                    {todos.todos.map((todo, i) => {
                      const meta   = TYPE_META[todo.type] || TYPE_META.admin;
                      const done   = completedTodos.has(i);
                      const Icon   = meta.icon;
                      return (
                        <motion.div
                          key={i}
                          variants={fadeUpItem}
                          whileHover={{ y: done ? 0 : -1 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setCompletedTodos(prev => {
                              const next = new Set(prev);
                              if (done) next.delete(i); else { next.add(i); logAction(todo.type); }
                              return next;
                            });
                          }}
                          className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
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
                              <Badge variant="outline" className={`gap-1 border-current/20 bg-current/10 ${meta.color}`}>
                                <Icon className="w-3 h-3" />
                                {meta.label}
                              </Badge>
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
                        </motion.div>
                      );
                    })}
                  </motion.div>

                  <Separator className="mt-5" />
                  <CardFooter className="pt-4 px-0 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {completedTodos.size}/{todos.todos.length} tasks completed
                    </span>
                    <AnimatePresence>
                      {completedTodos.size === todos.todos.length && todos.todos.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: durations.fast, ease: easings.spring }}
                        >
                          <Badge className="gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                            <Trophy className="w-3.5 h-3.5" />Daily goal achieved!
                          </Badge>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardFooter>
                </>
              ) : (
                <EmptyState
                  icon={AlertCircle}
                  title="Could not load daily plan"
                  action={{ label: "Try again", onClick: () => c.id && fetchTodos(c.id) }}
                  bordered={false}
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}

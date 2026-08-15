"use client";
import { useState, useEffect, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  BookOpen, Plus, Trash2, CheckCircle2, Loader2,
  ArrowRight, Clock, ExternalLink, TrendingUp, Zap, AlertCircle,
  GraduationCap, PlayCircle, FileText, Wrench, Bookmark,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { durations, easings, motionTransition } from "@/lib/motion-tokens";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LearningPath {
  id: string;
  skill_name: string;
  current_level: number;
  target_level: number;
  estimated_hours: number | null;
  status: string;
  progress_pct: number;
  resources: Resource[];
}

interface Resource {
  title: string;
  provider: string;
  url: string;
  type: string;
  duration_minutes: number | null;
  difficulty: string | null;
  is_free: boolean;
  description?: string;
}

interface Completion {
  id: string;
  skill_name: string;
  path_id: string | null;
  resource_url: string | null;
  completed_at: string;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

const LEVEL_LABELS = ["None", "Beginner", "Novice", "Intermediate", "Advanced", "Expert"];

// Resource-type → icon, swapped from the old raw-emoji map onto the app's
// existing lucide-react icon language (matches the rest of the page/design system).
const RESOURCE_TYPE_ICONS: Record<string, LucideIcon> = {
  course: GraduationCap,
  video: PlayCircle,
  article: FileText,
  project: Wrench,
  book: BookOpen,
};

/**
 * Compact ring visualization of a path's real `progress_pct` (server-computed
 * from actual completion rows — see backend/api/learning.py `mark_complete`).
 * Purely a presentational read of that number; nothing here is invented.
 */
function ProgressRing({ value, size = 72, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth}
          className="fill-none"
          stroke="var(--bg-elevated)"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="fill-none"
          stroke="var(--accent)"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: durations.slower, ease: easings.outQuint }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

/** Skeleton placeholder matching the real layout — shown while the three
 *  learning-engine endpoints (paths/suggestions/completions) are in flight. */
function LearnSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-4">
        <Card className="card gap-3 p-4 shadow-none">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-9 rounded-lg" />
            <Skeleton className="h-9 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
        </Card>
        {[0, 1, 2].map((i) => (
          <Card key={i} className="card gap-2 p-4 shadow-none">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="lg:col-span-2">
        <Card className="card gap-4 p-6 shadow-none">
          <div className="flex items-center gap-4">
            <Skeleton className="h-[72px] w-[72px] rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Separator />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </Card>
      </div>
    </div>
  );
}

export default function LearnPageClient() {
  const { token } = useAuth();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newSkill, setNewSkill] = useState("");
  const [currentLevel, setCurrentLevel] = useState(0);
  const [targetLevel, setTargetLevel] = useState(3);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pathsRes, suggestionsRes, completionsRes] = await Promise.all([
        fetch(`${API}/api/learning/paths`, { headers: authHeaders(token) }),
        fetch(`${API}/api/learning/suggestions`, { headers: authHeaders(token) }),
        fetch(`${API}/api/learning/completions`, { headers: authHeaders(token) }),
      ]);
      if (pathsRes.ok) setPaths(await pathsRes.json());
      if (suggestionsRes.ok) {
        const s = await suggestionsRes.json();
        setSuggestions(s.suggestions || []);
      }
      if (completionsRes.ok) setCompletions(await completionsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generatePath = async (skill: string, cur = 0, tgt = 3) => {
    const skillName = skill.trim();
    if (!skillName || generating) return;

    const existing = paths.find((p) => p.skill_name.toLowerCase() === skillName.toLowerCase() && (p.resources?.length ?? 0) > 0);
    if (existing) {
      setSelectedPath(existing);
      setNewSkill("");
      setError(null);
      return;
    }

    setGenerating(skillName);
    setError(null);
    try {
      const res = await fetch(`${API}/api/learning/paths/generate`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ skill_name: skillName, current_level: cur, target_level: tgt }),
      });
      if (res.ok) {
        const path: LearningPath = await res.json();
        setPaths(prev => [path, ...prev.filter(p => p.id !== path.id)]);
        setSelectedPath(path);
        setNewSkill("");
        return;
      }

      let detail = "Learning path generation failed.";
      try {
        const body = await res.json();
        detail = body?.detail || detail;
      } catch {
        detail = await res.text() || detail;
      }
      setError(res.status === 429
        ? "The generator is temporarily rate limited. Existing paths still work; wait a minute or try another skill after the current request window resets."
        : detail);
    } catch (e) {
      console.error(e);
      setError("Could not reach the learning service. Please check the backend connection and try again.");
    } finally {
      setGenerating(null);
    }
  };

  const deletePath = async (id: string) => {
    await fetch(`${API}/api/learning/paths/${id}`, { method: "DELETE", headers: authHeaders(token) });
    setPaths(prev => prev.filter(p => p.id !== id));
    if (selectedPath?.id === id) setSelectedPath(null);
  };

  const markComplete = async (path: LearningPath, resource: Resource) => {
    await fetch(`${API}/api/learning/completions`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        path_id: path.id,
        resource_url: resource.url,
        skill_name: path.skill_name,
        rating_given: null,
        notes: null,
      }),
    });
    await fetchData();
    // Refresh selected path
    const updated = paths.find(p => p.id === path.id);
    if (updated) setSelectedPath(updated);
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-6xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6" style={{ color: "var(--accent)" }} />
            Learning Engine
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Close skill gaps with AI-curated learning paths</p>
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={motionTransition("base", "outQuint")}
              className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <LearnSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left — paths list + generator */}
            <div className="space-y-4">
              {/* Generator */}
              <Card className="card gap-3 p-4 shadow-none">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  Generate Path
                </h3>
                <input
                  className="input-field w-full"
                  placeholder="Skill name (e.g. Python)"
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newSkill.trim() && !generating && generatePath(newSkill.trim(), currentLevel, targetLevel)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Current level</label>
                    <select className="input-field w-full text-xs" value={currentLevel} onChange={e => setCurrentLevel(+e.target.value)}>
                      {[0,1,2,3,4].map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Target level</label>
                    <select className="input-field w-full text-xs" value={targetLevel} onChange={e => setTargetLevel(+e.target.value)}>
                      {[1,2,3,4,5].map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                    </select>
                  </div>
                </div>
                <Button
                  asChild
                  disabled={!newSkill.trim() || !!generating}
                  className="btn-primary w-full h-auto flex items-center justify-center gap-2 py-2 text-sm"
                >
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => newSkill.trim() && generatePath(newSkill.trim(), currentLevel, targetLevel)}
                  >
                    {generating === newSkill ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Generate
                  </motion.button>
                </Button>
              </Card>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <Card className="card gap-2 p-4 shadow-none">
                  <h3 className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Trending — gaps in your profile
                  </h3>
                  <div className="space-y-1.5">
                    {suggestions.map((s, i) => (
                      <motion.button
                        key={s}
                        type="button"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...motionTransition("base", "outQuint"), delay: i * 0.04 }}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => generatePath(s)}
                        disabled={!!generating}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-60"
                        style={{ background: "var(--bg-elevated)", color: "var(--accent-bright)" }}
                      >
                        <span>{s}</span>
                        {generating === s ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                      </motion.button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Paths list */}
              {paths.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No learning paths yet"
                  description="Generate one above for any skill you want to grow, or pick a trending suggestion."
                />
              ) : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {paths.map(p => {
                      const active = selectedPath?.id === p.id;
                      return (
                        <motion.div
                          key={p.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={motionTransition("base", "outQuint")}
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.99 }}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedPath(p)}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPath(p); } }}
                          className="w-full card p-4 text-left cursor-pointer"
                          style={active ? {
                            border: "1px solid var(--border-hover)",
                            boxShadow: "0 0 12px -4px var(--glow-accent)",
                          } : {}}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-white">{p.skill_name}</span>
                            <Badge className={`rounded-full border-none px-2 py-0.5 text-xs font-medium ${
                              p.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
                            }`}>{p.status}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Progress value={p.progress_pct} className="h-1.5 flex-1 bg-slate-700/70" />
                            <span className="text-xs text-slate-400">{p.progress_pct}%</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {LEVEL_LABELS[p.current_level]} → {LEVEL_LABELS[p.target_level]}
                            {p.estimated_hours ? ` · ~${p.estimated_hours}h` : ""}
                          </p>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Right — selected path resources */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait" initial={false}>
                {!selectedPath ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={motionTransition("base")}
                  >
                    <Card className="card p-8 flex items-center justify-center h-full min-h-[300px] shadow-none">
                      <EmptyState
                        icon={BookOpen}
                        title="No path selected"
                        description="Select a learning path on the left, or generate a new one above for a skill you want to grow."
                        bordered={false}
                        size="lg"
                      />
                    </Card>
                  </motion.div>
                ) : (
                  <motion.div
                    key={selectedPath.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={motionTransition("base", "outQuint")}
                  >
                    <Card className="card gap-5 p-6 shadow-none">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-white">{selectedPath.skill_name}</h2>
                          <p className="text-xs text-slate-400">
                            {LEVEL_LABELS[selectedPath.current_level]} → {LEVEL_LABELS[selectedPath.target_level]}
                            {selectedPath.estimated_hours ? ` · ~${selectedPath.estimated_hours}h total` : ""}
                          </p>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePath(selectedPath.id)}
                              className="h-8 w-8 text-slate-600 hover:text-rose-400 hover:bg-transparent"
                              aria-label="Delete learning path"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete path</TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Real progress visualization — ring + bar, both driven by
                          progress_pct (server-computed from actual completion rows) */}
                      {(() => {
                        const totalResources = selectedPath.resources?.length ?? 0;
                        const completedResources = (selectedPath.resources ?? []).filter(r =>
                          completions.some(c => c.path_id === selectedPath.id && c.resource_url === r.url)
                        ).length;
                        return (
                          <div className="flex items-center gap-4">
                            <ProgressRing value={selectedPath.progress_pct} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                <span>Progress</span>
                                <span>{completedResources} of {totalResources} resources completed</span>
                              </div>
                              <Progress value={selectedPath.progress_pct} className="h-2" />
                            </div>
                          </div>
                        );
                      })()}

                      <Separator />

                      {/* Resources */}
                      <div className="space-y-3">
                        {(selectedPath.resources || []).map((r, i) => {
                          const done = completions.some(c =>
                            c.path_id === selectedPath.id && c.resource_url === r.url
                          );
                          const TypeIcon = RESOURCE_TYPE_ICONS[r.type] || Bookmark;
                          return (
                            <motion.div
                              key={r.url || i}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ ...motionTransition("base", "outQuint"), delay: i * 0.03 }}
                              className="flex gap-3 p-3 rounded-xl"
                              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                              >
                                <TypeIcon className="w-4 h-4" style={{ color: "var(--accent-bright)" }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <motion.a
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ x: 2 }}
                                    whileTap={{ scale: 0.97 }}
                                    transition={motionTransition("fast")}
                                    className="text-sm font-medium text-white hover:underline flex items-center gap-1"
                                  >
                                    {r.title}
                                    <ExternalLink className="w-3 h-3 text-slate-500" />
                                  </motion.a>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.8 }}
                                        onClick={() => markComplete(selectedPath, r)}
                                        aria-label={done ? `${r.title} completed` : `Mark ${r.title} complete`}
                                        className={`shrink-0 transition-colors ${done ? "text-emerald-400" : "text-slate-600 hover:text-emerald-400"}`}
                                      >
                                        <AnimatePresence mode="wait" initial={false}>
                                          <motion.span
                                            key={done ? "done" : "todo"}
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.5, opacity: 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                            className="flex"
                                          >
                                            <CheckCircle2 className="w-4 h-4" />
                                          </motion.span>
                                        </AnimatePresence>
                                      </motion.button>
                                    </TooltipTrigger>
                                    <TooltipContent>{done ? "Completed" : "Mark complete"}</TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  {r.provider && <span className="text-xs text-slate-500">{r.provider}</span>}
                                  {r.difficulty && (
                                    <Badge className="rounded-full border-none bg-white/5 px-1.5 py-0.5 text-xs text-slate-400">{r.difficulty}</Badge>
                                  )}
                                  {r.duration_minutes && (
                                    <span className="text-xs text-slate-500 flex items-center gap-0.5">
                                      <Clock className="w-3 h-3" /> {Math.round(r.duration_minutes / 60)}h
                                    </span>
                                  )}
                                  {r.is_free && <span className="text-xs text-emerald-400 font-medium">Free</span>}
                                </div>
                                {r.description && <p className="text-xs text-slate-500 mt-1 italic">{r.description}</p>}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

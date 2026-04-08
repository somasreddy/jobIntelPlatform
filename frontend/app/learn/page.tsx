"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  BookOpen, Plus, Trash2, CheckCircle2, Loader2,
  ArrowRight, Clock, ExternalLink, TrendingUp, Zap,
} from "lucide-react";

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
  completed_at: string;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

const LEVEL_LABELS = ["None", "Beginner", "Novice", "Intermediate", "Advanced", "Expert"];
const TYPE_ICONS: Record<string, string> = {
  course: "🎓", video: "▶️", article: "📄", project: "🛠️", book: "📚",
};

export default function LearnPage() {
  const { token } = useAuth();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);

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
    setGenerating(skill);
    try {
      const res = await fetch(`${API}/api/learning/paths/generate`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ skill_name: skill, current_level: cur, target_level: tgt }),
      });
      if (res.ok) {
        const path: LearningPath = await res.json();
        setPaths(prev => [path, ...prev.filter(p => p.id !== path.id)]);
        setSelectedPath(path);
        setNewSkill("");
      }
    } catch (e) { console.error(e); }
    finally { setGenerating(null); }
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

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
    </div>
  );

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — paths list + generator */}
          <div className="space-y-4">
            {/* Generator */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Generate Path
              </h3>
              <input
                className="input-field w-full mb-3"
                placeholder="Skill name (e.g. Python)"
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => e.key === "Enter" && newSkill.trim() && generatePath(newSkill.trim(), currentLevel, targetLevel)}
              />
              <div className="grid grid-cols-2 gap-2 mb-3">
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
              <button
                onClick={() => newSkill.trim() && generatePath(newSkill.trim(), currentLevel, targetLevel)}
                disabled={!newSkill.trim() || !!generating}
                className="btn-primary w-full flex items-center justify-center gap-2 py-2 text-sm"
              >
                {generating === newSkill ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generate
              </button>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Trending — gaps in your profile
                </h3>
                <div className="space-y-1.5">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => generatePath(s)}
                      disabled={!!generating}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all hover:opacity-80"
                      style={{ background: "var(--bg-elevated)", color: "var(--accent-bright)" }}
                    >
                      <span>{s}</span>
                      {generating === s ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Paths list */}
            <div className="space-y-2">
              {paths.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPath(p)}
                  className="w-full card p-4 text-left transition-all hover:opacity-90"
                  style={selectedPath?.id === p.id ? {
                    border: "1px solid var(--border-hover)",
                    boxShadow: "0 0 12px -4px var(--glow-accent)",
                  } : {}}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{p.skill_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
                    }`}>{p.status}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${p.progress_pct}%`, background: "var(--accent)" }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{p.progress_pct}%</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {LEVEL_LABELS[p.current_level]} → {LEVEL_LABELS[p.target_level]}
                    {p.estimated_hours ? ` · ~${p.estimated_hours}h` : ""}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Right — selected path resources */}
          <div className="lg:col-span-2">
            {!selectedPath ? (
              <div className="card p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <BookOpen className="w-10 h-10 mb-3 text-slate-600" />
                <p className="text-slate-500 text-sm">Select a path or generate a new one</p>
              </div>
            ) : (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedPath.skill_name}</h2>
                    <p className="text-xs text-slate-400">
                      {LEVEL_LABELS[selectedPath.current_level]} → {LEVEL_LABELS[selectedPath.target_level]}
                      {selectedPath.estimated_hours ? ` · ~${selectedPath.estimated_hours}h total` : ""}
                    </p>
                  </div>
                  <button onClick={() => deletePath(selectedPath.id)} className="text-slate-600 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{selectedPath.progress_pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${selectedPath.progress_pct}%`, background: "var(--accent)" }}
                    />
                  </div>
                </div>

                {/* Resources */}
                <div className="space-y-3">
                  {(selectedPath.resources || []).map((r, i) => {
                    const done = completions.some(c =>
                      c.skill_name.toLowerCase() === selectedPath.skill_name.toLowerCase()
                    );
                    return (
                      <div
                        key={i}
                        className="flex gap-3 p-3 rounded-xl"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        <div className="text-lg shrink-0">{TYPE_ICONS[r.type] || "📌"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-white hover:underline flex items-center gap-1"
                            >
                              {r.title}
                              <ExternalLink className="w-3 h-3 text-slate-500" />
                            </a>
                            <button
                              onClick={() => markComplete(selectedPath, r)}
                              className={`shrink-0 transition-colors ${done ? "text-emerald-400" : "text-slate-600 hover:text-emerald-400"}`}
                              title="Mark complete"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {r.provider && <span className="text-xs text-slate-500">{r.provider}</span>}
                            {r.difficulty && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">{r.difficulty}</span>
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

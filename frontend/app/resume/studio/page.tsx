"use client";
import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/ProfileContext";
import {
  FileText, Target, ArrowLeft, Sparkles, CheckCircle2,
  XCircle, AlertCircle, Copy, Check, TrendingUp, Zap,
  ChevronDown, ChevronUp, RefreshCw, Eye, EyeOff,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Keyword extraction ─────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "the", "and", "for", "are", "with", "that", "this", "have", "from",
  "will", "your", "you", "our", "their", "they", "been", "has", "had",
  "was", "were", "not", "but", "more", "also", "what", "when", "which",
  "who", "how", "its", "use", "can", "all", "any", "one", "two", "new",
  "work", "team", "role", "job", "hire", "help", "make", "build", "able",
]);

function extractKeywords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const words = text.toLowerCase().replace(/[^a-z0-9+#.\-/ ]/g, " ").split(/\s+/);

  // Single important words
  words.forEach(w => {
    if (w.length >= 4 && !STOP_WORDS.has(w)) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  });

  // Bigrams for tech phrases
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (words[i].length >= 3 && words[i + 1].length >= 3 &&
        !STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }
  }

  // Filter noise — keep only terms appearing 1+ times in JD
  return counts;
}

interface KeywordMatch {
  term: string;
  inJd: boolean;
  inResume: boolean;
  jdFreq: number;
  resumeFreq: number;
  priority: "critical" | "important" | "nice";
}

const CRITICAL_TECH = new Set([
  "python", "java", "typescript", "javascript", "go", "rust", "sql", "nosql",
  "react", "node", "fastapi", "spring", "django", "kubernetes", "docker",
  "aws", "azure", "gcp", "ci/cd", "terraform", "kafka", "redis", "postgres",
  "postgresql", "mongodb", "graphql", "rest", "api", "microservices",
  "playwright", "selenium", "cypress", "pytest", "jest", "junit",
  "machine learning", "deep learning", "llm", "langchain", "mlops",
  "system design", "distributed systems", "data pipelines",
]);

function analyzeKeywords(jdText: string, resumeText: string): KeywordMatch[] {
  const jdKws = extractKeywords(jdText);
  const resumeKws = extractKeywords(resumeText);

  const allTerms = new Set([...jdKws.keys()]);
  const results: KeywordMatch[] = [];

  allTerms.forEach(term => {
    const jdFreq = jdKws.get(term) ?? 0;
    const resumeFreq = resumeKws.get(term) ?? 0;
    if (jdFreq === 0) return; // only care about JD terms

    const isCritical = CRITICAL_TECH.has(term) || jdFreq >= 3;
    const isImportant = jdFreq >= 2;

    results.push({
      term,
      inJd: true,
      inResume: resumeFreq > 0,
      jdFreq,
      resumeFreq,
      priority: isCritical ? "critical" : isImportant ? "important" : "nice",
    });
  });

  // Sort: missing critical first, then by jdFreq desc
  return results
    .filter(k => k.term.length >= 4)
    .sort((a, b) => {
      const missingA = !a.inResume ? 1 : 0;
      const missingB = !b.inResume ? 1 : 0;
      const priorityOrder = { critical: 0, important: 1, nice: 2 };
      if (missingA !== missingB) return missingB - missingA;
      if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
      return b.jdFreq - a.jdFreq;
    })
    .slice(0, 60); // top 60 terms
}

// ── Text highlighter ──────────────────────────────────────────────────────────
function highlightText(text: string, keywords: KeywordMatch[], mode: "resume" | "jd"): React.ReactNode[] {
  if (!text || keywords.length === 0) return [<span key="raw">{text}</span>];

  const matchingTerms = keywords
    .filter(k => mode === "resume" ? k.inJd : k.inResume)
    .map(k => ({ term: k.term, priority: k.priority, inResume: k.inResume }));

  if (matchingTerms.length === 0) return [<span key="raw">{text}</span>];

  // Build sorted patterns (longer first to avoid partial matches)
  const sorted = [...matchingTerms].sort((a, b) => b.term.length - a.term.length);
  const pattern = sorted.map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");

  const parts = text.split(regex);
  const termMap = new Map(sorted.map(t => [t.term.toLowerCase(), t]));

  return parts.map((part, i) => {
    const lower = part.toLowerCase();
    const match = termMap.get(lower);
    if (match) {
      const color =
        match.priority === "critical"
          ? mode === "resume" ? "bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/50" : "bg-cyan-500/20 text-cyan-300 border-b border-cyan-500/50"
          : match.priority === "important"
          ? mode === "resume" ? "bg-blue-500/15 text-blue-300 border-b border-blue-500/40" : "bg-violet-500/15 text-violet-300 border-b border-violet-500/40"
          : mode === "resume" ? "bg-slate-500/20 text-slate-300" : "bg-slate-500/20 text-slate-300";
      return <mark key={i} className={`rounded px-0.5 not-italic font-medium ${color}`}>{part}</mark>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Match score ───────────────────────────────────────────────────────────────
function calcMatchScore(keywords: KeywordMatch[]): { score: number; critical: number; important: number; missing: string[] } {
  const criticals = keywords.filter(k => k.priority === "critical");
  const importants = keywords.filter(k => k.priority === "important");
  const critHit = criticals.filter(k => k.inResume).length;
  const impHit = importants.filter(k => k.inResume).length;
  const niceHit = keywords.filter(k => k.priority === "nice" && k.inResume).length;
  const total = criticals.length * 3 + importants.length * 2 + keywords.filter(k => k.priority === "nice").length;
  const got = critHit * 3 + impHit * 2 + niceHit;
  const score = total > 0 ? Math.round((got / total) * 100) : 0;
  const missing = keywords.filter(k => !k.inResume && k.priority !== "nice").map(k => k.term).slice(0, 12);
  return { score, critical: critHit, important: impHit, missing };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ResumeStudioPage() {
  const router = useRouter();
  const { profile, loading } = useProfile();

  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [analyzed, setAnalyzed] = useState(false);
  const [showJdHighlight, setShowJdHighlight] = useState(true);
  const [showResumeHighlight, setShowResumeHighlight] = useState(true);
  const [filterMissing, setFilterMissing] = useState(false);
  const [expandedTerms, setExpandedTerms] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const jdRef = useRef<HTMLTextAreaElement>(null);
  const resumeRef = useRef<HTMLTextAreaElement>(null);

  // Seed from profile
  const profileResume = profile?.resumeText ?? "";

  const handleAnalyze = () => {
    if (!jdText.trim() || !resumeText.trim()) return;
    setAnalyzed(true);
    setSuggestions([]);
  };

  const keywords = useMemo(() => {
    if (!analyzed || !jdText || !resumeText) return [];
    return analyzeKeywords(jdText, resumeText);
  }, [analyzed, jdText, resumeText]);

  const matchStats = useMemo(() => calcMatchScore(keywords), [keywords]);

  const displayKeywords = useMemo(() => {
    return filterMissing ? keywords.filter(k => !k.inResume) : keywords;
  }, [keywords, filterMissing]);

  const visibleKeywords = expandedTerms ? displayKeywords : displayKeywords.slice(0, 20);

  const jdHighlighted = useMemo(() => {
    if (!analyzed || !showJdHighlight) return null;
    return highlightText(jdText, keywords.filter(k => k.inResume), "jd");
  }, [analyzed, showJdHighlight, jdText, keywords]);

  const resumeHighlighted = useMemo(() => {
    if (!analyzed || !showResumeHighlight) return null;
    return highlightText(resumeText, keywords, "resume");
  }, [analyzed, showResumeHighlight, resumeText, keywords]);

  const generateSuggestions = async () => {
    if (!jdText || !resumeText) return;
    setGenerating(true);
    setSuggestions([]);
    try {
      const res = await fetch(`${API}/api/resume/generate-ats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: profile ?? {},
          job: { title: "Target Role", description: jdText.slice(0, 1500) },
          gap_keywords: matchStats.missing,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const bullets: string[] = data.bullets ?? data.ats_bullets ?? [];
        setSuggestions(bullets.slice(0, 5));
      }
    } catch { /* silent */ }
    setGenerating(false);
  };

  const copyMissing = () => {
    navigator.clipboard.writeText(matchStats.missing.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scoreColor =
    matchStats.score >= 75 ? "text-emerald-400" :
    matchStats.score >= 55 ? "text-amber-400" :
    "text-rose-400";

  const scoreLabel =
    matchStats.score >= 75 ? "Strong Match" :
    matchStats.score >= 55 ? "Partial Match" :
    "Weak Match";

  if (!loading && !profile) {
    return (
      <div className="flex min-h-screen bg-transparent">
        <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h2 className="text-white font-semibold text-xl mb-2">No profile found</h2>
            <p className="text-slate-400 text-sm mb-6">Set up your career profile first.</p>
            <button onClick={() => router.push("/")} className="btn-primary text-sm px-6 py-2.5">Set Up Profile</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-12">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => router.push("/resume")} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
              <FileText className="w-3.5 h-3.5" /> Resume Studio
            </div>
            <h1 className="text-2xl font-bold text-white">
              JD <span className="gradient-text">Match Studio</span>
            </h1>
          </div>
          {analyzed && (
            <div className="ml-auto flex items-center gap-2">
              <div className={`text-3xl font-bold ${scoreColor}`}>{matchStats.score}%</div>
              <div>
                <p className={`text-xs font-semibold ${scoreColor}`}>{scoreLabel}</p>
                <p className="text-[10px] text-slate-500">keyword match</p>
              </div>
            </div>
          )}
        </div>

        {/* Input section (collapsed after analysis) */}
        {!analyzed && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="card p-4">
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-400" /> Job Description
              </label>
              <textarea
                ref={jdRef}
                className="input-field w-full resize-none text-xs leading-relaxed"
                rows={14}
                placeholder="Paste the full job description here…"
                value={jdText}
                onChange={e => setJdText(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1">{jdText.split(/\s+/).filter(Boolean).length} words</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" /> Your Resume
                </label>
                {profileResume && (
                  <button
                    onClick={() => setResumeText(profileResume)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Load from profile
                  </button>
                )}
              </div>
              <textarea
                ref={resumeRef}
                className="input-field w-full resize-none text-xs leading-relaxed"
                rows={14}
                placeholder="Paste your resume text here…"
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1">{resumeText.split(/\s+/).filter(Boolean).length} words</p>
            </div>
          </div>
        )}

        {!analyzed ? (
          <button
            onClick={handleAnalyze}
            disabled={!jdText.trim() || !resumeText.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base mb-6 disabled:opacity-40"
          >
            <Sparkles className="w-5 h-5" /> Analyze Match
          </button>
        ) : (
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => { setAnalyzed(false); setSuggestions([]); }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-xl border"
              style={{ border: "1px solid var(--border)" }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Edit Inputs
            </button>
            <button
              onClick={generateSuggestions}
              disabled={generating}
              className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2"
            >
              {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {generating ? "Generating…" : "AI Bullet Suggestions"}
            </button>
          </div>
        )}

        {/* ── ANALYSIS VIEW ──────────────────────────────────────────────── */}
        {analyzed && (
          <div className="space-y-5">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Match Score", value: `${matchStats.score}%`, color: scoreColor },
                { label: "Critical Hits", value: `${matchStats.critical}/${keywords.filter(k => k.priority === "critical").length}`, color: matchStats.critical >= keywords.filter(k => k.priority === "critical").length * 0.7 ? "text-emerald-400" : "text-rose-400" },
                { label: "Important Hits", value: `${matchStats.important}/${keywords.filter(k => k.priority === "important").length}`, color: "text-cyan-400" },
                { label: "Missing Keywords", value: matchStats.missing.length.toString(), color: matchStats.missing.length === 0 ? "text-emerald-400" : "text-amber-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="card p-4 text-center">
                  <p className={`text-2xl font-bold ${color} mb-0.5`}>{value}</p>
                  <p className="text-[10px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            {/* Missing keywords */}
            {matchStats.missing.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" /> Missing from Resume
                    <span className="text-xs text-slate-500 font-normal">— add these to improve your match</span>
                  </h3>
                  <button onClick={copyMissing} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                    {copied ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy all</>}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {matchStats.missing.map(term => (
                    <span
                      key={term}
                      className="text-xs px-2.5 py-1 rounded-full font-medium border"
                      style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#fda4af" }}
                    >
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI bullet suggestions */}
            {suggestions.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> AI-Generated Bullets
                  <span className="text-xs text-slate-500 font-normal">— ready to drop into your resume</span>
                </h3>
                <ol className="space-y-2">
                  {suggestions.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
                      <span className="text-indigo-400 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                      {bullet}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Keyword legend */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 px-1">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50" /> Resume match (critical)</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500/15 border border-blue-500/40" /> Resume match (important)</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500/15 border border-rose-500/30" /> Missing keyword</div>
            </div>

            {/* Side-by-side panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* JD panel */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-400" /> Job Description
                  </h3>
                  <button
                    onClick={() => setShowJdHighlight(h => !h)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors"
                  >
                    {showJdHighlight ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showJdHighlight ? "Hide" : "Show"} highlights
                  </button>
                </div>
                <div
                  className="text-xs leading-relaxed text-slate-300 max-h-[500px] overflow-y-auto pr-2 whitespace-pre-wrap"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {showJdHighlight && jdHighlighted ? jdHighlighted : jdText}
                </div>
              </div>

              {/* Resume panel */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" /> Your Resume
                  </h3>
                  <button
                    onClick={() => setShowResumeHighlight(h => !h)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors"
                  >
                    {showResumeHighlight ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showResumeHighlight ? "Hide" : "Show"} highlights
                  </button>
                </div>
                <div
                  className="text-xs leading-relaxed text-slate-300 max-h-[500px] overflow-y-auto pr-2 whitespace-pre-wrap"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {showResumeHighlight && resumeHighlighted ? resumeHighlighted : resumeText}
                </div>
              </div>
            </div>

            {/* Keyword table */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-400" /> Keyword Analysis
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterMissing(f => !f)}
                    className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                      filterMissing ? "text-rose-400 border-rose-500/40 bg-rose-500/10" : "text-slate-400 border-slate-600"
                    }`}
                  >
                    {filterMissing ? "Showing missing only" : "Show missing only"}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-700/40">
                {visibleKeywords.map(kw => (
                  <div key={kw.term} className="flex items-center gap-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-slate-300 font-medium truncate">{kw.term}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                      kw.priority === "critical" ? "bg-rose-500/15 text-rose-300" :
                      kw.priority === "important" ? "bg-amber-500/15 text-amber-300" :
                      "bg-slate-600/30 text-slate-400"
                    }`}>{kw.priority}</span>
                    <span className="text-[10px] text-slate-500 shrink-0 w-10 text-right">×{kw.jdFreq} in JD</span>
                    <div className="shrink-0">
                      {kw.inResume
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : <XCircle className="w-4 h-4 text-rose-400" />}
                    </div>
                  </div>
                ))}
              </div>

              {displayKeywords.length > 20 && (
                <button
                  onClick={() => setExpandedTerms(e => !e)}
                  className="w-full mt-3 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 py-2 transition-colors"
                >
                  {expandedTerms
                    ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                    : <><ChevronDown className="w-3.5 h-3.5" /> Show all {displayKeywords.length} keywords</>}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

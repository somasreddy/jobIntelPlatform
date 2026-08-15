"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, ShieldCheck } from "lucide-react";
import { CandidateProfile, Job } from "@/lib/types";

type Trace = {
  requirement_id: string;
  requirement: string;
  kind: "hard" | "preferred";
  status: "met" | "partial" | "unmet";
  strength: "explicit" | "inferred" | "missing";
  reason: string;
  evidence_refs: string[];
  needs_review: boolean;
};

type MatchResult = {
  scoring_version: string;
  overall_score: number;
  fit_label: string;
  scores: {
    eligibility: number;
    relevance: number;
    competitiveness: number;
    profile_completeness: number;
    confidence: number;
  };
  decision: {
    eligible: boolean;
    recommendation_allowed: boolean;
    unmet_hard_requirement_ids: string[];
  };
  reason_trace: Trace[];
  assumptions: string[];
  source_reliability: {
    status: string;
    source: string;
    last_verified?: string | null;
    freshness_score?: number | null;
  };
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MatchIntelligencePanel({ job, profile }: { job: Job; profile: CandidateProfile }) {
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError(false);
    const token = localStorage.getItem("ji_token");
    fetch(`${API}/api/v2/matches/workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ profile, job }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("match request failed");
        setResult(await response.json());
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [job, profile]);

  if (error) {
    return (
      <div className="card border-amber-500/30">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Match intelligence unavailable</p>
            <p className="text-xs text-slate-400 mt-1">No score is shown because the explanation service could not be reached.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card animate-pulse" aria-label="Loading match intelligence">
        <div className="h-5 rounded bg-white/10 w-1/3 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 rounded-lg bg-white/5" />)}
        </div>
      </div>
    );
  }

  const dimensions = [
    ["Eligibility", result.scores.eligibility],
    ["Relevance", result.scores.relevance],
    ["Competitive", result.scores.competitiveness],
    ["Profile", result.scores.profile_completeness],
    ["Confidence", result.scores.confidence],
  ] as const;
  const unmet = result.reason_trace.filter((trace) => trace.status === "unmet");
  const matched = result.reason_trace.filter((trace) => trace.status === "met");
  const statusColor = result.decision.eligible ? "text-emerald-400" : "text-rose-400";

  return (
    <section className="card" aria-labelledby="match-intelligence-title">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Match Intelligence 2.0</p>
          <h2 id="match-intelligence-title" className="text-xl font-bold text-white mt-1">{result.fit_label}</h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic policy ? {result.scoring_version} ? Confidence {result.scores.confidence}%
          </p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${statusColor}`}>{result.overall_score}</p>
          <p className="text-[10px] text-slate-500">overall fit / 100</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-5">
        {dimensions.map(([label, value]) => (
          <div key={label} className="rounded-xl p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between gap-2 text-xs"><span className="text-slate-400">{label}</span><span className="text-white font-semibold">{value}</span></div>
            <div className="h-1 rounded-full bg-white/5 mt-2 overflow-hidden"><div className="h-full bg-indigo-400" style={{ width: `${value}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3 mt-4">
        <div className="rounded-xl p-3 bg-rose-500/5 border border-rose-500/20">
          <p className="text-xs font-semibold text-rose-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Critical gaps ({unmet.length})</p>
          <p className="text-xs text-slate-400 mt-2">{unmet.length ? unmet.slice(0, 3).map((item) => item.requirement).join(" ? ") : "No unmet normalized requirements detected."}</p>
        </div>
        <div className="rounded-xl p-3 bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-xs font-semibold text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Supported requirements ({matched.length})</p>
          <p className="text-xs text-slate-400 mt-2">{matched.length ? matched.slice(0, 3).map((item) => item.requirement).join(" ? ") : "Add reviewed profile evidence to establish supported requirements."}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>{result.source_reliability.source} ? {result.source_reliability.status}</span>
        </div>
        <button onClick={() => setOpen((value) => !value)} className="text-xs font-medium text-indigo-300 flex items-center gap-1">
          {open ? "Hide" : "Show"} evidence {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-2">
          {result.reason_trace.length === 0 ? (
            <p className="text-xs text-slate-400 flex gap-2"><Info className="w-4 h-4" />No structured requirements were extracted; review the job description before deciding.</p>
          ) : result.reason_trace.map((trace) => (
            <div key={trace.requirement_id} className="rounded-lg p-3 flex items-start gap-3" style={{ background: "var(--bg-elevated)" }}>
              {trace.status === "met" ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />}
              <div>
                <p className="text-xs font-semibold text-white">{trace.requirement} <span className="text-[10px] text-slate-500">? {trace.kind}</span></p>
                <p className="text-xs text-slate-400 mt-1">{trace.reason}</p>
                {trace.needs_review && <span className="inline-block mt-1 text-[10px] text-amber-300">Needs review ? inferred evidence</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

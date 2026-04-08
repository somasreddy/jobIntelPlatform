"use client";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  Eye, Loader2, CheckCircle2, AlertTriangle, Zap,
  ArrowLeft, Star, RotateCcw,
} from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

interface ShadowResult {
  role: string;
  company: string;
  overall_grade: string;
  overall_score: number;
  what_went_well: string[];
  missed_opportunities: Array<{ moment: string; what_you_could_have_said: string; why_it_matters: string }>;
  red_flag_moments: string[];
  suggested_rewrites: Array<{ original: string; rewrite: string }>;
  likelihood_of_offer: string;
  if_rejected_why: string;
  follow_up_strategy: string;
  lessons_for_next_time: string[];
  error?: string;
}

const GRADE_COLOR: Record<string, string> = {
  "A+": "#10b981", "A": "#10b981", "A-": "#10b981",
  "B+": "#06b6d4", "B": "#06b6d4", "B-": "#06b6d4",
  "C+": "#f59e0b", "C": "#f59e0b", "C-": "#f59e0b",
  "D": "#f43f5e", "F": "#f43f5e",
};

export default function ShadowReviewPage() {
  const { token } = useAuth();
  const [form, setForm] = useState({ role: "", company: "", interview_notes: "", outcome: "" });
  const [result, setResult] = useState<ShadowResult | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.role.trim() || !form.interview_notes.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/interview-analytics/shadow-review`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(form),
      });
      if (res.ok) setResult(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-4xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/interview" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Eye className="w-6 h-6" style={{ color: "var(--accent)" }} />
              Shadow Interview Review
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Paste your real interview notes — get AI post-debrief coaching
            </p>
          </div>
        </div>

        {!result ? (
          <div className="card p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Role Interviewed For</label>
                <input className="input-field w-full" placeholder="e.g. Senior Software Engineer"
                  value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Company</label>
                <input className="input-field w-full" placeholder="e.g. Google"
                  value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Outcome (if known)</label>
              <select className="input-field w-full" value={form.outcome} onChange={e => setForm(p => ({ ...p, outcome: e.target.value }))}>
                <option value="">Not sure yet</option>
                <option value="offer">Got an offer</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Waiting to hear back</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Your Interview Notes
                <span className="text-slate-500 ml-2">— include questions asked, your answers, observations, anything you remember</span>
              </label>
              <textarea
                className="input-field w-full resize-none text-sm"
                rows={10}
                placeholder={`Example:\n\nRound 1 (screening with HR):\n- They asked why I want to leave my current role. I said I'm looking for growth opportunities...\n- Asked about my experience with distributed systems. I mentioned the migration I led...\n\nRound 2 (technical with hiring manager):\n- System design: design a URL shortener. I started with requirements but they seemed impatient...\n- Asked a STAR question about a time I handled conflict. I talked about the product team disagreement...`}
                value={form.interview_notes}
                onChange={e => setForm(p => ({ ...p, interview_notes: e.target.value }))}
              />
            </div>

            <button
              onClick={submit}
              disabled={loading || !form.role.trim() || !form.interview_notes.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base font-semibold"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Analysing your interview…</>
              ) : (
                <><Eye className="w-5 h-5" /> Get Post-Interview Debrief</>
              )}
            </button>
          </div>
        ) : result.error ? (
          <div className="card p-6 flex items-center gap-3 text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>{result.error}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Grade card */}
            <div className="card p-6 flex items-center gap-6">
              <div className="text-center">
                <div className="text-6xl font-black" style={{ color: GRADE_COLOR[result.overall_grade] || "#94a3b8" }}>
                  {result.overall_grade}
                </div>
                <div className="text-xs text-slate-500 mt-1">Grade</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-white">{result.role}</span>
                  <span className="text-slate-500">at</span>
                  <span className="text-sm font-bold text-white">{result.company}</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-400">Offer likelihood:</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    result.likelihood_of_offer === "High" ? "bg-emerald-500/20 text-emerald-400" :
                    result.likelihood_of_offer === "Medium" ? "bg-amber-500/20 text-amber-400" :
                    "bg-rose-500/20 text-rose-400"
                  }`}>{result.likelihood_of_offer}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${result.overall_score}%`, background: GRADE_COLOR[result.overall_grade] || "#94a3b8" }} />
                </div>
              </div>
              <button onClick={() => setResult(null)} className="text-slate-500 hover:text-slate-300 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* What went well */}
              {result.what_went_well?.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-xs font-semibold text-emerald-400 mb-3 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> What Went Well
                  </h3>
                  <ul className="space-y-1.5">
                    {result.what_went_well.map((item, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">✓</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red flags */}
              {result.red_flag_moments?.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-xs font-semibold text-rose-400 mb-3 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Red Flag Moments
                  </h3>
                  <ul className="space-y-1.5">
                    {result.red_flag_moments.map((item, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                        <span className="text-rose-500 mt-0.5">•</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Missed opportunities */}
            {result.missed_opportunities?.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" /> Missed Opportunities
                </h3>
                <div className="space-y-4">
                  {result.missed_opportunities.map((m, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                      <p className="text-xs text-slate-400 mb-2"><span className="text-amber-400 font-semibold">You said:</span> {m.moment}</p>
                      <p className="text-xs text-emerald-300 mb-1"><span className="font-semibold">Stronger approach:</span> {m.what_you_could_have_said}</p>
                      <p className="text-[10px] text-slate-500 italic">Why it matters: {m.why_it_matters}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested rewrites */}
            {result.suggested_rewrites?.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} /> Suggested Rewrites
                </h3>
                <div className="space-y-4">
                  {result.suggested_rewrites.map((r, i) => (
                    <div key={i}>
                      <div className="p-3 rounded-t-xl" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.15)" }}>
                        <p className="text-[10px] text-rose-400 font-semibold mb-1">ORIGINAL</p>
                        <p className="text-xs text-slate-400">{r.original}</p>
                      </div>
                      <div className="p-3 rounded-b-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderTop: "none" }}>
                        <p className="text-[10px] text-emerald-400 font-semibold mb-1">STRONGER VERSION</p>
                        <p className="text-xs text-emerald-200">{r.rewrite}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Follow up + lessons */}
            <div className="grid sm:grid-cols-2 gap-4">
              {result.follow_up_strategy && (
                <div className="card p-5">
                  <h3 className="text-xs font-semibold text-slate-300 mb-2">Follow-Up Strategy</h3>
                  <p className="text-xs text-slate-400">{result.follow_up_strategy}</p>
                </div>
              )}
              {result.lessons_for_next_time?.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-xs font-semibold text-slate-300 mb-2">Lessons for Next Time</h3>
                  <ul className="space-y-1">
                    {result.lessons_for_next_time.map((l, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                        <span className="text-slate-500 mt-0.5">{i + 1}.</span>{l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

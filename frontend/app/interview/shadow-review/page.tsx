"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/lib/AuthContext";
import { motionTransition } from "@/lib/motion-tokens";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Eye, Loader2, CheckCircle2, AlertTriangle, Zap,
  ArrowLeft, Star, RotateCcw, TrendingUp, Sparkles, ListChecks, Compass,
} from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

interface StarDimension {
  score: number;
  justification: string;
}

interface StarRubric {
  situation: StarDimension;
  task: StarDimension;
  action: StarDimension;
  result: StarDimension;
  overall_star_score: number;
}

interface ShadowResult {
  role: string;
  company: string;
  overall_grade: string;
  overall_score: number;
  star_rubric?: StarRubric;
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

const STAR_DIMENSION_META: Record<keyof Omit<StarRubric, "overall_star_score">, { label: string; hint: string }> = {
  situation: { label: "Situation", hint: "Context — what was going on, and why it mattered" },
  task:      { label: "Task",      hint: "The candidate's specific responsibility in that context" },
  action:    { label: "Action",    hint: "What the candidate actually did, in their own words" },
  result:    { label: "Result",    hint: "The measurable/observable outcome of that action" },
};

function starScoreColor(score: number): string {
  return score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e";
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
      const res = await fetch(`${API}/api/interview/shadow-review`, {
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

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionTransition("base", "outQuint")}
            >
              <Card className="backdrop-blur-xl p-6 space-y-5">
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

                <Button
                  onClick={submit}
                  disabled={loading || !form.role.trim() || !form.interview_notes.trim()}
                  className="btn-primary h-auto w-full flex items-center justify-center gap-2 py-3 text-base font-semibold"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Analysing your interview…</>
                  ) : (
                    <><Eye className="w-5 h-5" /> Get Post-Interview Debrief</>
                  )}
                </Button>
              </Card>

              {/* Loading preview — signals the debrief structure that's on its way */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={motionTransition("base", "smooth")}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                      <div className="rounded-xl p-5 flex items-center gap-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                        <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-2 w-full" />
                        </div>
                      </div>
                      <div className="rounded-xl p-5 space-y-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : result.error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionTransition("base", "outQuint")}
            >
              <Card className="backdrop-blur-xl p-6 flex items-center gap-3 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>{result.error}</p>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={motionTransition("base", "outQuint")}
              className="space-y-5"
            >
              {/* Grade card */}
              <Card className="backdrop-blur-xl p-6 flex items-center gap-6">
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
                    <Badge className={`rounded-full border-none text-xs font-bold px-2 py-0.5 ${
                      result.likelihood_of_offer === "High" ? "bg-emerald-500/20 text-emerald-400" :
                      result.likelihood_of_offer === "Medium" ? "bg-amber-500/20 text-amber-400" :
                      "bg-rose-500/20 text-rose-400"
                    }`}>{result.likelihood_of_offer}</Badge>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${result.overall_score}%`, background: GRADE_COLOR[result.overall_grade] || "#94a3b8" }} />
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setResult(null)} className="h-auto w-auto p-0 text-slate-500 hover:text-slate-300 hover:bg-transparent shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </Button>
              </Card>

              {/* Categorized feedback */}
              <Tabs defaultValue={result.star_rubric ? "star-rubric" : "overview"}>
                <TabsList className="w-full sm:w-auto flex-wrap h-auto">
                  {result.star_rubric && (
                    <TabsTrigger value="star-rubric" className="gap-1.5">
                      <Compass className="w-3.5 h-3.5" /> STAR Rubric
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="overview" className="gap-1.5">
                    <ListChecks className="w-3.5 h-3.5" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="opportunities" className="gap-1.5">
                    <Star className="w-3.5 h-3.5" /> Opportunities
                  </TabsTrigger>
                  <TabsTrigger value="rewrites" className="gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Rewrites
                  </TabsTrigger>
                  <TabsTrigger value="next-steps" className="gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Next Steps
                  </TabsTrigger>
                </TabsList>

                {/* STAR Rubric: Situation/Task/Action/Result each scored with a
                    justification grounded in the candidate's actual notes */}
                {result.star_rubric && (
                  <TabsContent value="star-rubric" className="mt-4">
                    <Card className="backdrop-blur-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Compass className="w-4 h-4" style={{ color: "var(--accent)" }} /> STAR Structure Rubric
                        </h3>
                        <div className="text-right">
                          <span
                            className="text-lg font-black"
                            style={{ color: starScoreColor(result.star_rubric.overall_star_score) }}
                          >
                            {result.star_rubric.overall_star_score}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-1">/100 overall STAR</span>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {(Object.keys(STAR_DIMENSION_META) as Array<keyof typeof STAR_DIMENSION_META>).map((key) => {
                          const dim = result.star_rubric![key];
                          const meta = STAR_DIMENSION_META[key];
                          const color = starScoreColor(dim.score);
                          return (
                            <div key={key} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-white">{meta.label}</span>
                                <span className="text-xs font-bold" style={{ color }}>{dim.score}/100</span>
                              </div>
                              <p className="text-[10px] text-slate-500 mb-2">{meta.hint}</p>
                              <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-2">
                                <div className="h-full rounded-full transition-all" style={{ width: `${dim.score}%`, background: color }} />
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed italic">&ldquo;{dim.justification}&rdquo;</p>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </TabsContent>
                )}

                {/* Overview: what went well + red flags */}
                <TabsContent value="overview" className="mt-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Card className="backdrop-blur-xl p-5">
                      <h3 className="text-xs font-semibold text-emerald-400 mb-3 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> What Went Well
                      </h3>
                      {result.what_went_well?.length > 0 ? (
                        <ul className="space-y-1.5">
                          {result.what_went_well.map((item, i) => (
                            <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                              <span className="text-emerald-500 mt-0.5">✓</span>{item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No specific strengths were called out this time.</p>
                      )}
                    </Card>

                    <Card className="backdrop-blur-xl p-5">
                      <h3 className="text-xs font-semibold text-rose-400 mb-3 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Red Flag Moments
                      </h3>
                      {result.red_flag_moments?.length > 0 ? (
                        <ul className="space-y-1.5">
                          {result.red_flag_moments.map((item, i) => (
                            <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                              <span className="text-rose-500 mt-0.5">•</span>{item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No red flags identified — nice job!</p>
                      )}
                    </Card>
                  </div>
                </TabsContent>

                {/* Missed opportunities */}
                <TabsContent value="opportunities" className="mt-4">
                  <Card className="backdrop-blur-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-400" /> Missed Opportunities
                    </h3>
                    {result.missed_opportunities?.length > 0 ? (
                      <div className="space-y-4">
                        {result.missed_opportunities.map((m, i) => (
                          <div key={i} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                            <p className="text-xs text-slate-400 mb-2"><span className="text-amber-400 font-semibold">You said:</span> {m.moment}</p>
                            <p className="text-xs text-emerald-300 mb-1"><span className="font-semibold">Stronger approach:</span> {m.what_you_could_have_said}</p>
                            <p className="text-[10px] text-slate-500 italic">Why it matters: {m.why_it_matters}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={Sparkles}
                        title="No missed opportunities flagged"
                        description="Your notes didn't surface any moments where a stronger answer was available."
                        bordered={false}
                      />
                    )}
                  </Card>
                </TabsContent>

                {/* Suggested rewrites */}
                <TabsContent value="rewrites" className="mt-4">
                  <Card className="backdrop-blur-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} /> Suggested Rewrites
                    </h3>
                    {result.suggested_rewrites?.length > 0 ? (
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
                    ) : (
                      <EmptyState
                        icon={Sparkles}
                        title="No rewrites suggested"
                        description="Nothing in your answers needed a stronger phrasing this time."
                        bordered={false}
                      />
                    )}
                  </Card>
                </TabsContent>

                {/* Follow up + lessons */}
                <TabsContent value="next-steps" className="mt-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Card className="backdrop-blur-xl p-5">
                      <h3 className="text-xs font-semibold text-slate-300 mb-2">Follow-Up Strategy</h3>
                      {result.follow_up_strategy ? (
                        <p className="text-xs text-slate-400">{result.follow_up_strategy}</p>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No follow-up strategy suggested.</p>
                      )}
                    </Card>
                    <Card className="backdrop-blur-xl p-5">
                      <h3 className="text-xs font-semibold text-slate-300 mb-2">Lessons for Next Time</h3>
                      {result.lessons_for_next_time?.length > 0 ? (
                        <ul className="space-y-1">
                          {result.lessons_for_next_time.map((l, i) => (
                            <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                              <span className="text-slate-500 mt-0.5">{i + 1}.</span>{l}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No specific lessons captured.</p>
                      )}
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

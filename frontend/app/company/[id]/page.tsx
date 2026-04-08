"use client";
import { useState, useEffect, use } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  Globe, MapPin, Users, Star,
  AlertTriangle, Loader2,
  ExternalLink, Zap, Briefcase,
  MessageSquare, Plus, CheckCircle2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size_range: string | null;
  founded_year: number | null;
  hq_location: string | null;
  remote_policy: string | null;
  description: string | null;
  website: string | null;
  linkedin_url: string | null;
  funding_stage: string | null;
  glassdoor_rating: number | null;
  glassdoor_review_count: number | null;
  culture_score: number | null;
  growth_score: number | null;
  layoff_risk_score: number | null;
  interview_difficulty_avg: number | null;
  tech_stack: string[];
  salary_ranges: Record<string, { min: number; max: number; currency: string }>;
  interview_process: {
    style?: string;
    green_flags?: string[];
    red_flags?: string[];
    culture_signals?: string[];
  };
  insider_report: string | null;
  interview_reports: InterviewReport[];
}

interface InterviewReport {
  id: string;
  role: string;
  interview_rounds: number | null;
  difficulty: number | null;
  outcome: string | null;
  questions: string[];
  process_description: string | null;
  tips: string | null;
  created_at: string | null;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

function ScorePill({ label, score, invert = false }: { label: string; score: number | null; invert?: boolean }) {
  if (score == null) return null;
  const effective = invert ? 100 - score : score;
  const color = effective >= 70 ? "#10b981" : effective >= 50 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl font-bold mb-1" style={{ color }}>{score}</div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="h-1 rounded-full bg-slate-700 overflow-hidden mt-2">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

export default function CompanyDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "interview" | "salary" | "culture">("overview");

  // Report submission
  const [showReportForm, setShowReportForm] = useState(false);
  const [report, setReport] = useState({ role: "", interview_rounds: "", difficulty: "3", outcome: "", process_description: "", tips: "", questions: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/company/${id}`, { headers: authHeaders(token) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCompany(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, token]);

  const submitReport = async () => {
    setSubmitting(true);
    try {
      await fetch(`${API}/api/company/${id}/interview-reports`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          role: report.role,
          interview_rounds: report.interview_rounds ? +report.interview_rounds : null,
          difficulty: +report.difficulty,
          outcome: report.outcome || null,
          process_description: report.process_description || null,
          tips: report.tips || null,
          questions: report.questions ? report.questions.split("\n").filter(Boolean) : [],
        }),
      });
      setShowReportForm(false);
      // Refresh
      const res = await fetch(`${API}/api/company/${id}`, { headers: authHeaders(token) });
      if (res.ok) setCompany(await res.json());
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
    </div>
  );

  if (!company) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate-400">Company not found.</p>
    </div>
  );

  const ip = company.interview_process || {};

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-5xl">

        {/* Header */}
        <div className="card p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent))" }}>
              {company.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white">{company.name}</h1>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-400">
                {company.industry && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{company.industry}</span>}
                {company.hq_location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{company.hq_location}</span>}
                {company.size_range && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{company.size_range} employees</span>}
                {company.remote_policy && <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{company.remote_policy}</span>}
              </div>
              <div className="flex gap-3 mt-2 flex-wrap">
                {company.funding_stage && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent-bright)" }}>
                    {company.funding_stage}
                  </span>
                )}
                {company.glassdoor_rating && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Star className="w-3 h-3" /> {company.glassdoor_rating} Glassdoor
                  </span>
                )}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs" style={{ color: "var(--accent-bright)" }}>
                    Website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Score grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <ScorePill label="Culture Score" score={company.culture_score} />
          <ScorePill label="Growth Score" score={company.growth_score} />
          <ScorePill label="Layoff Risk" score={company.layoff_risk_score} invert />
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold mb-1 text-white">
              {company.interview_difficulty_avg ? company.interview_difficulty_avg.toFixed(1) : "—"}
            </div>
            <div className="text-xs text-slate-400">Interview Difficulty</div>
            <div className="text-[10px] text-slate-500 mt-1">out of 5</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
          {(["overview", "interview", "salary", "culture"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all"
              style={activeTab === tab ? {
                background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                color: "var(--accent-bright)",
                border: "1px solid var(--border-hover)",
              } : { color: "#94a3b8" }}>
              {tab === "interview" ? "Interview Intel" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {company.description && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-2">About</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{company.description}</p>
              </div>
            )}
            {company.insider_report && (
              <div className="card p-5" style={{ border: "1px solid var(--border-hover)" }}>
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} /> AI Insider Report
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed italic">{company.insider_report}</p>
              </div>
            )}
            {(company.tech_stack || []).length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {company.tech_stack.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── INTERVIEW INTEL ── */}
        {activeTab === "interview" && (
          <div className="space-y-4">
            {ip.style && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-2">Interview Style</h3>
                <p className="text-sm text-slate-400">{ip.style}</p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              {(ip.green_flags || []).length > 0 && (
                <div className="card p-4">
                  <h3 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Green Flags</h3>
                  <ul className="space-y-1">{ip.green_flags!.map((f,i) => <li key={i} className="text-xs text-slate-400">{f}</li>)}</ul>
                </div>
              )}
              {(ip.red_flags || []).length > 0 && (
                <div className="card p-4">
                  <h3 className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Red Flags</h3>
                  <ul className="space-y-1">{ip.red_flags!.map((f,i) => <li key={i} className="text-xs text-slate-400">{f}</li>)}</ul>
                </div>
              )}
            </div>

            {/* Community reports */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  Community Reports ({company.interview_reports.length})
                </h3>
                <button onClick={() => setShowReportForm(p => !p)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent-bright)" }}>
                  <Plus className="w-3 h-3" /> Share Experience
                </button>
              </div>

              {showReportForm && (
                <div className="space-y-3 mb-4 p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input className="input-field w-full text-sm" placeholder="Role you applied for"
                      value={report.role} onChange={e => setReport(p => ({ ...p, role: e.target.value }))} />
                    <input className="input-field w-full text-sm" placeholder="# of rounds"
                      type="number" value={report.interview_rounds} onChange={e => setReport(p => ({ ...p, interview_rounds: e.target.value }))} />
                    <select className="input-field text-sm" value={report.difficulty} onChange={e => setReport(p => ({ ...p, difficulty: e.target.value }))}>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {["","Very Easy","Easy","Medium","Hard","Very Hard"][n]}</option>)}
                    </select>
                    <select className="input-field text-sm" value={report.outcome} onChange={e => setReport(p => ({ ...p, outcome: e.target.value }))}>
                      <option value="">Outcome (optional)</option>
                      <option>Offer</option><option>Rejected</option><option>Withdrew</option><option>Pending</option>
                    </select>
                  </div>
                  <textarea className="input-field w-full text-sm resize-none" rows={2} placeholder="Describe the process…"
                    value={report.process_description} onChange={e => setReport(p => ({ ...p, process_description: e.target.value }))} />
                  <textarea className="input-field w-full text-sm resize-none" rows={2} placeholder="Interview questions (one per line)"
                    value={report.questions} onChange={e => setReport(p => ({ ...p, questions: e.target.value }))} />
                  <textarea className="input-field w-full text-sm resize-none" rows={2} placeholder="Tips for others…"
                    value={report.tips} onChange={e => setReport(p => ({ ...p, tips: e.target.value }))} />
                  <button onClick={submitReport} disabled={submitting || !report.role.trim()}
                    className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Submit
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {company.interview_reports.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No reports yet — be the first to share.</p>
                )}
                {company.interview_reports.map(r => (
                  <div key={r.id} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{r.role}</span>
                      <div className="flex items-center gap-2">
                        {r.difficulty && <span className="text-xs text-slate-400">Difficulty: {r.difficulty}/5</span>}
                        {r.outcome && <span className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: r.outcome === "Offer" ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.1)",
                          color: r.outcome === "Offer" ? "#10b981" : "#94a3b8",
                        }}>{r.outcome}</span>}
                      </div>
                    </div>
                    {r.interview_rounds && <p className="text-xs text-slate-500 mb-1">{r.interview_rounds} rounds</p>}
                    {r.process_description && <p className="text-xs text-slate-400 mb-2">{r.process_description}</p>}
                    {r.questions?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold text-slate-500 mb-1">QUESTIONS ASKED</p>
                        <ul className="space-y-0.5">{r.questions.map((q,i) => <li key={i} className="text-xs text-slate-400">• {q}</li>)}</ul>
                      </div>
                    )}
                    {r.tips && <p className="text-xs text-emerald-400 italic">💡 {r.tips}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SALARY ── */}
        {activeTab === "salary" && (
          <div className="card p-5">
            {Object.keys(company.salary_ranges).length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No salary data yet.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(company.salary_ranges).map(([role, range]) => (
                  <div key={role} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{role}</span>
                      <span className="text-sm font-bold text-emerald-400">
                        ${Math.round(range.min / 1000)}k – ${Math.round(range.max / 1000)}k
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: "60%" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CULTURE ── */}
        {activeTab === "culture" && (
          <div className="space-y-4">
            {(ip.culture_signals || []).length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Culture Signals</h3>
                <div className="space-y-2">
                  {ip.culture_signals!.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="text-slate-500 mt-0.5">•</span>{s}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

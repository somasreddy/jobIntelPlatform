"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  Upload, Target, Activity, Briefcase,
  CheckCircle2, ArrowRight, Loader2, User,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
               : { "Content-Type": "application/json" };
}

const STEPS = [
  { id: 1, icon: User,     title: "Basic Info",      subtitle: "Who are you?" },
  { id: 2, icon: Upload,   title: "Resume",          subtitle: "Upload or paste" },
  { id: 3, icon: Target,   title: "Career Goals",    subtitle: "What are you targeting?" },
  { id: 4, icon: Activity, title: "Health Score",    subtitle: "See your score" },
  { id: 5, icon: Briefcase,title: "Job Matches",     subtitle: "Discover roles" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [healthScore, setHealthScore] = useState<number | null>(null);

  // Step 1 — basic info
  const [profile, setProfile] = useState({
    name: "", current_role: "", experience_years: 5,
    current_location: "", work_mode: "Any",
    skills: "", frameworks: "", current_salary: 0, currency: "USD",
  });

  // Step 2 — resume
  const [resumeText, setResumeText] = useState("");

  // Step 3 — goals
  const [goals, setGoals] = useState({
    target_role: "", target_salary_min: 0, target_salary_max: 0,
    timeline_months: 6, work_mode: "Remote", target_location: "",
  });

  const saveProfileAndAdvance = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/api/profile/`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          name: profile.name,
          current_role: profile.current_role,
          experience_years: profile.experience_years,
          current_location: profile.current_location,
          work_mode: profile.work_mode,
          skills: profile.skills.split(",").map(s => s.trim()).filter(Boolean),
          frameworks: profile.frameworks.split(",").map(s => s.trim()).filter(Boolean),
          current_salary: profile.current_salary || null,
          currency: profile.currency,
          base_resume_text: resumeText || null,
        }),
      });
      setStep(3);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const saveGoalsAndCompute = async () => {
    setSaving(true);
    try {
      // Save goal
      await fetch(`${API}/api/career-graph/goals`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(goals),
      });
      // Compute health
      const res = await fetch(`${API}/api/career-graph/compute-health`, {
        method: "POST",
        headers: authHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setHealthScore(data.health_score);
      }
      setStep(4);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const scoreColor = healthScore === null ? "#94a3b8"
    : healthScore >= 70 ? "#10b981" : healthScore >= 50 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--bg)" }}>

      {/* Progress bar */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center gap-1 mb-3">
          {STEPS.map(s => (
            <div key={s.id} className="flex-1 h-1 rounded-full transition-all duration-500"
              style={{ background: step >= s.id ? "var(--accent)" : "rgba(255,255,255,0.08)" }} />
          ))}
        </div>
        <div className="flex justify-between">
          {STEPS.map(s => (
            <div key={s.id} className="text-center" style={{ flex: 1 }}>
              <p className={`text-[9px] font-medium transition-colors ${step === s.id ? "text-white" : "text-slate-600"}`}>
                {s.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="card p-8 w-full max-w-lg">

        {/* ── STEP 1 — Basic Info ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent))" }}>
                <User className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Tell us about yourself</h2>
              <p className="text-sm text-slate-400 mt-1">This powers your personalised job matches</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                <input className="input-field w-full" placeholder="Jane Smith"
                  value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Current Role</label>
                <input className="input-field w-full" placeholder="Software Engineer"
                  value={profile.current_role} onChange={e => setProfile(p => ({ ...p, current_role: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Years of Experience</label>
                <input className="input-field w-full" type="number" min={0}
                  value={profile.experience_years} onChange={e => setProfile(p => ({ ...p, experience_years: +e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Location</label>
                <input className="input-field w-full" placeholder="Berlin, Germany"
                  value={profile.current_location} onChange={e => setProfile(p => ({ ...p, current_location: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Work Mode Preference</label>
                <select className="input-field w-full" value={profile.work_mode}
                  onChange={e => setProfile(p => ({ ...p, work_mode: e.target.value }))}>
                  {["Remote", "Hybrid", "On-site", "Any"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Current Salary (optional)</label>
                <div className="flex gap-1">
                  <select className="input-field w-20 shrink-0" value={profile.currency}
                    onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}>
                    {["USD", "EUR", "GBP", "INR", "CAD"].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input className="input-field flex-1" type="number" placeholder="120000"
                    value={profile.current_salary || ""} onChange={e => setProfile(p => ({ ...p, current_salary: +e.target.value }))} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Key Skills <span className="text-slate-600">(comma-separated)</span></label>
              <input className="input-field w-full" placeholder="Python, TypeScript, AWS"
                value={profile.skills} onChange={e => setProfile(p => ({ ...p, skills: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Frameworks / Tools <span className="text-slate-600">(comma-separated)</span></label>
              <input className="input-field w-full" placeholder="React, FastAPI, Docker, Kubernetes"
                value={profile.frameworks} onChange={e => setProfile(p => ({ ...p, frameworks: e.target.value }))} />
            </div>
            <button onClick={() => setStep(2)} disabled={!profile.name.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 font-semibold">
              Next: Upload Resume <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2 — Resume ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent))" }}>
                <Upload className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Your Resume</h2>
              <p className="text-sm text-slate-400 mt-1">Paste your resume text so AI can tailor everything to you</p>
            </div>
            <textarea
              className="input-field w-full resize-none text-sm"
              rows={10}
              placeholder="Paste your resume content here — work experience, skills, projects, education…"
              value={resumeText}
              onChange={e => setResumeText(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-3 font-semibold">← Back</button>
              <button onClick={saveProfileAndAdvance} disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {resumeText ? "Save & Continue" : "Skip for now"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — Goals ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent))" }}>
                <Target className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">What are you targeting?</h2>
              <p className="text-sm text-slate-400 mt-1">Set your goals so every recommendation is personalised</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="col-span-full">
                <label className="block text-xs text-slate-400 mb-1">Target Role</label>
                <input className="input-field w-full" placeholder="Senior Software Engineer"
                  value={goals.target_role} onChange={e => setGoals(p => ({ ...p, target_role: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min Salary (USD)</label>
                <input className="input-field w-full" type="number" placeholder="120000"
                  value={goals.target_salary_min || ""} onChange={e => setGoals(p => ({ ...p, target_salary_min: +e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Salary (USD)</label>
                <input className="input-field w-full" type="number" placeholder="180000"
                  value={goals.target_salary_max || ""} onChange={e => setGoals(p => ({ ...p, target_salary_max: +e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Timeline (months)</label>
                <select className="input-field w-full" value={goals.timeline_months}
                  onChange={e => setGoals(p => ({ ...p, timeline_months: +e.target.value }))}>
                  {[1,2,3,6,9,12].map(m => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Preferred Work Mode</label>
                <select className="input-field w-full" value={goals.work_mode}
                  onChange={e => setGoals(p => ({ ...p, work_mode: e.target.value }))}>
                  {["Remote", "Hybrid", "On-site", "Any"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-slate-400 mb-1">Target Location (optional)</label>
                <input className="input-field w-full" placeholder="San Francisco, Remote"
                  value={goals.target_location} onChange={e => setGoals(p => ({ ...p, target_location: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1 py-3 font-semibold">← Back</button>
              <button onClick={saveGoalsAndCompute} disabled={saving || !goals.target_role.trim()}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 font-semibold">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Computing…</> : <><ArrowRight className="w-4 h-4" /> Compute My Score</>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4 — Health Score Reveal ── */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--accent-deep), var(--accent))" }}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Your Career Health Score</h2>
              <p className="text-sm text-slate-400">Based on your profile, goals, and activity</p>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 160 160" className="-rotate-90 w-full h-full">
                  <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  <circle cx="80" cy="80" r="68" fill="none"
                    stroke={scoreColor} strokeWidth="12"
                    strokeDasharray={2 * Math.PI * 68}
                    strokeDashoffset={2 * Math.PI * 68 * (1 - (healthScore ?? 0) / 100)}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-white">{healthScore ?? "—"}</span>
                  <span className="text-xs text-slate-400">/ 100</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-400">
              {(healthScore ?? 0) >= 70
                ? "Great start! You're in solid shape for your job search."
                : "Your score will improve as you add more data — let's find your first matches."}
            </p>
            <button onClick={() => setStep(5)}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 font-semibold">
              See My Job Matches <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 5 — Done ── */}
        {step === 5 && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.15)", border: "2px solid #10b981" }}>
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">You&apos;re all set!</h2>
              <p className="text-sm text-slate-400">Your career intelligence platform is ready.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Job Matches", href: "/jobs", icon: "🎯" },
                { label: "Career Graph", href: "/career-graph", icon: "📊" },
                { label: "Profile", href: "/profile", icon: "👤" },
              ].map(({ label, href, icon }) => (
                <button key={href} onClick={() => router.push(href)}
                  className="card p-4 text-center hover:opacity-90 transition-opacity cursor-pointer">
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className="text-xs text-white font-medium">{label}</p>
                </button>
              ))}
            </div>
            <button onClick={() => router.push("/jobs")}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 font-semibold">
              <Briefcase className="w-5 h-5" /> Find My Jobs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

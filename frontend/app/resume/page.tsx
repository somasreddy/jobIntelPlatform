"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/ProfileContext";
import {
  FileText, CheckCircle, Upload, ShieldAlert, Sparkles,
  FileOutput, UserCircle2, Target, TrendingUp, AlertCircle, Plus,
  Download, Loader2
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// High-demand keywords used by ATS systems across all engineering roles
const ATS_KEYWORD_POOL = [
  "System Design", "Microservices", "REST APIs", "GraphQL", "Docker", "Kubernetes",
  "CI/CD", "GitHub Actions", "AWS", "Azure", "GCP", "Terraform", "Agile", "Scrum",
  "Code Review", "TDD", "Unit Testing", "Integration Testing", "End-to-End Testing",
  "Performance Testing", "Load Testing", "React", "Node.js", "TypeScript", "Python",
  "Java", "Go", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "Kafka", "Spark",
  "Machine Learning", "Data Pipelines", "Feature Engineering", "MLOps", "LLMs",
  "Playwright", "Selenium", "Cypress", "Jest", "Pytest", "Postman",
  "Jenkins", "ArgoCD", "Helm", "Prometheus", "Grafana", "OpenTelemetry",
];

function calcKeywordHeatmap(resumeText: string, profileSkills: string[]): {
  keyword: string; inResume: boolean; inProfile: boolean; priority: "High" | "Medium" | "Low";
}[] {
  const text = (resumeText || "").toLowerCase();
  const allSkills = profileSkills.map(s => s.toLowerCase());

  return ATS_KEYWORD_POOL.map((kw) => {
    const kwLower = kw.toLowerCase();
    return {
      keyword: kw,
      inResume: text.includes(kwLower),
      inProfile: allSkills.some(s => s.includes(kwLower) || kwLower.includes(s)),
      priority: ["System Design", "Microservices", "CI/CD", "Docker", "Kubernetes", "AWS", "TypeScript", "React", "Python", "Go"].includes(kw) ? "High"
        : ["REST APIs", "GraphQL", "PostgreSQL", "MongoDB", "Redis", "Kafka", "Agile", "TDD", "Playwright", "Jest"].includes(kw) ? "Medium"
        : "Low",
    };
  });
}

export default function ResumePage() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [heatmapJd, setHeatmapJd] = useState("");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const jdRef = useRef<HTMLTextAreaElement>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genResult, setGenResult] = useState<{ pdf_base64?: string; docx_base64?: string; summary?: string } | null>(null);

  const generateMasterResume = async () => {
    if (!profile) return;
    setGenerating(true);
    setGenError("");
    setGenResult(null);
    try {
      const res = await fetch(`${API}/api/resume/generate-master`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            name: profile.name,
            current_role: profile.currentRole,
            experience_years: profile.experienceYears,
            current_location: profile.currentLocation,
            work_mode: profile.workMode,
            skills: profile.skills,
            frameworks: profile.frameworks,
            languages: profile.languages,
            cicd_tools: profile.cicdTools,
            ai_tools: profile.aiTools,
            certifications: profile.certifications,
            base_resume_text: profile.resumeText,
          }
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).detail || `Error ${res.status}`);
      }
      setGenResult(await res.json());
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const downloadFile = (b64: string, filename: string, mime: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  };

  // Dynamic ATS score from profile completeness
  const score = (() => {
    if (!profile) return 0;
    let pts = 0;
    if (profile.name?.trim())                    pts += 12;
    if (profile.currentRole?.trim())             pts += 15;
    if (Number(profile.experienceYears) > 0)     pts += 10;
    if (Number(profile.currentSalary) > 0)       pts += 5;
    if (profile.currentLocation?.trim())         pts += 8;
    if (profile.skills?.length >= 3)             pts += 15;
    if (profile.skills?.length >= 8)             pts += 10;
    if (profile.frameworks?.length > 0)          pts += 8;
    if (profile.cicdTools?.length > 0)           pts += 7;
    if (profile.certifications?.length > 0)      pts += 5;
    if (profile.resumeText?.trim())              pts += 5;
    return Math.min(pts, 100);
  })();
  const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#f43f5e";
  const scoreLabel = score >= 80 ? "Strong" : score >= 60 ? "Fair" : "Needs Work";

  // Keyword heatmap
  const allProfileSkills = [
    ...(profile?.skills ?? []),
    ...(profile?.frameworks ?? []),
    ...(profile?.cicdTools ?? []),
    ...(profile?.languages ?? []),
  ];
  const resumeTextForHeatmap = heatmapJd
    ? (profile?.resumeText || "") + " " + heatmapJd
    : (profile?.resumeText || "");
  const heatmapData = calcKeywordHeatmap(resumeTextForHeatmap, allProfileSkills);
  const inResumeCount = heatmapData.filter(k => k.inResume || k.inProfile).length;
  const missingHigh = heatmapData.filter(k => !k.inResume && !k.inProfile && k.priority === "High");
  const coverageScore = Math.round((inResumeCount / heatmapData.length) * 100);

  if (!loading && !profile) {
    return (
      <div className="flex min-h-screen bg-transparent">
        <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <UserCircle2 className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-white font-semibold text-xl mb-2">No profile found</h2>
            <p className="text-slate-400 text-sm mb-6">
              Set up your career profile first — your master resume data will appear here automatically.
            </p>
            <button onClick={() => router.push("/")} className="btn-primary text-sm px-6 py-2.5">
              Set Up Profile
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-2">
            <FileOutput className="w-4 h-4" /> Base Resume Manager
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Your <span className="gradient-text">Master Profile</span>
              </h1>
              <p className="text-slate-400 text-sm max-w-2xl">
                This is your master profile. When you view a job in the{" "}
                <strong className="text-white">Jobs Dashboard</strong>, AI generates a highly-targeted ATS resume by merging this data with the job description.
              </p>
            </div>
            <a
              href="/resume/studio"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-all"
              style={{
                background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                border: "1px solid var(--border-hover)",
                color: "var(--accent-bright)",
              }}
            >
              <Target className="w-4 h-4" /> JD Match Studio
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Profile Data */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Extracted Profile Data
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm mb-6">
                <div><p className="text-slate-500 mb-1">Name</p><p className="font-medium text-white">{profile?.name || "—"}</p></div>
                <div><p className="text-slate-500 mb-1">Current Role</p><p className="font-medium text-white">{profile?.currentRole || "—"}</p></div>
                <div><p className="text-slate-500 mb-1">Experience</p><p className="font-medium text-white">{profile?.experienceYears ? `${profile.experienceYears} Years` : "—"}</p></div>
                <div><p className="text-slate-500 mb-1">Location</p><p className="font-medium text-white">{profile?.currentLocation || "—"}</p></div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Core Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile?.skills ?? []).length > 0
                      ? (profile?.skills ?? []).map(s => <span key={s} className="tag">{s}</span>)
                      : <span className="text-slate-500 text-sm">No skills added yet</span>}
                  </div>
                </div>
                {(profile?.frameworks ?? []).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Frameworks</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {(profile?.frameworks ?? []).map(s => <span key={s} className="tag">{s}</span>)}
                    </div>
                  </div>
                )}
                {(profile?.cicdTools ?? []).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2">CI/CD & DevOps</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {(profile?.cicdTools ?? []).map(s => <span key={s} className="tag">{s}</span>)}
                    </div>
                  </div>
                )}
                {profile?.resumeText && !profile.resumeText.startsWith("[Resume file:") && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Resume Text Loaded
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 font-mono">
                      {profile.resumeText.slice(0, 280)}…
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ATS Keyword Heatmap */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-rose-400" /> ATS Keyword Coverage Heatmap
                </h2>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${coverageScore >= 60 ? "text-emerald-400" : coverageScore >= 40 ? "text-amber-400" : "text-rose-400"}`}>
                    {coverageScore}% coverage
                  </span>
                  <button
                    onClick={() => { setShowHeatmap(p => !p); setTimeout(() => jdRef.current?.focus(), 100); }}
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> {showHeatmap ? "Hide" : "Add JD"} to analyse
                  </button>
                </div>
              </div>

              {/* Optional JD paste */}
              {showHeatmap && (
                <div className="mb-4">
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                    Paste a Job Description to check keyword match against your resume
                  </label>
                  <textarea
                    ref={jdRef}
                    className="input text-xs resize-none font-mono leading-relaxed"
                    rows={4}
                    placeholder="Paste the full job description here to see how well your resume keywords match…"
                    value={heatmapJd}
                    onChange={(e) => setHeatmapJd(e.target.value)}
                  />
                </div>
              )}

              {/* Coverage bar */}
              <div className="mb-4">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${coverageScore}%`,
                      background: coverageScore >= 60
                        ? "linear-gradient(90deg, #10b981, #34d399)"
                        : coverageScore >= 40
                        ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                        : "linear-gradient(90deg, #f43f5e, #fb7185)",
                    }}
                  />
                </div>
              </div>

              {/* Missing critical keywords */}
              {missingHigh.length > 0 && (
                <div className="mb-4 p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                  <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Missing High-Priority Keywords
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingHigh.map(k => (
                      <span key={k.keyword} className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium">
                        {k.keyword}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Add these to your profile or resume to improve ATS match by ~{missingHigh.length * 4}%</p>
                </div>
              )}

              {/* Keyword grid */}
              <div className="flex flex-wrap gap-1.5">
                {heatmapData.map((k) => {
                  const present = k.inResume || k.inProfile;
                  return (
                    <span
                      key={k.keyword}
                      title={present ? `✓ Found in your profile/resume` : `✗ Missing — add to improve ATS score`}
                      className={`text-[11px] px-2 py-0.5 rounded-md border font-medium transition-all ${
                        present
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                          : k.priority === "High"
                          ? "bg-rose-500/8 text-rose-400 border-rose-500/20"
                          : k.priority === "Medium"
                          ? "bg-amber-500/8 text-amber-500/80 border-amber-500/15"
                          : "bg-slate-800/40 text-slate-600 border-slate-700/30"
                      }`}
                    >
                      {present ? "✓" : "+"} {k.keyword}
                    </span>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/30 border border-emerald-500/50 inline-block" /> Present</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500/20 border border-rose-500/30 inline-block" /> Missing (High)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/15 border border-amber-500/20 inline-block" /> Missing (Medium)</span>
              </div>
            </div>

            {/* How AI Works */}
            <div className="card border-indigo-500/30 bg-indigo-500/5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">How AI Resume Generation Works</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-3">
                    AI merges your master profile, uploaded resume text, and the target job description to rewrite your experience bullets using the exact ATS keywords the JD requires. Matched keywords are bolded. Skills that appear in both your profile and the JD are prioritised.
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-indigo-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Profile + Resume + JD → ATS score 95%+</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* ATS Score Ring */}
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-6 text-center">Baseline ATS Score</h2>
              <div className="flex justify-center mb-3">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="absolute w-full h-full -rotate-90">
                    <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(18,26,56,0.9)" strokeWidth="8" />
                    <circle cx="64" cy="64" r="56" fill="none" stroke={scoreColor} strokeWidth="8"
                      strokeDasharray={56 * 2 * Math.PI}
                      strokeDashoffset={(56 * 2 * Math.PI) * (1 - score / 100)}
                      className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="text-center">
                    <span className="text-3xl font-bold" style={{ color: scoreColor }}>{score}</span>
                    <p className="text-[10px] font-semibold mt-0.5" style={{ color: scoreColor }}>{scoreLabel}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0" style={{ color: scoreColor }} />
                  <p className="text-slate-300">Base profile scores <strong className="text-white">{score}%</strong> against generic roles.</p>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-slate-300">AI-generated per-job resumes push match to <strong className="text-white">95%+</strong>.</p>
                </div>
              </div>
            </div>

            {/* Profile Completeness Checklist */}
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-4">Profile Completeness</h2>
              <div className="space-y-2">
                {[
                  { label: "Full Name", done: !!profile?.name?.trim() },
                  { label: "Current Role", done: !!profile?.currentRole?.trim() },
                  { label: "Experience Years", done: Number(profile?.experienceYears) > 0 },
                  { label: "Location", done: !!profile?.currentLocation?.trim() },
                  { label: "Skills (3+)", done: (profile?.skills?.length ?? 0) >= 3 },
                  { label: "Skills (8+)", done: (profile?.skills?.length ?? 0) >= 8 },
                  { label: "Resume Text", done: !!(profile?.resumeText?.trim() && !profile.resumeText.startsWith("[Resume file:")) },
                  { label: "Certifications", done: (profile?.certifications?.length ?? 0) > 0 },
                ].map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-slate-700/50 border border-slate-600"}`}>
                      {done && <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />}
                    </div>
                    <span className={done ? "text-slate-300" : "text-slate-500"}>{label}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push("/")} className="btn-secondary w-full mt-4 text-xs py-2">
                Edit Profile
              </button>
            </div>

            {/* Download Master ATS Resume */}
            <div className="card" style={{ border: "1px solid rgba(99,102,241,0.3)", background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))" }}>
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-4 h-4" style={{ color: "var(--accent-bright)" }} />
                <h2 className="text-sm font-semibold text-white">Download Master ATS Resume</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Merges your full profile + uploaded resume into a polished ATS-ready document. Uses AI to write your professional summary and format your experience.
              </p>

              {!genResult ? (
                <button
                  onClick={generateMasterResume}
                  disabled={generating || !profile?.name}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: generating ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, var(--accent-deep), var(--accent))",
                    opacity: generating || !profile?.name ? 0.6 : 1,
                    boxShadow: generating ? "none" : "0 4px 14px -4px var(--glow-accent)",
                  }}
                >
                  {generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                    : <><Sparkles className="w-4 h-4" /> Generate & Download</>
                  }
                </button>
              ) : (
                <div className="space-y-2">
                  {genResult.summary && (
                    <div className="rounded-xl p-3 mb-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                      <p className="text-xs font-semibold text-slate-400 mb-1">AI-Written Summary</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{genResult.summary}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {genResult.pdf_base64 && (
                      <button
                        onClick={() => downloadFile(genResult!.pdf_base64!, `${profile?.name?.replace(/\s+/g, "_") || "resume"}_ATS.pdf`, "application/pdf")}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
                        style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    )}
                    {genResult.docx_base64 && (
                      <button
                        onClick={() => downloadFile(genResult!.docx_base64!, `${profile?.name?.replace(/\s+/g, "_") || "resume"}_ATS.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
                        style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}
                      >
                        <Download className="w-3.5 h-3.5" /> DOCX
                      </button>
                    )}
                  </div>
                  <button
                    onClick={generateMasterResume}
                    disabled={generating}
                    className="w-full py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Regenerate
                  </button>
                </div>
              )}

              {genError && (
                <div className="mt-3 rounded-xl p-3 text-xs text-red-400" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {genError}
                </div>
              )}

              {!profile?.name && (
                <p className="text-xs text-slate-500 mt-2 text-center">Save your profile first to enable this.</p>
              )}
            </div>

            {/* Update Source Document */}
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-4">Update Source Document</h2>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${dragging ? "border-indigo-400 bg-indigo-500/10" : "border-slate-700/60 hover:border-indigo-500/40"}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="text-emerald-400 text-sm font-medium flex flex-col items-center">
                    <CheckCircle className="w-6 h-6 mb-2" />
                    {file.name}
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 mb-2">Drag & drop new resume</p>
                    <label className="btn-secondary text-xs cursor-pointer py-1.5 px-3">
                      Browse
                      <input type="file" accept=".pdf,.docx,.txt" className="hidden"
                        onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

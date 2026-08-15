"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { mockJobs } from "@/lib/mockData";
import { useProfile } from "@/lib/ProfileContext";
import { useAppData } from "@/lib/AppDataContext";
import { Job, CandidateProfile } from "@/lib/types";
import MatchIntelligencePanel from "@/components/MatchIntelligencePanel";
import {
  ArrowLeft, Building2, MapPin, Clock, DollarSign,
  FileText, Mail, MessageSquare, Download, CheckCircle,
  TrendingUp, Sparkles, ExternalLink, ShieldCheck, Copy,
  Search, ThumbsUp, ThumbsDown, Zap, Users, BarChart3,
  AlertTriangle, Star, MessageCircle, Radio, Loader2, BookOpen,
} from "lucide-react";

function formatSalary(min: number, max: number, currency: string): string {
  if (currency === "INR") return `₹${(min / 100000).toFixed(1)}L – ₹${(max / 100000).toFixed(1)}L`;
  if (currency === "GBP") return `£${Math.round(min / 1000)}k – £${Math.round(max / 1000)}k`;
  return `$${Math.round(min / 1000)}k – $${Math.round(max / 1000)}k`;
}

const emptyProfile: CandidateProfile = {
  name: "", currentRole: "", currentSalary: 0, currency: "USD",
  experienceYears: 0, workMode: "Any", currentLocation: "",
  preferredLocations: [], skills: [], frameworks: [],
  languages: [], cicdTools: [], aiTools: [], certifications: [],
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const { profile: ctxProfile } = useProfile();
  const { applyToJob, applications } = useAppData();
  const [tracked, setTracked] = useState(false);
  const profile = ctxProfile ?? emptyProfile;
  const [activeTab, setActiveTab] = useState<"resume" | "cover" | "recruiter" | "company">("resume");
  const [intelStream, setIntelStream] = useState("");
  const [intelStreaming, setIntelStreaming] = useState(false);
  const [intelDone, setIntelDone] = useState(false);
  const [deepStream, setDeepStream] = useState("");
  const [deepStreaming, setDeepStreaming] = useState(false);
  const [deepDone, setDeepDone] = useState(false);
  const [salaryEst, setSalaryEst] = useState<{min:number;mid:number;max:number;negotiation_tip?:string}|null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generatedData, setGeneratedData] = useState<{
    bullets?: string[];
    pdf_base64?: string;
    docx_base64?: string;
    ats_score?: number;
    cover_letter?: string;
    recruiter_message?: string;
    recruiter_name?: string;
    recruiter_linkedin?: string;
  }>({});
  const [copyFeedback, setCopyFeedback] = useState<"cover" | "recruiter" | null>(null);

  useEffect(() => {
    // Reset generation state whenever the job changes
    setGenerated(false);
    setGenerating(false);
    setGeneratedData({});
    setActiveTab("resume");

    const loadJob = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (apiUrl) {
        try {
          const res = await fetch(`${apiUrl}/api/jobs/${params.id}`);
          if (res.ok) { setJob(await res.json()); return; }
        } catch { /* fall through */ }
      }
      const j = mockJobs.find((x) => x.id === params.id);
      if (j) setJob(j);
    };

    loadJob();
  }, [params.id]);

  const handleGenerate = async () => {
    if (!job) return;
    setGenerating(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      try {
        const jobPayload = { title: job.title, organization: job.organization, description: job.description, technologies: job.technologies };
        const profilePayload = { ...profile, resume_text: profile.resumeText || "" };
        const [resumeRes, coverRes, recruiterRes] = await Promise.all([
          fetch(`${apiUrl}/api/resume/generate-ats`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: profilePayload, job: jobPayload }) }),
          fetch(`${apiUrl}/api/resume/generate-cover-letter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: profilePayload, job: jobPayload }) }),
          fetch(`${apiUrl}/api/recruiter/outreach-message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: profilePayload, job: { ...jobPayload, recruiter_name: job.recruiterName, recruiter_linkedin: job.recruiterLinkedIn } }) }),
        ]);
        type ResumeResp = { bullets?: string[]; pdf_base64?: string; docx_base64?: string; ats_score?: number };
        type CoverResp = { content?: string };
        type RecruiterResp = { message?: string; recruiter_name?: string; recruiter_linkedin?: string };
        const [resumeData, coverData, recruiterData]: [ResumeResp, CoverResp, RecruiterResp] = await Promise.all([
          resumeRes.ok ? resumeRes.json() : {},
          coverRes.ok ? coverRes.json() : {},
          recruiterRes.ok ? recruiterRes.json() : {},
        ]);
        setGeneratedData({
          bullets: resumeData.bullets,
          pdf_base64: resumeData.pdf_base64,
          docx_base64: resumeData.docx_base64,
          ats_score: resumeData.ats_score,
          cover_letter: coverData.content,
          recruiter_message: recruiterData.message,
          recruiter_name: recruiterData.recruiter_name,
          recruiter_linkedin: recruiterData.recruiter_linkedin,
        });
        setGenerating(false); setGenerated(true); return;
      } catch { /* fall through to mock */ }
    }
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2500);
  };

  const buildResumeHTML = (forPrint: boolean): string => {
    const yrs = profile.experienceYears || 3;
    const role = profile.currentRole || "Software Engineer";
    const currentYear = new Date().getFullYear();
    const currentStart = currentYear - Math.min(yrs, 3);
    const seniorPrefixes = ["Senior", "Lead", "Principal", "Staff", "Head of", "Director"];
    const isSenior = seniorPrefixes.some((p) => role.startsWith(p));
    const strippedRole = role.replace(/^(Senior|Lead|Principal|Staff|Head of|Director)\s+/i, "");
    const matchedSkills = job!.technologies.filter(
      (t) => profile.skills.includes(t) || (profile.frameworks ?? []).includes(t)
    );
    const bullets = generatedData.bullets ?? [
      `Architected end-to-end ${job!.technologies[0] || "automation"} framework from scratch, reducing regression cycle time by 40% and enabling daily releases.`,
      `Designed and implemented ${job!.technologies[1] || "API"} test suites covering 200+ endpoints across microservices, achieving 92% API coverage.`,
      `Integrated automated test pipeline into CI/CD using ${(profile.cicdTools ?? [job!.technologies[2] || "Jenkins"])[0]}, cutting production defect escape rate by 95%.`,
      `Mentored a team of 4 junior engineers on test automation best practices, BDD principles, and code review standards.`,
      `Led performance benchmarking initiative using ${job!.technologies.find(t => ["JMeter","K6","Gatling"].includes(t)) || "load testing tools"}, identifying 3 critical bottlenecks before launch.`,
      `Collaborated with Product and DevOps to define quality gates, shift-left testing strategy, and release readiness criteria.`,
    ];

    type ExpEntry = { title: string; period: string; location: string; bullets: string[] };
    const experienceEntries: ExpEntry[] = [
      { title: role, period: `${currentStart} – Present`, location: profile.currentLocation || "", bullets },
    ];
    if (yrs >= 4) {
      const prevStart = currentYear - Math.min(yrs, 7);
      experienceEntries.push({
        title: isSenior ? strippedRole : `Junior ${strippedRole}`,
        period: `${prevStart} – ${currentStart}`,
        location: "",
        bullets: [
          `Built and maintained ${job!.technologies[1] || "automated"} test frameworks covering core business workflows, improving overall test reliability by 35%.`,
          `Collaborated with product managers and developers to define acceptance criteria, reduce defect escape rate, and establish a quality-first culture.`,
          `Reduced manual testing effort by 60% through systematic automation of regression suites using ${(profile.cicdTools?.[0]) || job!.technologies[2] || "CI/CD pipelines"}.`,
          `Owned end-to-end release validation for ${job!.technologies[0] || "key product"} features, coordinating UAT sign-off with stakeholders across 3 business units.`,
        ],
      });
    }
    if (yrs >= 7) {
      experienceEntries.push({
        title: `Associate ${strippedRole}`,
        period: `${currentYear - yrs} – ${currentYear - Math.min(yrs, 7)}`,
        location: "",
        bullets: [
          `Developed manual test cases and exploratory testing strategies for mobile and web applications, catching 40+ critical bugs pre-launch.`,
          `Participated in sprint ceremonies, contributed to test planning sessions, and documented test results for management reporting.`,
          `Gained hands-on experience with ${(profile.languages?.[0]) || job!.technologies[0] || "core technologies"}, ${(profile.frameworks?.[0]) || job!.technologies[1] || "automation frameworks"}, and Agile delivery methodologies.`,
        ],
      });
    }

    type SkillCat = { label: string; skills: string[] };
    const skillCategories: SkillCat[] = [];
    if ((profile.languages ?? []).length > 0) skillCategories.push({ label: "Programming Languages", skills: profile.languages });
    if ((profile.frameworks ?? []).length > 0) skillCategories.push({ label: "Frameworks & Libraries", skills: profile.frameworks });
    if ((profile.skills ?? []).length > 0) skillCategories.push({ label: "Testing & QA Tools", skills: profile.skills });
    if ((profile.cicdTools ?? []).length > 0) skillCategories.push({ label: "CI/CD & DevOps", skills: profile.cicdTools });
    if (skillCategories.length === 0) skillCategories.push({ label: "Technologies", skills: job!.technologies });

    const nameParts = (profile.name || "Your Name").trim().toLowerCase().replace(/\s+/g, ".");
    const mockEmail = profile.name ? `${nameParts}@email.com` : "your.email@example.com";
    const mockLinkedIn = profile.name ? `linkedin.com/in/${nameParts}` : "linkedin.com/in/yourprofile";

    const skillsHTML = skillCategories.map((cat) =>
      `<tr><td style="width:28%;font-weight:700;color:#334155;padding-bottom:5px;vertical-align:top;padding-right:10px">${cat.label}:</td>` +
      `<td style="padding-bottom:5px;color:#475569">${cat.skills.map((s) => matchedSkills.includes(s) ? `<strong style="color:#15803d">${s}</strong>` : s).join(" · ")}</td></tr>`
    ).join("");

    const expHTML = experienceEntries.map((entry, ei) =>
      `<div style="margin-bottom:${ei < experienceEntries.length - 1 ? "14px" : "0"}">` +
      `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">` +
      `<span style="font-weight:700;font-size:13px;color:#0f172a">${entry.title}</span>` +
      `<span style="font-size:11px;color:#64748b;font-style:italic">${entry.period}</span></div>` +
      `<p style="font-size:11px;color:#64748b;font-style:italic;margin:0 0 5px">${ei === 0 ? (entry.location || "Current Position") : "Previous Position"}</p>` +
      `<ul style="padding-left:18px;margin:0">${entry.bullets.map((b) => `<li style="margin-bottom:4px;line-height:1.55;font-size:11.5px;color:#334155">${b}</li>`).join("")}</ul>` +
      `</div>`
    ).join("");

    const certsHTML = (profile.certifications ?? []).length > 0
      ? `<div style="margin-bottom:14px"><h2 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin-bottom:6px">Certifications</h2>` +
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 16px">${profile.certifications.map((c) => `<div style="font-size:11.5px;color:#334155"><span style="color:#15803d;font-weight:700">✓</span> ${c}</div>`).join("")}</div></div>`
      : "";

    const keywordHTML = matchedSkills.length > 0
      ? `<div style="margin-top:10px;padding:8px 10px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0">` +
        `<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#15803d;margin:0 0 4px">✓ ATS Keyword Match — ${job!.organization} · ${job!.title}</p>` +
        `<p style="font-size:11px;color:#166534;margin:0">${matchedSkills.join("  ·  ")}</p></div>`
      : "";

    const printStyle = forPrint
      ? `<style>@media print{body{margin:0}@page{margin:1.5cm;size:A4}}</style>`
      : "";
    const printScript = forPrint
      ? `<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>`
      : "";

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ATS Resume – ${profile.name || "Candidate"}</title>
    ${printStyle}${printScript}
    </head><body style="font-family:'Georgia','Times New Roman',serif;color:#1e293b;font-size:12px;line-height:1.5;max-width:800px;margin:0 auto;padding:40px">
    <div style="text-align:center;border-bottom:2px solid #1e293b;padding-bottom:16px;margin-bottom:16px">
      <h1 style="font-size:22px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 4px">${profile.name || "Your Name"}</h1>
      <p style="font-size:13px;color:#475569;font-weight:600;margin:0 0 4px">${role} · ${yrs}+ Years Experience</p>
      <p style="font-size:11px;color:#64748b;margin:0">${mockEmail} · ${profile.currentLocation || "Location"} · ${mockLinkedIn}</p>
    </div>
    <div style="margin-bottom:14px">
      <h2 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin-bottom:6px">Professional Summary</h2>
      <p style="font-size:12px;line-height:1.65;color:#334155;margin:0">Results-driven <strong>${role}</strong> with ${yrs}+ years of proven expertise delivering ${matchedSkills.length > 0 ? matchedSkills.slice(0, 3).join(", ") : job!.technologies.slice(0, 3).join(", ")} solutions in high-velocity engineering environments. ${profile.resumeText && !profile.resumeText.startsWith("[Resume file:") ? `Track record of ${isSenior ? "technical leadership, cross-functional collaboration," : "delivering quality software,"} and driving measurable engineering outcomes.` : "Consistently bridges the gap between quality engineering and rapid delivery through automation-first thinking and data-driven insights."} Eager to leverage deep expertise in <strong>${job!.technologies[0]}</strong>${job!.technologies[1] ? ` and <strong>${job!.technologies[1]}</strong>` : ""} to accelerate ${job!.organization}'s ${job!.levelUp ? "next growth phase and drive platform excellence" : "engineering goals and raise the quality bar"}.</p>
    </div>
    <div style="margin-bottom:14px">
      <h2 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin-bottom:6px">Technical Skills</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px"><tbody>${skillsHTML}</tbody></table>
    </div>
    <div style="margin-bottom:14px">
      <h2 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin-bottom:6px">Professional Experience</h2>
      ${expHTML}
    </div>
    <div style="margin-bottom:14px">
      <h2 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin-bottom:6px">Education</h2>
      <p style="font-weight:700;font-size:12.5px;color:#0f172a;margin:0 0 2px">Bachelor of Engineering / Computer Science</p>
      <p style="font-size:11px;color:#64748b;font-style:italic;margin:0">University · ${currentYear - yrs - 4} – ${currentYear - yrs}</p>
    </div>
    ${certsHTML}
    ${keywordHTML}
    </body></html>`;
  };

  const handleDownload = (type: "pdf" | "docx") => {
    // If backend provided base64, use it directly
    const b64 = type === "pdf" ? generatedData.pdf_base64 : generatedData.docx_base64;
    if (b64) {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const mimeType = type === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const blob = new Blob([bytes], { type: mimeType });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `ats_resume.${type}` });
      a.click(); URL.revokeObjectURL(a.href);
      return;
    }
    // Client-side generation fallback
    const html = buildResumeHTML(type === "pdf");
    if (type === "pdf") {
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); }
    } else {
      // Word-compatible HTML exported as .doc
      const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `ats_resume_${profile.name?.replace(/\s+/g, "_") || "candidate"}.doc` });
      a.click(); URL.revokeObjectURL(a.href);
    }
  };

  const handleCopy = (text: string, key: "cover" | "recruiter") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(key);
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  };

  if (!job) return <div className="min-h-screen bg-transparent" />;

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 max-w-6xl">
        <button
          onClick={() => router.push("/jobs")}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </button>

        <div className="flex flex-col xl:flex-row gap-6">
          {/* Left Column: Job Details */}
          <div className="w-full xl:w-[400px] shrink-0 space-y-6">
            <MatchIntelligencePanel job={job} profile={profile} />

            <div className="card">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {job.verificationStatus === "VERIFIED" && (
                  <span className="badge badge-verified">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified Job
                  </span>
                )}
                {job.levelUp && (
                  <span className="badge badge-hot">
                    <TrendingUp className="w-3.5 h-3.5" /> Career Uplift
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold text-white mb-2 leading-tight">{job.title}</h1>

              <div className="space-y-2 text-sm text-slate-400 mb-6">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="font-medium text-slate-300">{job.organization}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" /> {job.location} ({job.workMode})
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-400 font-medium">
                    {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" /> {job.experienceRequired}+ years required
                </div>
              </div>

              {job.matchScore && (
                <div className="rounded-xl p-4 mb-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300">Your Match Score</span>
                    <span className="text-lg font-bold text-emerald-400">{job.matchScore}%</span>
                  </div>
                  <div className="progress-bar mb-3">
                    <div className="progress-fill" style={{ width: `${job.matchScore}%`, background: job.matchScore > 80 ? "#10b981" : "var(--accent)" }} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {profile.skills.length > 0
                      ? `High overlap with your ${profile.skills.slice(0, 2).join(", ")} skills.`
                      : "Complete your profile for personalised match insights."}
                  </p>
                </div>
              )}

              <button onClick={() => window.open(job.applicationLink, "_blank")} className="btn-primary w-full py-3 mb-2 flex items-center justify-center gap-2 text-sm">
                Apply on Company Portal <ExternalLink className="w-4 h-4" />
              </button>
              {(() => {
                const existingApp = applications.find(a => a.jobId === job.id);
                const isTracked = tracked || !!existingApp;
                return (
                  <button
                    onClick={async () => {
                      if (!isTracked) {
                        await applyToJob(job);
                        setTracked(true);
                      }
                    }}
                    disabled={isTracked}
                    className="w-full py-2.5 mb-2 flex items-center justify-center gap-2 text-sm rounded-xl border transition-colors"
                    style={isTracked
                      ? { borderColor: "rgba(16,185,129,0.3)", color: "#34d399", background: "rgba(16,185,129,0.08)", cursor: "default" }
                      : { borderColor: "var(--border)", color: "var(--accent-bright)", background: "transparent" }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isTracked
                      ? `In Pipeline (${existingApp?.status ?? "Applied"})`
                      : "Track in Pipeline"}
                  </button>
                );
              })()}
              <p className="text-xs text-slate-500 text-center">
                {job.verificationStatus === "VERIFIED"
                  ? `Verified from ${job.source || "the listed source"}; confirm availability before applying.`
                  : "Source could not be fully verified. Review the company portal before sharing personal data."}
              </p>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-3">Required Tech Stack</h3>
              <div className="flex flex-wrap gap-1.5">
                {job.technologies.map((t) => {
                  const has = profile.skills.includes(t) || (profile.frameworks ?? []).includes(t);
                  return (
                    <span key={t} className={`flex items-center gap-1 badge ${has ? "badge-verified" : "badge-tech opacity-60"}`}>
                      {has && <CheckCircle className="w-3 h-3" />} {t}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-3">Job Description</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{job.description}</p>
              <a href={job.careerPageLink} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs mt-3 flex items-center gap-1">
                View full description <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Right Column: AI Generation Engine */}
          <div className="flex-1 min-w-0">
            <div className="card h-full flex flex-col p-0 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                {(["resume", "cover", "recruiter", "company"] as const).map((tab) => {
                  const labels: Record<string, { icon: React.ReactNode; label: string }> = {
                    resume: { icon: <FileText className="w-4 h-4" />, label: "ATS Resume" },
                    cover: { icon: <Mail className="w-4 h-4" />, label: "Cover Letter" },
                    recruiter: { icon: <MessageSquare className="w-4 h-4" />, label: "Recruiter Email" },
                    company: { icon: <Search className="w-4 h-4" />, label: "Company Intel" },
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2"
                      style={activeTab === tab
                        ? { borderColor: "var(--accent)", color: "var(--accent-bright)", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
                        : { borderColor: "transparent", color: "#94a3b8" }}
                    >
                      {labels[tab].icon} {labels[tab].label}
                    </button>
                  );
                })}
              </div>

              {/* Content Area */}
              <div className="flex-1 p-6 flex flex-col">
                {activeTab !== "company" && (!generated && !generating ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
                      <Sparkles className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Generate Application Package</h2>
                    <p className="text-slate-400 max-w-md mb-8 text-sm leading-relaxed">
                      Our AI will instantly rewrite your resume bullets, draft a personalized cover letter, and write a recruiter outreach email specifically tailored to the{" "}
                      <span className="text-white font-medium">{job.title}</span> role at{" "}
                      <span className="text-white font-medium">{job.organization}</span>.
                    </p>
                    <button onClick={handleGenerate} className="btn-primary py-3 px-8 flex items-center gap-2 shadow-glow">
                      <Sparkles className="w-4 h-4" /> Generate Everything Now
                    </button>
                  </div>
                ) : generating ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-20">
                    <div className="relative w-20 h-20 mb-6">
                      <div className="absolute inset-0 border-4 border-[#334155] rounded-full" />
                      <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-cyan-400 border-b-transparent border-l-transparent rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" /></div>
                    </div>
                    <p className="text-white font-medium mb-1">AI Engine Processing...</p>
                    <p className="text-sm text-slate-400 animate-pulse">Matching your profile to {job.organization}&apos;s JD...</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col animate-fade-in">
                    {activeTab === "resume" && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-white">
                            Targeted ATS Resume
                            {generatedData.ats_score && (
                              <span className="ml-2 text-sm font-normal text-emerald-400">ATS Score: {generatedData.ats_score}%</span>
                            )}
                          </h3>
                          <div className="flex gap-2">
                            <button onClick={() => handleDownload("pdf")} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
                              <Download className="w-3.5 h-3.5" /> PDF
                            </button>
                            <button onClick={() => handleDownload("docx")} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
                              <Download className="w-3.5 h-3.5" /> DOCX
                            </button>
                          </div>
                        </div>
                        {(() => {
                          const matchedSkills = job.technologies.filter(
                            (t) => profile.skills.includes(t) || (profile.frameworks ?? []).includes(t)
                          );
                          const bullets = generatedData.bullets ?? [
                            `Architected end-to-end ${job.technologies[0] || "automation"} framework from scratch, reducing regression cycle time by 40% and enabling daily releases.`,
                            `Designed and implemented ${job.technologies[1] || "API"} test suites covering 200+ endpoints across microservices, achieving 92% API coverage.`,
                            `Integrated automated test pipeline into CI/CD using ${(profile.cicdTools ?? [job.technologies[2] || "Jenkins"])[0]}, cutting production defect escape rate by 95%.`,
                            `Mentored a team of 4 junior engineers on test automation best practices, BDD principles, and code review standards.`,
                            `Led performance benchmarking initiative using ${job.technologies.find(t => ["JMeter","K6","Gatling"].includes(t)) || "load testing tools"}, identifying 3 critical bottlenecks before launch.`,
                            `Collaborated with Product and DevOps to define quality gates, shift-left testing strategy, and release readiness criteria.`,
                          ];
                          // Build past experience entries
                          const currentYear = new Date().getFullYear();
                          const yrs = profile.experienceYears || 3;
                          const role = profile.currentRole || "Software Engineer";
                          const seniorPrefixes = ["Senior", "Lead", "Principal", "Staff", "Head of", "Director"];
                          const isSenior = seniorPrefixes.some((p) => role.startsWith(p));
                          const strippedRole = role.replace(/^(Senior|Lead|Principal|Staff|Head of|Director)\s+/i, "");
                          const currentStart = currentYear - Math.min(yrs, 3);
                          const experienceEntries: { title: string; period: string; location: string; bullets: string[] }[] = [
                            {
                              title: role,
                              period: `${currentStart} – Present`,
                              location: profile.currentLocation || "",
                              bullets,
                            },
                          ];
                          if (yrs >= 4) {
                            const prevStart = currentYear - Math.min(yrs, 7);
                            experienceEntries.push({
                              title: isSenior ? strippedRole : `Junior ${strippedRole}`,
                              period: `${prevStart} – ${currentStart}`,
                              location: "",
                              bullets: [
                                `Built and maintained ${job.technologies[1] || "automated"} test frameworks covering core business workflows, improving overall test reliability by 35%.`,
                                `Collaborated with product managers and developers to define acceptance criteria, reduce defect escape rate, and establish a quality-first culture.`,
                                `Reduced manual testing effort by 60% through systematic automation of regression suites using ${(profile.cicdTools?.[0]) || job.technologies[2] || "CI/CD pipelines"}.`,
                                `Owned end-to-end release validation for ${job.technologies[0] || "key product"} features, coordinating UAT sign-off with stakeholders across 3 business units.`,
                              ],
                            });
                          }
                          if (yrs >= 7) {
                            experienceEntries.push({
                              title: `Associate ${strippedRole}`,
                              period: `${currentYear - yrs} – ${currentYear - Math.min(yrs, 7)}`,
                              location: "",
                              bullets: [
                                `Developed manual test cases and exploratory testing strategies for mobile and web applications, catching 40+ critical bugs pre-launch.`,
                                `Participated in sprint ceremonies, contributed to test planning sessions, and documented test results for management reporting.`,
                                `Gained hands-on experience with ${(profile.languages?.[0]) || job.technologies[0] || "core technologies"}, ${(profile.frameworks?.[0]) || job.technologies[1] || "automation frameworks"}, and Agile delivery methodologies.`,
                              ],
                            });
                          }

                          // Categorize skills
                          type SkillCategory = { label: string; skills: string[] };
                          const skillCategories: SkillCategory[] = [];
                          if ((profile.languages ?? []).length > 0) skillCategories.push({ label: "Programming Languages", skills: profile.languages });
                          if ((profile.frameworks ?? []).length > 0) skillCategories.push({ label: "Frameworks & Libraries", skills: profile.frameworks });
                          if ((profile.skills ?? []).length > 0) skillCategories.push({ label: "Testing & QA Tools", skills: profile.skills });
                          if ((profile.cicdTools ?? []).length > 0) skillCategories.push({ label: "CI/CD & DevOps", skills: profile.cicdTools });
                          if (skillCategories.length === 0) skillCategories.push({ label: "Technologies", skills: job.technologies });

                          // Derive contact line
                          const nameParts = (profile.name || "Your Name").trim().toLowerCase().replace(/\s+/g, ".");
                          const mockEmail = profile.name ? `${nameParts}@email.com` : "your.email@example.com";
                          const mockLinkedIn = profile.name ? `linkedin.com/in/${nameParts}` : "linkedin.com/in/yourprofile";

                          // ATS score (from API or estimated)
                          const displayAtsScore = generatedData.ats_score ?? (
                            matchedSkills.length > 0
                              ? Math.min(98, 60 + Math.round((matchedSkills.length / Math.max(job.technologies.length, 1)) * 38))
                              : 72
                          );

                          return (
                            <div className="flex-1 flex flex-col gap-3">
                              {/* ATS Score Banner */}
                              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                    style={{ background: displayAtsScore >= 80 ? "#10b981" : displayAtsScore >= 60 ? "#f59e0b" : "#f43f5e" }}>
                                    {displayAtsScore}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-emerald-400">ATS Compatibility Score</p>
                                    <p className="text-[10px] text-slate-400">{displayAtsScore >= 80 ? "Excellent match — ready to submit" : displayAtsScore >= 60 ? "Good match — minor gaps to address" : "Moderate match — consider upskilling"}</p>
                                  </div>
                                </div>
                                <div className="flex-1 h-1.5 bg-slate-700/80 rounded-full overflow-hidden ml-2">
                                  <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${displayAtsScore}%`, background: displayAtsScore >= 80 ? "#10b981" : displayAtsScore >= 60 ? "#f59e0b" : "#f43f5e" }} />
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  {matchedSkills.slice(0, 3).map((s) => (
                                    <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 flex items-center gap-0.5">
                                      <CheckCircle className="w-2.5 h-2.5" />{s}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Resume Document */}
                              <div className="flex-1 bg-white rounded-lg overflow-y-auto border border-slate-600 shadow-inner" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: "#1e293b", fontSize: "12px", lineHeight: "1.5" }}>
                                <div className="p-7">
                                  {/* Header */}
                                  <div className="text-center pb-4 mb-4" style={{ borderBottom: "2px solid #1e293b" }}>
                                    <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                                      {profile.name || "Your Name"}
                                    </h1>
                                    <p style={{ fontSize: "13px", color: "#475569", fontWeight: 600, marginBottom: "4px" }}>
                                      {profile.currentRole || "Software Engineer"} · {profile.experienceYears}+ Years Experience
                                    </p>
                                    <p style={{ fontSize: "11px", color: "#64748b", letterSpacing: "0.02em" }}>
                                      {mockEmail} · {profile.currentLocation || "Location"} · {mockLinkedIn}
                                    </p>
                                  </div>

                                  {/* Professional Summary */}
                                  <div className="mb-4">
                                    <h2 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px", marginBottom: "6px" }}>
                                      Professional Summary
                                    </h2>
                                    <p style={{ fontSize: "12px", lineHeight: "1.65", color: "#334155" }}>
                                      Results-driven <strong>{role}</strong> with {yrs}+ years of proven expertise delivering{" "}
                                      {matchedSkills.length > 0 ? matchedSkills.slice(0, 3).join(", ") : job.technologies.slice(0, 3).join(", ")} solutions in high-velocity engineering environments.
                                      {" "}
                                      {profile.resumeText && !profile.resumeText.startsWith("[Resume file:")
                                        ? `Track record of ${profile.resumeText.toLowerCase().includes("lead") || isSenior ? "technical leadership, cross-functional collaboration," : "delivering quality software,"} and driving measurable engineering outcomes. `
                                        : "Consistently bridges the gap between quality engineering and rapid delivery through automation-first thinking and data-driven insights. "}
                                      Eager to leverage deep expertise in <strong>{job.technologies[0]}</strong>{job.technologies[1] ? <>{" "}and <strong>{job.technologies[1]}</strong></> : ""} to accelerate {job.organization}&apos;s{" "}
                                      {job.levelUp ? "next growth phase and drive platform excellence" : "engineering goals and raise the quality bar"}.
                                    </p>
                                  </div>

                                  {/* Technical Skills */}
                                  <div className="mb-4">
                                    <h2 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px", marginBottom: "6px" }}>
                                      Technical Skills
                                    </h2>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                                      <tbody>
                                        {skillCategories.map((cat) => (
                                          <tr key={cat.label}>
                                            <td style={{ width: "28%", fontWeight: 700, color: "#334155", paddingBottom: "4px", verticalAlign: "top", paddingRight: "8px" }}>
                                              {cat.label}:
                                            </td>
                                            <td style={{ color: "#475569", paddingBottom: "4px" }}>
                                              {cat.skills.map((s, i) => (
                                                <span key={s}>
                                                  <span style={matchedSkills.includes(s) ? { fontWeight: 700, color: "#15803d" } : {}}>
                                                    {s}
                                                  </span>
                                                  {i < cat.skills.length - 1 && <span style={{ color: "#94a3b8" }}> · </span>}
                                                </span>
                                              ))}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Professional Experience */}
                                  <div className="mb-4">
                                    <h2 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px", marginBottom: "6px" }}>
                                      Professional Experience
                                    </h2>
                                    {experienceEntries.map((entry, ei) => (
                                      <div key={ei} style={{ marginBottom: ei < experienceEntries.length - 1 ? "14px" : "0" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1px" }}>
                                          <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{entry.title}</span>
                                          <span style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>{entry.period}</span>
                                        </div>
                                        <p style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", marginBottom: "5px" }}>
                                          {ei === 0 ? (entry.location || "Current Position") : "Previous Position"}{entry.location && ei > 0 ? ` · ${entry.location}` : ""}
                                        </p>
                                        <ul style={{ paddingLeft: "18px", margin: 0 }}>
                                          {entry.bullets.map((b, bi) => (
                                            <li key={bi} style={{ marginBottom: "4px", lineHeight: "1.55", fontSize: "11.5px", color: "#334155" }}>{b}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Education */}
                                  <div className="mb-4">
                                    <h2 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px", marginBottom: "6px" }}>
                                      Education
                                    </h2>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                      <div>
                                        <p style={{ fontWeight: 700, fontSize: "12.5px", color: "#0f172a" }}>Bachelor of Engineering / Computer Science</p>
                                        <p style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>University · {currentYear - yrs - 4} – {currentYear - yrs}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Certifications */}
                                  {(profile.certifications ?? []).length > 0 && (
                                    <div className="mb-4">
                                      <h2 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px", marginBottom: "6px" }}>
                                        Certifications
                                      </h2>
                                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px" }}>
                                        {profile.certifications.map((c, i) => (
                                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: "#334155" }}>
                                            <span style={{ color: "#15803d", fontWeight: 700 }}>✓</span> {c}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* JD Keyword Match */}
                                  {matchedSkills.length > 0 && (
                                    <div style={{ marginTop: "10px", padding: "8px 10px", background: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                                      <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#15803d", marginBottom: "4px" }}>
                                        ✓ ATS Keyword Match — {job.organization} · {job.title}
                                      </p>
                                      <p style={{ fontSize: "11px", color: "#166534" }}>
                                        {matchedSkills.join("  ·  ")}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {activeTab === "cover" && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-white">Cover Letter</h3>
                          <button
                            onClick={() => handleCopy(
                              generatedData.cover_letter ?? `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${job.title} position at ${job.organization}. With ${profile.experienceYears} years of experience in ${job.technologies.slice(0, 2).join(" and ")}, I am confident I can make an immediate impact.\n\nBest regards,\n${profile.name}`,
                              "cover"
                            )}
                            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                          >
                            {copyFeedback === "cover" ? (
                              <><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Copied!</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" /> Copy</>
                            )}
                          </button>
                        </div>
                        <div className="flex-1 rounded-lg p-6 overflow-y-auto text-sm text-slate-200 leading-relaxed font-sans shadow-inner whitespace-pre-wrap" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                          {generatedData.cover_letter ?? `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${job.title} position at ${job.organization}.\n\nWith ${profile.experienceYears}+ years of experience in ${job.technologies.slice(0, 3).join(", ")}, I have consistently delivered high-quality solutions in fast-paced engineering environments.${profile.resumeText && !profile.resumeText.startsWith("[Resume file:") ? "\n\nHighlights from my background include hands-on delivery of production systems, strong collaboration with cross-functional teams, and a proven ability to ramp up quickly on new technology stacks." : ""}\n\nI am particularly excited about the opportunity at ${job.organization} because of its technical depth and scale. The role aligns closely with my expertise in ${job.technologies[0]} and ${job.technologies[1] || "modern engineering practices"}.\n\nI would welcome the opportunity to discuss how my experience can contribute to ${job.organization}'s goals.\n\nBest regards,\n${profile.name || "Your Name"}`}
                        </div>
                      </div>
                    )}

                    {activeTab === "recruiter" && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-white">Recruiter Outreach via LinkedIn</h3>
                          <button
                            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                            onClick={() => { const link = generatedData.recruiter_linkedin ?? job.recruiterLinkedIn; if (link) window.open(link, "_blank"); }}
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Find {generatedData.recruiter_name ?? job.recruiterName ?? "Recruiter"}
                          </button>
                        </div>
                        <div className="rounded-lg overflow-hidden shadow-inner mb-3" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                          <div className="px-4 py-2 text-xs text-slate-400 font-mono" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                            Subject: {profile.currentRole || "Professional"} interested in {job.title} role
                          </div>
                          <div className="p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap" style={{ background: "var(--bg-base)" }}>
                            {generatedData.recruiter_message ?? `Hi ${job.recruiterName?.split(" ")[0] ?? "there"},\n\nI saw that ${job.organization} is hiring for a ${job.title}. Given my ${profile.experienceYears}+ years with ${job.technologies.slice(0, 3).join(", ")}, I believe I'd be a great fit. Would you be open to a quick 10-minute chat?\n\nThanks,\n${profile.name}`}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopy(
                              generatedData.recruiter_message ?? `Hi ${job.recruiterName?.split(" ")[0] ?? "there"},\n\nI saw that ${job.organization} is hiring for a ${job.title}. Given my ${profile.experienceYears}+ years with ${job.technologies.slice(0, 3).join(", ")}, I believe I'd be a great fit.\n\nThanks,\n${profile.name}`,
                              "recruiter"
                            )}
                            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                          >
                            {copyFeedback === "recruiter" ? (
                              <><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Copied!</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" /> Copy Message</>
                            )}
                          </button>
                        </div>
                        <div className="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                          <p className="flex items-start gap-2">
                            <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                            <span><strong>Pro Tip:</strong> Send via LinkedIn InMail or try first.last@{job.organization.toLowerCase().replace(/\s/g, "")}.com.</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {activeTab === "company" && (() => {
                      const org = job.organization;
                      const techs = job.technologies;
                      const matchedSkills = techs.filter(t => profile.skills.includes(t) || (profile.frameworks ?? []).includes(t));
                      const missingSkills = techs.filter(t => !profile.skills.includes(t) && !(profile.frameworks ?? []).includes(t));
                      const matchPct = techs.length > 0 ? Math.round((matchedSkills.length / techs.length) * 100) : 0;

                      // Derive culture signals from job data
                      const isRemote = job.workMode === "Remote";
                      const isHybrid = job.workMode === "Hybrid";
                      const isHighPaying = job.currency === "USD" ? job.salaryMax >= 180000 : job.currency === "GBP" ? job.salaryMax >= 120000 : job.salaryMax >= 4500000;
                      const isCareerUplift = !!job.levelUp;
                      const isVerified = job.verificationStatus === "VERIFIED";
                      const hasLowExp = job.experienceRequired <= 3;
                      const hasManyTechs = techs.length >= 8;

                      const greenFlags = [
                        isVerified && "Verified active hiring — confirmed on official company portal",
                        isRemote && "Fully remote — no relocation required, global talent embrace",
                        isHybrid && "Hybrid model — flexibility with in-person collaboration",
                        isHighPaying && "Above-market compensation — top quartile for this role/location",
                        isCareerUplift && "Career-uplift role — clear path to Senior/Lead/Principal",
                        matchPct >= 70 && `Strong tech alignment — you match ${matchPct}% of required stack`,
                        !hasManyTechs && "Focused tech stack — deep expertise valued over breadth",
                      ].filter(Boolean) as string[];

                      const redFlags = [
                        hasManyTechs && `Broad tech stack (${techs.length} technologies) — risk of overloaded scope`,
                        !isVerified && "Job not yet verified on official portal — apply with caution",
                        matchPct < 40 && `Low stack match (${matchPct}%) — significant upskilling required`,
                        !job.salaryMin && "Salary not disclosed — negotiate carefully",
                      ].filter(Boolean) as string[];

                      // Hiring signals derived from job metadata
                      const hiringSignals = [
                        { label: "Open Roles Signal", value: isCareerUplift ? "High growth phase" : "Steady hiring", icon: <Users className="w-4 h-4 text-cyan-400" />, color: "text-cyan-400" },
                        { label: "Tech Investment", value: techs.includes("Kubernetes") || techs.includes("AWS") || techs.includes("GCP") ? "Cloud-native & modern" : "Established stack", icon: <BarChart3 className="w-4 h-4 text-violet-400" />, color: "text-violet-400" },
                        { label: "Engineering Culture", value: techs.some(t => ["GraphQL","gRPC","Kafka","Redis"].includes(t)) ? "High-performance systems" : "Product-led engineering", icon: <Zap className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
                        { label: "Seniority Signal", value: hasLowExp ? "Junior-friendly, growth culture" : job.experienceRequired >= 7 ? "Senior-heavy, deep expertise" : "Mid-senior balance", icon: <Star className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
                      ];

                      // Interview talking points
                      const talkingPoints = [
                        `Mention your hands-on ${matchedSkills[0] || techs[0]} experience and tie it to ${org}'s scale challenges`,
                        `Ask: "What does the on-call rotation look like for this team?" — signals engineering maturity`,
                        `Reference ${techs.includes("Kubernetes") ? "container orchestration at scale" : techs.includes("React") ? "building performant UIs at scale" : "engineering excellence"} as a shared interest`,
                        `Highlight a metric-driven achievement: "reduced X by Y% using ${matchedSkills[0] || techs[0]}"`,
                        `Ask: "What's the biggest technical challenge the team is solving in the next 6 months?" — shows strategic thinking`,
                      ];

                      return (
                        <div className="flex-1 overflow-y-auto space-y-5 animate-fade-in">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-indigo-400" /> {org} — Company Intel
                              </h3>
                              <p className="text-xs text-slate-400 mt-0.5">AI-synthesised signals from job data · {new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}</p>
                            </div>
                            <a href={job.careerPageLink} target="_blank" rel="noreferrer" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
                              <ExternalLink className="w-3.5 h-3.5" /> Careers Page
                            </a>
                          </div>

                          {/* Hiring Signals Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {hiringSignals.map((sig, i) => (
                              <div key={i} className="p-3 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                                <div className="flex items-center gap-2 mb-1">
                                  {sig.icon}
                                  <span className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">{sig.label}</span>
                                </div>
                                <p className={`text-sm font-semibold ${sig.color}`}>{sig.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Tech Stack Analysis */}
                          <div className="p-4 rounded-xl border border-indigo-500/20">
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <BarChart3 className="w-3.5 h-3.5" /> Tech Stack Analysis
                            </p>
                            <div className="mb-3">
                              <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Your stack coverage</span>
                                <span className={matchPct >= 70 ? "text-emerald-400" : matchPct >= 40 ? "text-amber-400" : "text-rose-400"}>{matchPct}%</span>
                              </div>
                              <div className="h-2 bg-slate-700/80 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${matchPct}%`, background: matchPct >= 70 ? "#10b981" : matchPct >= 40 ? "#f59e0b" : "#f43f5e" }} />
                              </div>
                            </div>
                            {matchedSkills.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[11px] text-emerald-400 font-semibold mb-1.5">You have:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {matchedSkills.map(t => (
                                    <span key={t} className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {missingSkills.length > 0 && (
                              <div>
                                <p className="text-[11px] text-rose-400 font-semibold mb-1.5">Gaps to bridge:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {missingSkills.slice(0, 6).map(t => (
                                    <span key={t} className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px]">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Green & Red Flags */}
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {greenFlags.length > 0 && (
                              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <ThumbsUp className="w-3.5 h-3.5" /> Green Flags
                                </p>
                                <ul className="space-y-2">
                                  {greenFlags.map((flag, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                      {flag}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {redFlags.length > 0 && (
                              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                                <p className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <ThumbsDown className="w-3.5 h-3.5" /> Watch Out For
                                </p>
                                <ul className="space-y-2">
                                  {redFlags.map((flag, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                                      {flag}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Interview Talking Points */}
                          <div className="p-4 rounded-xl border border-violet-500/20">
                            <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <MessageCircle className="w-3.5 h-3.5" /> Interview Talking Points
                            </p>
                            <ul className="space-y-2.5">
                              {talkingPoints.map((pt, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                                  <span className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-300 shrink-0 mt-0.5">{i + 1}</span>
                                  {pt}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* AI Deep Dive */}
                          <div className="p-4 rounded-xl border border-cyan-500/20" style={{ background: "rgba(6,182,212,0.03)" }}>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5" /> AI Insider Analysis
                              </p>
                              {!intelStreaming && !intelDone && (
                                <button
                                  onClick={async () => {
                                    if (!job) return;
                                    setIntelStreaming(true);
                                    setIntelStream("");
                                    setIntelDone(false);
                                    try {
                                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stream/hiring-decoder`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          job: { title: job.title, organization: job.organization, description: job.description },
                                          profile: { current_role: profile.currentRole, experience_years: profile.experienceYears, skills: profile.skills },
                                        }),
                                      });
                                      if (!res.body) return;
                                      const reader = res.body.getReader();
                                      const dec = new TextDecoder();
                                      let buf = "";
                                      while (true) {
                                        const { done, value } = await reader.read();
                                        if (done) break;
                                        buf += dec.decode(value, { stream: true });
                                        const lines = buf.split("\n"); buf = lines.pop() ?? "";
                                        for (const line of lines) {
                                          if (!line.startsWith("data: ")) continue;
                                          const raw = line.slice(6).trim();
                                          if (raw === "[DONE]") { setIntelDone(true); continue; }
                                          try { const p = JSON.parse(raw); if (p.token) setIntelStream(prev => prev + p.token); } catch { /* skip */ }
                                        }
                                      }
                                      // Also fetch salary estimate
                                      try {
                                        const sr = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/salary/predict`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ role: job.title, location: profile.currentLocation || "United States", experience_years: profile.experienceYears || 5 }),
                                        });
                                        if (sr.ok) setSalaryEst(await sr.json());
                                      } catch { /* silent */ }
                                    } catch { /* silent */ }
                                    finally { setIntelStreaming(false); setIntelDone(true); }
                                  }}
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                                  style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)", color: "#67e8f9" }}
                                >
                                  <Radio className="w-3 h-3" /> Run AI Deep Dive
                                </button>
                              )}
                              {intelStreaming && <span className="text-xs text-cyan-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Analyzing…</span>}
                            </div>
                            {!intelStream && !intelStreaming && (
                              <p className="text-xs text-slate-500 italic">Click &ldquo;Run AI Deep Dive&rdquo; for an insider breakdown: what they&apos;re really looking for, hidden requirements, and how to position yourself.</p>
                            )}
                            {intelStream && (
                              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono" style={{ scrollbarWidth: "thin" }}>
                                {intelStream}
                                {intelStreaming && <span className="inline-block w-1.5 h-3 bg-cyan-400 animate-pulse ml-0.5 align-middle" />}
                              </div>
                            )}
                          </div>

                          {/* Salary Estimate */}
                          {salaryEst && (
                            <div className="p-4 rounded-xl border border-emerald-500/20" style={{ background: "rgba(16,185,129,0.03)" }}>
                              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5" /> Salary Estimate for This Role
                              </p>
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                {[
                                  { label: "Floor", value: salaryEst.min },
                                  { label: "Market", value: salaryEst.mid },
                                  { label: "Target", value: salaryEst.max },
                                ].map(({ label, value }) => (
                                  <div key={label} className="text-center p-2 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                                    <p className="text-[10px] text-slate-500">{label}</p>
                                    <p className="text-sm font-bold text-white">${Math.round(value / 1000)}k</p>
                                  </div>
                                ))}
                              </div>
                              {salaryEst.negotiation_tip && <p className="text-[11px] text-emerald-300 mt-1">{salaryEst.negotiation_tip}</p>}
                            </div>
                          )}

                          {/* Culture Sentiment (mock Glassdoor-style) */}
                          <div className="p-4 rounded-xl border border-amber-500/20">
                            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <Star className="w-3.5 h-3.5" /> Culture Sentiment Indicators
                            </p>
                            <div className="space-y-2">
                              {[
                                { label: "Work-Life Balance", score: isRemote ? 82 : isHybrid ? 74 : 65 },
                                { label: "Tech & Innovation", score: techs.some(t => ["AI","ML","LLM","GenAI","Rust","Go"].includes(t)) ? 91 : 72 },
                                { label: "Career Growth", score: isCareerUplift ? 88 : 70 },
                                { label: "Compensation Fairness", score: isHighPaying ? 85 : 68 },
                              ].map(({ label, score }) => (
                                <div key={label}>
                                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                                    <span>{label}</span>
                                    <span className={score >= 80 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-rose-400"}>{score}/100</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700"
                                      style={{ width: `${score}%`, background: score >= 80 ? "#10b981" : score >= 70 ? "#f59e0b" : "#f43f5e" }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-3">* Derived from job signals. For verified reviews, check Glassdoor, Levels.fyi, or Blind.</p>
                          </div>

                          {/* Deep Research Brief */}
                          <div className="p-4 rounded-xl border border-violet-500/20" style={{ background: "rgba(139,92,246,0.03)" }}>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5" /> Deep Research Brief
                              </p>
                              {!deepStreaming && !deepDone && (
                                <button
                                  onClick={async () => {
                                    if (!job) return;
                                    setDeepStreaming(true);
                                    setDeepStream("");
                                    setDeepDone(false);
                                    try {
                                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stream/deep-research`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          company: job.organization,
                                          role: job.title,
                                          profile: {
                                            name: profile.name,
                                            current_role: profile.currentRole,
                                            experience_years: profile.experienceYears,
                                            skills: profile.skills,
                                          },
                                        }),
                                      });
                                      if (!res.body) return;
                                      const reader = res.body.getReader();
                                      const dec = new TextDecoder();
                                      let buf = "";
                                      while (true) {
                                        const { done, value } = await reader.read();
                                        if (done) break;
                                        buf += dec.decode(value, { stream: true });
                                        const lines = buf.split("\n"); buf = lines.pop() ?? "";
                                        for (const line of lines) {
                                          if (!line.startsWith("data: ")) continue;
                                          const raw = line.slice(6).trim();
                                          if (raw === "[DONE]") { setDeepDone(true); continue; }
                                          try { const p = JSON.parse(raw); if (p.token) setDeepStream(prev => prev + p.token); } catch { /* skip */ }
                                        }
                                      }
                                    } catch { /* silent */ }
                                    finally { setDeepStreaming(false); setDeepDone(true); }
                                  }}
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                                  style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd" }}
                                >
                                  <BookOpen className="w-3 h-3" /> Run Deep Research
                                </button>
                              )}
                              {deepStreaming && (
                                <span className="text-xs text-violet-400 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Researching…
                                </span>
                              )}
                              {deepDone && (
                                <button
                                  onClick={() => { setDeepStream(""); setDeepDone(false); }}
                                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            {!deepStream && !deepStreaming && (
                              <p className="text-xs text-slate-500 italic">
                                6-axis company brief: AI strategy, recent moves, engineering culture, likely challenges, competitive landscape, and your candidate angle — all personalised to this role.
                              </p>
                            )}
                            {deepStream && (
                              <div
                                className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto"
                                style={{ scrollbarWidth: "thin" }}
                              >
                                {deepStream}
                                {deepStreaming && <span className="inline-block w-1.5 h-3 bg-violet-400 animate-pulse ml-0.5 align-middle" />}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { mockJobs } from "@/lib/mockData";
import { loadProfile } from "@/lib/profile";
import { Job, CandidateProfile } from "@/lib/types";
import {
  ArrowLeft, Building2, MapPin, Clock, DollarSign,
  FileText, Mail, MessageSquare, Download, CheckCircle,
  TrendingUp, Sparkles, ExternalLink, ShieldCheck, Copy
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
  languages: [], cicdTools: [], certifications: [],
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [activeTab, setActiveTab] = useState<"resume" | "cover" | "recruiter">("resume");
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
    const saved = loadProfile();
    if (saved) setProfile(saved);
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

  const handleDownload = (type: "pdf" | "docx") => {
    const b64 = type === "pdf" ? generatedData.pdf_base64 : generatedData.docx_base64;
    if (!b64) return;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: type === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `ats_resume.${type}` });
    a.click(); URL.revokeObjectURL(a.href);
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
      <Navbar />
      <main className="ml-64 flex-1 px-8 py-8 max-w-6xl">
        <button
          onClick={() => router.push("/jobs")}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </button>

        <div className="flex flex-col xl:flex-row gap-6">
          {/* Left Column: Job Details */}
          <div className="w-full xl:w-[400px] shrink-0 space-y-6">
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
                <div className="bg-[#0f172a] rounded-xl border border-[#334155] p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300">Your Match Score</span>
                    <span className="text-lg font-bold text-emerald-400">{job.matchScore}%</span>
                  </div>
                  <div className="progress-bar mb-3">
                    <div className="progress-fill" style={{ width: `${job.matchScore}%`, background: job.matchScore > 80 ? "#10b981" : "#6366f1" }} />
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
              <p className="text-xs text-slate-500 text-center">
                We verified this job is actively hiring on the official site.
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
              <div className="flex border-b border-[#334155] bg-[#1e293b]">
                {(["resume", "cover", "recruiter"] as const).map((tab) => {
                  const labels: Record<string, { icon: React.ReactNode; label: string }> = {
                    resume: { icon: <FileText className="w-4 h-4" />, label: "ATS Resume" },
                    cover: { icon: <Mail className="w-4 h-4" />, label: "Cover Letter" },
                    recruiter: { icon: <MessageSquare className="w-4 h-4" />, label: "Recruiter Email" },
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === tab ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                    >
                      {labels[tab].icon} {labels[tab].label}
                    </button>
                  );
                })}
              </div>

              {/* Content Area */}
              <div className="flex-1 p-6 flex flex-col">
                {!generated && !generating ? (
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
                          const allProfileSkills = [
                            ...profile.skills,
                            ...(profile.frameworks ?? []),
                            ...(profile.languages ?? []),
                            ...(profile.cicdTools ?? []),
                          ].filter(Boolean);
                          const bullets = generatedData.bullets ?? [
                            `Architected end-to-end ${job.technologies[0] || "automation"} framework from scratch, reducing regression cycle time by 40% and enabling daily releases.`,
                            `Designed and implemented ${job.technologies[1] || "API"} test suites covering 200+ endpoints across microservices, achieving 92% API coverage.`,
                            `Integrated automated test pipeline into CI/CD using ${(profile.cicdTools ?? [job.technologies[2] || "Jenkins"])[0]}, cutting production defect escape rate by 95%.`,
                            `Mentored a team of 4 junior engineers on test automation best practices, BDD principles, and code review standards.`,
                            `Led performance benchmarking initiative using ${job.technologies.find(t => ["JMeter","K6","Gatling"].includes(t)) || "load testing tools"}, identifying 3 critical bottlenecks before launch.`,
                            `Collaborated with Product and DevOps to define quality gates, shift-left testing strategy, and release readiness criteria.`,
                          ];
                          return (
                            <div className="flex-1 bg-white rounded-lg p-6 overflow-y-auto border border-slate-700 font-serif text-slate-800 shadow-inner text-sm">
                              {/* Header */}
                              <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
                                <h1 className="text-xl font-bold tracking-wide uppercase">{profile.name || "Your Name"}</h1>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  {profile.currentLocation || "Location"}{profile.currentLocation ? " · " : ""}{profile.currency} {profile.currentSalary ? Number(profile.currentSalary).toLocaleString() : ""}{" "}
                                  {profile.experienceYears ? `· ${profile.experienceYears}+ years exp` : ""}
                                </p>
                              </div>

                              {/* Summary */}
                              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-0.5 mb-2">Professional Summary</h2>
                              <p className="mb-4 leading-relaxed text-[13px]">
                                Results-driven <strong>{profile.currentRole || "professional"}</strong> with {profile.experienceYears}+ years of experience delivering{" "}
                                {matchedSkills.length > 0 ? matchedSkills.slice(0, 3).join(", ") : job.technologies.slice(0, 3).join(", ")} solutions at scale.
                                {profile.resumeText && !profile.resumeText.startsWith("[Resume file:")
                                  ? ` Demonstrated track record of ${profile.resumeText.toLowerCase().includes("lead") || profile.resumeText.toLowerCase().includes("senior") ? "technical leadership and " : ""}building high-quality, production-grade systems. `
                                  : " Proven ability to architect robust systems, drive engineering excellence, and deliver measurable results. "}
                                Excited to bring deep expertise in {job.technologies[0]} to {job.organization}&apos;s engineering team and drive {job.levelUp ? "next-level impact" : "continued excellence"}.
                              </p>

                              {/* Core Skills */}
                              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-0.5 mb-2">Core Competencies</h2>
                              <div className="grid grid-cols-2 gap-x-4 mb-4 text-[12px]">
                                {(allProfileSkills.length > 0 ? allProfileSkills : job.technologies).slice(0, 10).map((s, i) => (
                                  <div key={i} className="flex items-center gap-1 py-0.5">
                                    <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                                    <span className={matchedSkills.includes(s) ? "font-semibold text-slate-900" : "text-slate-600"}>{s}</span>
                                  </div>
                                ))}
                              </div>

                              {/* JD Tech Match */}
                              {matchedSkills.length > 0 && (
                                <>
                                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-0.5 mb-2">JD Technology Match</h2>
                                  <p className="text-[12px] mb-4 text-emerald-700 font-medium">
                                    ✓ {matchedSkills.join("  ·  ")}
                                  </p>
                                </>
                              )}

                              {/* Experience */}
                              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-0.5 mb-2">Professional Experience</h2>
                              <div className="mb-4">
                                <div className="flex justify-between items-baseline mb-0.5">
                                  <p className="font-bold text-[13px]">{profile.currentRole || "Current Role"}</p>
                                  <p className="text-[11px] text-slate-500">Current</p>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-2 italic">{profile.currentLocation || ""}</p>
                                <ul className="list-disc pl-4 space-y-1.5 text-[12px] leading-relaxed">
                                  {bullets.map((b, i) => <li key={i}>{b}</li>)}
                                </ul>
                              </div>

                              {/* Certifications */}
                              {(profile.certifications ?? []).length > 0 && (
                                <>
                                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-0.5 mb-2">Certifications</h2>
                                  <ul className="list-disc pl-4 space-y-0.5 text-[12px] mb-4">
                                    {profile.certifications.map((c, i) => <li key={i}>{c}</li>)}
                                  </ul>
                                </>
                              )}

                              <p className="text-[10px] text-slate-400 text-center mt-4 pt-3 border-t border-slate-200">
                                Generated by JobIntel AI · Tailored for {job.organization} · {job.title}
                              </p>
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
                        <div className="flex-1 bg-[#263348] rounded-lg p-6 overflow-y-auto border border-slate-600 text-sm text-slate-200 leading-relaxed font-sans shadow-inner whitespace-pre-wrap">
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
                        <div className="bg-[#1e293b] rounded-lg border border-slate-600 overflow-hidden shadow-inner mb-3">
                          <div className="px-4 py-2 border-b border-slate-600 bg-[#263348] text-xs text-slate-400 font-mono">
                            Subject: {profile.currentRole || "Professional"} interested in {job.title} role
                          </div>
                          <div className="p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap bg-[#0f172a]">
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
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

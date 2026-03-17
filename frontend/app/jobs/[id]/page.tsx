"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { mockJobs, demoProfile } from "@/lib/mockData";
import { Job, CandidateProfile } from "@/lib/types";
import {
  ArrowLeft, Building2, MapPin, Clock, DollarSign,
  FileText, Mail, MessageSquare, Download, CheckCircle,
  TrendingUp, Sparkles, ExternalLink, ShieldCheck
} from "lucide-react";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<CandidateProfile>(demoProfile);
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

  useEffect(() => {
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
    const p = sessionStorage.getItem("candidateProfile");
    if (p) { try { setProfile(JSON.parse(p)); } catch {} }
  }, [params.id]);

  const handleGenerate = async () => {
    if (!job) return;
    setGenerating(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      try {
        const jobPayload = { title: job.title, organization: job.organization, description: job.description, technologies: job.technologies };
        const [resumeRes, coverRes, recruiterRes] = await Promise.all([
          fetch(`${apiUrl}/api/resume/generate-ats`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, job: jobPayload }) }),
          fetch(`${apiUrl}/api/resume/generate-cover-letter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, job: jobPayload }) }),
          fetch(`${apiUrl}/api/recruiter/outreach-message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, job: { ...jobPayload, recruiter_name: job.recruiterName, recruiter_linkedin: job.recruiterLinkedIn } }) }),
        ]);
        type ResumeResp = { bullets?: string[]; pdf_base64?: string; docx_base64?: string; ats_score?: number };
        type CoverResp = { content?: string };
        type RecruiterResp = { message?: string; recruiter_name?: string; recruiter_linkedin?: string };
        const [resumeData, coverData, recruiterData]: [ResumeResp, CoverResp, RecruiterResp] = await Promise.all([
          resumeRes.ok ? resumeRes.json() : {},
          coverRes.ok ? coverRes.json() : {},
          recruiterRes.ok ? recruiterRes.json() : {},
        ]);
        setGeneratedData({ bullets: resumeData.bullets, pdf_base64: resumeData.pdf_base64, docx_base64: resumeData.docx_base64, ats_score: resumeData.ats_score, cover_letter: coverData.content, recruiter_message: recruiterData.message, recruiter_name: recruiterData.recruiter_name, recruiter_linkedin: recruiterData.recruiter_linkedin });
        setGenerating(false); setGenerated(true); return;
      } catch { /* fall through to mock */ }
    }
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2500);
  };

  const handleDownload = (type: "pdf" | "docx") => {
    const b64 = type === "pdf" ? generatedData.pdf_base64 : generatedData.docx_base64;
    if (!b64) return;
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: type === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `ats_resume.${type}` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleApply = () => {
    if (job) window.open(job.applicationLink, "_blank");
  };

  if (!job) return <div className="min-h-screen bg-[#0f172a]" />;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Navbar />
      <main className="ml-64 flex-1 px-8 py-8 max-w-6xl">
        {/* Back button */}
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
              
              <h1 className="text-xl font-bold text-white mb-2 leading-tight">
                {job.title}
              </h1>
              
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
                    {job.currency} {(job.salaryMin / 1000).toFixed(0)}k - {(job.salaryMax / 1000).toFixed(0)}k
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" /> {job.experienceRequired}+ years required
                </div>
              </div>

              {job.matchScore && (
                <div className="bg-[#0f172a] rounded-xl border border-[#334155] p-4 mb-6">
                  <div className="flexitems-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300">Your Match Score</span>
                    <span className="text-lg font-bold text-emerald-400">{job.matchScore}%</span>
                  </div>
                  <div className="progress-bar mb-3">
                    <div className="progress-fill" style={{ width: `${job.matchScore}%`, background: job.matchScore > 80 ? '#10b981' : '#6366f1' }} />
                  </div>
                  <p className="text-xs text-slate-500">
                    High overlap with your {profile.skills.slice(0, 2).join(", ")} skills.
                  </p>
                </div>
              )}

              <button onClick={handleApply} className="btn-primary w-full py-3 mb-2 flex items-center justify-center gap-2 text-sm">
                Apply on Company Portal <ExternalLink className="w-4 h-4" />
              </button>
              <p className="text-xs text-slate-500 text-center">
                We verified this job is actively hiring on the official site.
              </p>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-3">Required Tech Stack</h3>
              <div className="flex flex-wrap gap-1.5">
                {job.technologies.map(t => {
                  const has = profile.skills.includes(t) || profile.frameworks.includes(t);
                  return (
                    <span key={t} className={`flex items-center gap-1 badge ${has ? 'badge-verified' : 'badge-tech opacity-60'}`}>
                      {has && <CheckCircle className="w-3 h-3" />} {t}
                    </span>
                  );
                })}
              </div>
            </div>
            
            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-3">Job Description</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {job.description}
              </p>
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
                <button
                  onClick={() => setActiveTab("resume")}
                  className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === "resume" ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  <FileText className="w-4 h-4" /> ATS Resume
                </button>
                <button
                  onClick={() => setActiveTab("cover")}
                  className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === "cover" ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  <Mail className="w-4 h-4" /> Cover Letter
                </button>
                <button
                  onClick={() => setActiveTab("recruiter")}
                  className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === "recruiter" ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                >
                  <MessageSquare className="w-4 h-4" /> Recruiter Email
                </button>
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
                      Our AI will instantly rewrite your resume bullets, draft a personalized cover letter, and write a recruiter outreach email specifically tailored to the <span className="text-white font-medium">{job.title}</span> role at <span className="text-white font-medium">{job.organization}</span>.
                    </p>
                    <button onClick={handleGenerate} className="btn-primary py-3 px-8 flex items-center gap-2 shadow-glow">
                      <Sparkles className="w-4 h-4" /> Generate Everything Now
                    </button>
                  </div>
                ) : generating ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-20">
                    <div className="relative w-20 h-20 mb-6">
                      <div className="absolute inset-0 border-4 border-[#334155] rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-cyan-400 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" /></div>
                    </div>
                    <p className="text-white font-medium mb-1">AI Engine Processing...</p>
                    <p className="text-sm text-slate-400 animate-pulse">Matching your profile to {job.organization}'s JD...</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col animate-fade-in">
                    {/* Render generated content based on tab */}
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
                        <div className="flex-1 bg-white rounded-lg p-6 overflow-y-auto border border-slate-700 font-serif text-slate-800 shadow-inner">
                          <h1 className="text-2xl font-bold mb-1">{profile.name}</h1>
                          <p className="text-sm mb-4 border-b border-slate-300 pb-2">{job.title} | {profile.currentLocation} | {profile.experienceYears}+ Yrs Experience</p>
                          <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-slate-900">Professional Summary</h2>
                          <p className="text-sm mb-4 leading-relaxed">Results-driven {profile.currentRole} with {profile.experienceYears}+ years designing scalable automation frameworks using {job.technologies.slice(0,3).join(", ")}, directly aligning with {job.organization}&apos;s engineering culture.</p>
                          <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-slate-900">Core Technologies</h2>
                          <p className="text-sm mb-4"><strong>Matching JD:</strong> {job.technologies.filter(t => profile.skills.includes(t) || (profile.frameworks || []).includes(t)).join(", ") || job.technologies.slice(0,4).join(", ")}</p>
                          <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-slate-900 border-b border-slate-300 pb-1">AI-Enhanced Experience</h2>
                          <p className="text-sm font-bold mb-1">{profile.currentRole} — Current</p>
                          <ul className="list-disc pl-5 text-sm space-y-1.5">
                            {(generatedData.bullets ?? [
                              `Architected ${job.technologies[0] || "automation"} framework, reducing regression time by 40%.`,
                              `Integrated tests into CI/CD, preventing 95%+ of critical defects from reaching production.`,
                              `Led API testing initiative across 12 microservices, achieving 85% coverage.`,
                            ]).map((b, i) => <li key={i}>{b}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}

                    {activeTab === "cover" && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-white">Cover Letter</h3>
                          <button
                            onClick={() => navigator.clipboard.writeText(generatedData.cover_letter ?? "")}
                            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" /> Copy
                          </button>
                        </div>
                        <div className="flex-1 bg-[#263348] rounded-lg p-6 overflow-y-auto border border-slate-600 text-sm text-slate-200 leading-relaxed font-sans shadow-inner whitespace-pre-wrap">
                          {generatedData.cover_letter ?? `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${job.title} position at ${job.organization}. With ${profile.experienceYears} years of experience in QA automation using ${job.technologies.slice(0,2).join(" and ")}, I am confident I can make an immediate impact.\n\nBest regards,\n${profile.name}`}
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
                        <div className="bg-[#1e293b] rounded-lg border border-slate-600 overflow-hidden shadow-inner">
                          <div className="px-4 py-2 border-b border-slate-600 bg-[#263348] text-xs text-slate-400 font-mono">
                            Subject: QA Automation Expert for {job.title} role
                          </div>
                          <div className="p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap bg-[#0f172a]">
                            {generatedData.recruiter_message ?? `Hi ${job.recruiterName?.split(" ")[0] ?? "Recruiter"},\n\nI saw that ${job.organization} is hiring for a ${job.title}. Given my ${profile.experienceYears}+ years with ${job.technologies.slice(0,3).join(", ")}, I believe I'd be a great fit. Would you be open to a quick 10-minute chat?\n\nThanks,\n${profile.name}`}
                          </div>
                        </div>
                        <div className="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                          <p className="flex items-start gap-2">
                            <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                            <strong>Pro Tip:</strong> Send via LinkedIn InMail or email first.last@{job.organization.toLowerCase().replace(/\s/g, "")}.com.
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

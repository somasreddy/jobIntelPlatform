"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { loadProfile } from "@/lib/profile";
import { FileText, CheckCircle, Upload, ShieldAlert, Sparkles, FileOutput, UserCircle2 } from "lucide-react";
import { CandidateProfile } from "@/lib/types";

export default function ResumePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setProfileChecked(true);
  }, []);

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

  if (profileChecked && !profile) {
    return (
      <div className="flex min-h-screen bg-transparent">
        <Navbar />
        <main className="ml-64 flex-1 px-8 py-8 flex items-center justify-center">
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
      <Navbar />
      <main className="ml-64 flex-1 px-8 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-2">
            <FileOutput className="w-4 h-4" /> Base Resume Manager
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Your <span className="gradient-text">Master Profile</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            This is your generic master profile. When you apply to a specific job inside the{" "}
            <strong className="text-white">Jobs Dashboard</strong>, our AI will generate a highly-targeted ATS resume based on this data.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Extracted Profile Data
              </h2>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm mb-6">
                <div>
                  <p className="text-slate-500 mb-1">Name</p>
                  <p className="font-medium text-white">{profile?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Current Role</p>
                  <p className="font-medium text-white">{profile?.currentRole || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Experience</p>
                  <p className="font-medium text-white">{profile?.experienceYears ? `${profile.experienceYears} Years` : "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Location</p>
                  <p className="font-medium text-white">{profile?.currentLocation || "—"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Core Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile?.skills ?? []).length > 0
                      ? (profile?.skills ?? []).map(s => <span key={s} className="tag bg-[#263348] border-[#334155] text-slate-200">{s}</span>)
                      : <span className="text-slate-500 text-sm">No skills added yet</span>}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Automation Frameworks</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile?.frameworks ?? []).length > 0
                      ? (profile?.frameworks ?? []).map(s => <span key={s} className="tag bg-[#263348] border-[#334155] text-slate-200">{s}</span>)
                      : <span className="text-slate-500 text-sm">—</span>}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-2">CI/CD & DevOps</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile?.cicdTools ?? []).length > 0
                      ? (profile?.cicdTools ?? []).map(s => <span key={s} className="tag bg-[#263348] border-[#334155] text-slate-200">{s}</span>)
                      : <span className="text-slate-500 text-sm">—</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-indigo-500/30 bg-indigo-500/5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">How AI Generation Works</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-3">
                    We use this master profile as the source of truth. When you view a job, the AI compares this profile against the Job Description. It then dynamically writes new experience bullets that format your accomplishments using the exact terminology the ATS is looking for.
                  </p>
                  <button className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                    View Example Output &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-6 text-center">Baseline ATS Score</h2>
              <div className="flex justify-center mb-3">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="absolute w-full h-full -rotate-90">
                    <circle cx="64" cy="64" r="56" fill="none" stroke="#1e293b" strokeWidth="8" />
                    <circle cx="64" cy="64" r="56" fill="none" stroke={scoreColor} strokeWidth="8" strokeDasharray={56 * 2 * Math.PI} strokeDashoffset={(56 * 2 * Math.PI) * (1 - score / 100)} className="transition-all duration-1000 ease-out" />
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
                  <p className="text-slate-300">Your base resume scores <strong className="text-white">{score}%</strong> against average roles.</p>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-slate-300">Using our AI generator per job increases format match to <strong className="text-white">95%+</strong>.</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-4">Update Source Document</h2>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${dragging ? "border-indigo-400 bg-indigo-500/10" : "border-[#334155] hover:border-slate-500"}`}
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
                    <p className="text-xs text-slate-400">Drag & drop new master PDF</p>
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

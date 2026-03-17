"use client";
import { useState, useEffect } from "react";
import { Job, JobPortal } from "@/lib/types";
import {
  MapPin, Building2, Clock, ArrowUpRight, CheckCircle2,
  ExternalLink, TrendingUp, Bookmark, BookmarkCheck,
  ChevronUp, Zap, DollarSign
} from "lucide-react";
import Link from "next/link";
import { getSavedJobIds, toggleSavedJob, loadProfile } from "@/lib/profile";

const PORTAL_STYLE: Record<JobPortal, { bg: string; text: string; label: string }> = {
  LinkedIn:  { bg: "bg-[#0a66c2]/15", text: "text-[#5ba4f5]",  label: "in" },
  Indeed:    { bg: "bg-[#003a9b]/15", text: "text-[#6699ff]",  label: "indeed" },
  Glassdoor: { bg: "bg-[#0caa41]/15", text: "text-[#34d399]",  label: "glassdoor" },
  Naukri:    { bg: "bg-[#ff7555]/15", text: "text-[#fb923c]",  label: "naukri" },
  Adzuna:    { bg: "bg-[#e44c30]/15", text: "text-[#f87171]",  label: "adzuna" },
  Remotive:  { bg: "bg-violet-500/15", text: "text-violet-400", label: "remotive" },
  Arbeitnow: { bg: "bg-cyan-500/15",   text: "text-cyan-400",   label: "arbeitnow" },
  TheMuse:   { bg: "bg-pink-500/15",   text: "text-pink-400",   label: "the muse" },
  Direct:    { bg: "bg-emerald-500/15",text: "text-emerald-400",label: "direct" },
  Other:     { bg: "bg-slate-700/40",  text: "text-slate-400",  label: "other" },
};

function SourceBadge({ source }: { source?: JobPortal }) {
  if (!source) return null;
  const s = PORTAL_STYLE[source] ?? PORTAL_STYLE.Other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border border-current/20 ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function formatSalary(min: number, max: number, currency: string) {
  const fmt = (n: number) => {
    if (currency === "INR") return `₹${(n / 100000).toFixed(1)}L`;
    if (currency === "GBP") return `£${(n / 1000).toFixed(0)}K`;
    return `$${(n / 1000).toFixed(0)}K`;
  };
  return `${fmt(min)} – ${fmt(max)}`;
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-slate-400">{label}</span>
        <span className="text-[10px] font-semibold" style={{ color }}>{score}%</span>
      </div>
      <div className="h-1 bg-slate-700/80 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

function ScoreRing({ score, onClick }: { score: number; onClick: (e: React.MouseEvent) => void }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 85 ? "#10b981" : score >= 70 ? "#6366f1" : score >= 55 ? "#f59e0b" : "#f43f5e";
  return (
    <button onClick={onClick} title="Click to see score breakdown" className="relative group shrink-0">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="5" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ - fill}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
        <text
          x="28" y="33" textAnchor="middle" fill={color}
          fontSize="11" fontWeight="700"
          style={{ transform: "rotate(90deg)", transformOrigin: "28px 28px" }}
        >
          {score}%
        </text>
      </svg>
      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Zap className="w-1.5 h-1.5 text-indigo-400" />
      </div>
    </button>
  );
}

interface JobCardProps {
  job: Job;
  onSelect?: (job: Job) => void;
}

export default function JobCard({ job, onSelect }: JobCardProps) {
  const matchScore = job.matchScore ?? 0;
  const [saved, setSaved] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdown, setBreakdown] = useState<{ skills: number; experience: number; location: number; salary: number } | null>(null);

  useEffect(() => {
    setSaved(getSavedJobIds().includes(job.id));
  }, [job.id]);

  useEffect(() => {
    if (showBreakdown && !breakdown) {
      // Compute breakdown from profile vs job
      const profile = loadProfile();
      if (!profile) {
        setBreakdown({ skills: matchScore, experience: matchScore, location: matchScore, salary: matchScore });
        return;
      }
      const allSkills = [...(profile.skills ?? []), ...(profile.frameworks ?? []), ...(profile.cicdTools ?? [])];
      const matched = job.technologies.filter(t => allSkills.includes(t));
      const skillScore = job.technologies.length > 0
        ? Math.round((matched.length / job.technologies.length) * 100)
        : 50;
      const expScore = profile.experienceYears >= job.experienceRequired
        ? 100
        : Math.round((profile.experienceYears / job.experienceRequired) * 90);
      // Location: rough match
      const wm = profile.workMode ?? "Any";
      const locScore = wm === "Any" || wm === job.workMode || job.workMode === "Remote" ? 95 : 70;
      // Salary: how close is current salary to job range
      const mid = (job.salaryMin + job.salaryMax) / 2;
      const curr = profile.currentSalary ?? 0;
      const salScore = curr === 0 ? 75 : Math.min(100, Math.round((curr / mid) * 100));
      setBreakdown({ skills: skillScore, experience: expScore, location: locScore, salary: salScore });
    }
  }, [showBreakdown, breakdown, job, matchScore]);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSaved(toggleSavedJob(job.id));
  };

  const toggleBreakdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowBreakdown(p => !p);
  };

  return (
    <div
      onClick={() => onSelect?.(job)}
      className="card cursor-pointer group animate-slide-up"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {job.verificationStatus === "VERIFIED" ? (
              <span className="badge badge-verified">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            ) : (
              <span className="badge" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
                Unverified
              </span>
            )}
            {job.levelUp && (
              <span className="badge badge-hot">
                <TrendingUp className="w-3 h-3" /> Career Uplift
              </span>
            )}
            <span className="badge badge-new">{job.workMode}</span>
            <SourceBadge source={job.source} />
          </div>
          <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
            {job.title}
          </h3>
          <div className="flex items-center gap-1 text-slate-400 text-sm mt-0.5">
            <Building2 className="w-3.5 h-3.5" />
            <span className="font-medium text-slate-300">{job.organization}</span>
          </div>
        </div>
        {matchScore > 0 && <ScoreRing score={matchScore} onClick={toggleBreakdown} />}
      </div>

      {/* Score Breakdown Panel */}
      {showBreakdown && breakdown && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mb-3 p-3 bg-slate-900/60 border border-indigo-500/20 rounded-xl space-y-2 animate-fade-in"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3" /> Match Score Breakdown
            </p>
            <button onClick={toggleBreakdown} className="text-slate-500 hover:text-slate-300">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
          <ScoreBar label="Skills Match" score={breakdown.skills}
            color={breakdown.skills >= 70 ? "#10b981" : breakdown.skills >= 50 ? "#f59e0b" : "#f43f5e"} />
          <ScoreBar label="Experience Fit" score={breakdown.experience}
            color={breakdown.experience >= 80 ? "#10b981" : breakdown.experience >= 60 ? "#6366f1" : "#f59e0b"} />
          <ScoreBar label="Location/Mode" score={breakdown.location}
            color={breakdown.location >= 90 ? "#10b981" : "#6366f1"} />
          <ScoreBar label="Salary Alignment" score={breakdown.salary}
            color={breakdown.salary >= 80 ? "#10b981" : breakdown.salary >= 60 ? "#f59e0b" : "#f43f5e"} />
          {breakdown.skills < 70 && (
            <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Add{" "}
              {job.technologies
                .filter(t => {
                  const p = loadProfile();
                  const all = [...(p?.skills ?? []), ...(p?.frameworks ?? [])];
                  return !all.includes(t);
                })
                .slice(0, 2)
                .join(", ")}{" "}
              to push score to 95%+
            </p>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mb-3">
        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {job.experienceRequired}+ yrs</span>
        <span className="font-semibold text-emerald-400 flex items-center gap-1">
          <DollarSign className="w-3 h-3" />{formatSalary(job.salaryMin, job.salaryMax, job.currency)}
        </span>
      </div>

      {/* Description preview */}
      <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">{job.description}</p>

      {/* Tech tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {job.technologies.slice(0, 5).map((t) => (
          <span key={t} className="tag">{t}</span>
        ))}
        {job.technologies.length > 5 && (
          <span className="tag">+{job.technologies.length - 5}</span>
        )}
      </div>

      {/* CTA */}
      <div className="flex gap-2">
        <Link
          href={`/jobs/${job.id}`}
          onClick={(e) => e.stopPropagation()}
          className="btn-primary flex-1 text-center text-sm flex items-center justify-center gap-1.5"
        >
          View & Generate <ArrowUpRight className="w-4 h-4" />
        </Link>
        <a
          href={job.applicationLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="btn-secondary flex items-center gap-1 text-sm"
        >
          Apply <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button
          onClick={handleSave}
          title={saved ? "Remove from saved" : "Save job"}
          className={`btn-secondary px-2.5 flex items-center justify-center transition-colors ${saved ? "text-indigo-400 border-indigo-500/50" : "text-slate-400"}`}
        >
          {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

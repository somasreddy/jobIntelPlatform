"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  MapPin,
  Zap,
} from "lucide-react";
import JobPowerToolsModal from "@/components/JobPowerToolsModal";
import { getSavedJobIds, toggleSavedJob } from "@/lib/profile";
import { Job, JobPortal } from "@/lib/types";

const PORTAL_STYLE: Record<JobPortal, { bg: string; text: string; label: string }> = {
  LinkedIn: { bg: "bg-[#0a66c2]/15", text: "text-[#5ba4f5]", label: "linkedin" },
  Indeed: { bg: "bg-[#003a9b]/15", text: "text-[#6699ff]", label: "indeed" },
  Glassdoor: { bg: "bg-[#0caa41]/15", text: "text-[#34d399]", label: "glassdoor" },
  Naukri: { bg: "bg-[#ff7555]/15", text: "text-[#fb923c]", label: "naukri" },
  Adzuna: { bg: "bg-[#e44c30]/15", text: "text-[#f87171]", label: "adzuna" },
  Remotive: { bg: "bg-violet-500/15", text: "text-violet-400", label: "remotive" },
  Arbeitnow: { bg: "bg-cyan-500/15", text: "text-cyan-400", label: "arbeitnow" },
  TheMuse: { bg: "bg-pink-500/15", text: "text-pink-400", label: "the muse" },
  RemoteOK: { bg: "bg-green-500/15", text: "text-green-400", label: "remoteok" },
  Jobicy: { bg: "bg-amber-500/15", text: "text-amber-400", label: "jobicy" },
  Direct: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "direct" },
  Other: { bg: "bg-slate-700/40", text: "text-slate-400", label: "other" },
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const fallback = { ...PORTAL_STYLE.Other, label: source.replace(/^Dork\//, "dork ").toLowerCase() };
  const style = PORTAL_STYLE[source as JobPortal] ?? fallback;

  return (
    <span className={`inline-flex items-center rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function formatSalary(min: number, max: number, currency: string) {
  if (!min || !max) return "Not disclosed";

  const fmt = (n: number) => {
    if (currency === "INR") return `INR ${(n / 100000).toFixed(1)}L`;
    if (currency === "GBP") return `GBP ${(n / 1000).toFixed(0)}K`;
    return `$${(n / 1000).toFixed(0)}K`;
  };

  return `${fmt(min)} - ${fmt(max)}`;
}

function CompactScoreBadge({ score }: { score: number }) {
  if (!score) return null;
  const tone =
    score >= 85
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
      : score >= 70
        ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-300"
        : score >= 55
          ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
          : "border-slate-500/30 bg-slate-500/10 text-slate-300";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      <Zap className="h-2.5 w-2.5" />
      {score}% fit
    </span>
  );
}

interface JobCardProps {
  job: Job;
  onSelect?: (job: Job) => void;
}

export default function JobCard({ job, onSelect }: JobCardProps) {
  const [saved, setSaved] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const matchScore = job.fitScore ?? job.matchScore ?? 0;
  const hasInternalDetails = Boolean(job.id) && !job.id.startsWith("dork-");
  const detailsHref = hasInternalDetails ? `/jobs/${job.id}` : job.applicationLink;
  const detailsLabel = hasInternalDetails ? "View JD" : "Open JD";
  const reasons = (job.matchReasons ?? []).filter(Boolean).slice(0, 2);
  const techs = (job.technologies ?? []).filter(Boolean).slice(0, 4);
  const remainingTechs = Math.max((job.technologies?.length ?? 0) - techs.length, 0);

  useEffect(() => {
    setSaved(getSavedJobIds().includes(job.id));
  }, [job.id]);

  const handleSave = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSaved(toggleSavedJob(job.id));
  };

  return (
    <div onClick={() => onSelect?.(job)} className="card group cursor-pointer animate-slide-up">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {job.verificationStatus === "VERIFIED" ? (
              <span className="badge badge-verified">
                <CheckCircle2 className="h-3 w-3" />
                Verified
              </span>
            ) : (
              <span className="badge border border-amber-400/20 bg-amber-400/10 text-amber-300">
                Unverified
              </span>
            )}
            <span className="badge badge-new">{job.workMode}</span>
            <SourceBadge source={job.source} />
            <CompactScoreBadge score={matchScore} />
          </div>

          <h3 className="line-clamp-2 text-base font-semibold text-white transition-colors group-hover:text-indigo-300">
            {job.title}
          </h3>
          <div className="mt-1 flex items-center gap-1 text-sm text-slate-400">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium text-slate-300">{job.organization}</span>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {job.location}
        </span>
        {job.experienceRequired > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {job.experienceRequired}+ yrs
          </span>
        )}
        <span className="flex items-center gap-1 font-semibold text-emerald-400">
          <DollarSign className="h-3 w-3" />
          {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
        </span>
      </div>

      {job.description && (
        <p className="mb-3 line-clamp-1 text-xs leading-relaxed text-slate-400">
          {job.description}
        </p>
      )}

      {reasons.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {reasons.map((reason) => (
            <span key={reason} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              {reason}
            </span>
          ))}
        </div>
      )}

      {techs.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {techs.map((tech) => (
            <span key={tech} className="tag">
              {tech}
            </span>
          ))}
          {remainingTechs > 0 && <span className="tag">+{remainingTechs}</span>}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
        <Link
          href={detailsHref}
          target={hasInternalDetails ? undefined : "_blank"}
          rel={hasInternalDetails ? undefined : "noopener noreferrer"}
          onClick={(event) => event.stopPropagation()}
          className="btn-primary flex items-center justify-center gap-1.5 text-center text-sm"
        >
          {detailsLabel}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setShowAnalysis(true);
          }}
          title="AI job analysis"
          className="btn-secondary flex items-center justify-center gap-1.5 px-3 text-sm font-semibold"
          style={{ color: "var(--accent-bright)", borderColor: "rgba(99,102,241,0.3)" }}
        >
          <Zap className="h-3.5 w-3.5" />
          AI
        </button>
        <a
          href={job.applicationLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          title="Apply on company site"
          className="btn-secondary flex items-center justify-center px-3 text-sm"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={handleSave}
          title={saved ? "Remove from saved" : "Save job"}
          className={`btn-secondary flex items-center justify-center px-3 transition-colors ${saved ? "border-indigo-500/50 text-indigo-400" : "text-slate-400"}`}
        >
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </div>

      {showAnalysis && <JobPowerToolsModal job={job} onClose={() => setShowAnalysis(false)} />}
    </div>
  );
}

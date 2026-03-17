"use client";
import { Job } from "@/lib/types";
import { MapPin, Building2, Clock, ArrowUpRight, CheckCircle2, ExternalLink, TrendingUp } from "lucide-react";
import Link from "next/link";

function formatSalary(min: number, max: number, currency: string) {
  const fmt = (n: number) => {
    if (currency === "INR") return `₹${(n / 100000).toFixed(1)}L`;
    if (currency === "GBP") return `£${(n / 1000).toFixed(0)}K`;
    return `$${(n / 1000).toFixed(0)}K`;
  };
  return `${fmt(min)} – ${fmt(max)}`;
}

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color =
    score >= 85 ? "#10b981" : score >= 70 ? "#6366f1" : score >= 55 ? "#f59e0b" : "#f43f5e";
  return (
    <svg width="56" height="56" className="-rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
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
  );
}

interface JobCardProps {
  job: Job;
  onSelect?: (job: Job) => void;
}

export default function JobCard({ job, onSelect }: JobCardProps) {
  const matchScore = job.matchScore ?? 0;

  return (
    <div
      onClick={() => onSelect?.(job)}
      className="card cursor-pointer group animate-slide-up"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {job.verificationStatus === "VERIFIED" && (
              <span className="badge badge-verified">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            )}
            {job.levelUp && (
              <span className="badge badge-hot">
                <TrendingUp className="w-3 h-3" /> Career Uplift
              </span>
            )}
            <span className="badge badge-new">{job.workMode}</span>
          </div>
          <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
            {job.title}
          </h3>
          <div className="flex items-center gap-1 text-slate-400 text-sm mt-0.5">
            <Building2 className="w-3.5 h-3.5" />
            <span className="font-medium text-slate-300">{job.organization}</span>
          </div>
        </div>
        {matchScore > 0 && <ScoreRing score={matchScore} />}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mb-3">
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> {job.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> {job.experienceRequired}+ yrs
        </span>
        <span className="font-semibold text-emerald-400">
          {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
        </span>
      </div>

      {/* Description preview */}
      <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
        {job.description}
      </p>

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
      </div>
    </div>
  );
}

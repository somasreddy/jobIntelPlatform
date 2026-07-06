"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JobCard from "@/components/JobCard";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/lib/ProfileContext";
import { CandidateProfile, Job, VerificationStatus, WorkMode } from "@/lib/types";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Filter,
  Globe,
  Search,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";

const AUTO_REFRESH_MS = 10 * 60 * 1000;
const SEARCH_STORAGE = "job_dork_search_v1";

type DorkSearch = {
  title: string;
  experience: string;
  location: string;
  country: string;
  skills: string;
};

type DorkSourcePlan = {
  scope: string;
  country_code: string | null;
  country_label: string;
  job_boards: string[];
  include_ats: boolean;
  reason: string;
};

const defaultDorkSearch: DorkSearch = {
  title: "QA Automation Engineer",
  experience: "7",
  location: "Bengaluru, Hyderabad, Pune, Remote",
  country: "India",
  skills: "Playwright, Selenium WebDriver, API testing",
};

function splitTerms(value: string): string[] {
  return value
    .split(/[,;\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function profileSkillTerms(profile: CandidateProfile | null): string[] {
  if (!profile) return [];
  return [
    ...(profile.skills ?? []),
    ...(profile.frameworks ?? []),
    ...(profile.cicdTools ?? []),
    ...(profile.languages ?? []),
  ].filter(Boolean);
}

function makeStableId(job: Partial<Job>, index: number) {
  const source = `${job.applicationLink || ""}-${job.title || ""}-${job.organization || ""}-${index}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) hash = Math.imul(31, hash) + source.charCodeAt(i) | 0;
  return `dork-${Math.abs(hash)}`;
}

function validWorkMode(value: unknown): WorkMode {
  return value === "Remote" || value === "Hybrid" || value === "On-site" || value === "Any" ? value : "Remote";
}

function validVerification(value: unknown): VerificationStatus {
  return value === "VERIFIED" || value === "PENDING" || value === "UNVERIFIED" ? value : "UNVERIFIED";
}

function scoreAgainstProfile(job: Job, profile: CandidateProfile | null, searchSkills: string[]): number {
  const jdText = `${job.title} ${job.organization} ${job.location} ${job.description} ${(job.technologies ?? []).join(" ")}`.toLowerCase();
  const role = profile?.currentRole?.toLowerCase() || "";
  const skills = Array.from(new Set([...profileSkillTerms(profile), ...searchSkills].map((s) => s.toLowerCase())));

  let score = 35;
  if (role && jdText.includes(role)) score += 15;
  if (job.technologies.length || skills.length) {
    const matched = skills.filter((skill) => skill && jdText.includes(skill));
    score += Math.min(35, Math.round((matched.length / Math.max(skills.length, 1)) * 35));
  }
  const exp = profile?.experienceYears || 0;
  if (exp && job.experienceRequired) score += exp >= job.experienceRequired ? 10 : -8;
  const locationText = `${profile?.currentLocation || ""} ${(profile?.preferredLocations ?? []).join(" ")}`.toLowerCase();
  if (locationText && (job.workMode === "Remote" || locationText.split(/[,\s]+/).some((part) => part.length > 3 && jdText.includes(part)))) score += 8;
  if (job.applicationLink) score += 4;
  return Math.max(10, Math.min(99, score));
}

function normalizeJob(raw: Partial<Job>, index: number, profile: CandidateProfile | null, searchSkills: string[]): Job {
  const salaryMin = Number(raw.salaryMin ?? 0) || 0;
  const salaryMax = Number(raw.salaryMax ?? 0) || 0;
  const normalized: Job = {
    id: raw.id || makeStableId(raw, index),
    title: raw.title || "Untitled opening",
    organization: raw.organization || "Company",
    location: raw.location || "Location not disclosed",
    workMode: validWorkMode(raw.workMode),
    salaryMin,
    salaryMax,
    currency: raw.currency || "USD",
    experienceRequired: Number(raw.experienceRequired ?? 0) || 0,
    technologies: Array.isArray(raw.technologies) ? raw.technologies.filter(Boolean) : [],
    description: raw.description || "JD text was not published in the search result. Open the application link to review the full role.",
    careerPageLink: raw.careerPageLink || raw.applicationLink || "#",
    applicationLink: raw.applicationLink || raw.careerPageLink || "#",
    verificationStatus: validVerification(raw.verificationStatus),
    postedDate: raw.postedDate || new Date().toISOString().slice(0, 10),
    matchScore: Number(raw.matchScore ?? 0) || undefined,
    aiRelevanceScore: Number(raw.aiRelevanceScore ?? 0) || undefined,
    matchReasons: Array.isArray(raw.matchReasons) ? raw.matchReasons.filter(Boolean) : [],
    fitScore: raw.fitScore,
    fitBadge: raw.fitBadge,
    levelUp: Boolean(raw.levelUp),
    source: raw.source || "Dork/Web",
    recruiterName: raw.recruiterName,
    recruiterLinkedIn: raw.recruiterLinkedIn,
    hiringVelocity: raw.hiringVelocity,
    ghostJobRisk: raw.ghostJobRisk,
    competitionLevel: raw.competitionLevel,
    jobFreshnessHours: raw.jobFreshnessHours,
    salaryDisclosed: raw.salaryDisclosed ?? Boolean(salaryMin || salaryMax),
    repostDetected: raw.repostDetected,
  };
  const profileScore = scoreAgainstProfile(normalized, profile, searchSkills);
  normalized.matchScore = Math.max(Number(normalized.matchScore ?? 0), profileScore);
  normalized.fitBadge = normalized.fitBadge || (normalized.matchScore >= 85 ? "Strong profile fit" : normalized.matchScore >= 70 ? "Good profile fit" : "Review JD fit");
  return normalized;
}

function applyProfileDefaults(profile: CandidateProfile | null, current: DorkSearch): DorkSearch {
  if (!profile) return current;
  return {
    title: current.title || profile.currentRole || defaultDorkSearch.title,
    experience: current.experience || String(profile.experienceYears || defaultDorkSearch.experience),
    location: current.location || profile.preferredLocations?.join(", ") || profile.currentLocation || defaultDorkSearch.location,
    country: current.country || "",
    skills: current.skills || profileSkillTerms(profile).slice(0, 8).join(", ") || defaultDorkSearch.skills,
  };
}

export default function JobsPage() {
  const { authHeader } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [dorkSearch, setDorkSearch] = useState<DorkSearch>(defaultDorkSearch);
  const [dorkUrls, setDorkUrls] = useState<string[]>([]);
  const [sourcePlan, setSourcePlan] = useState<DorkSourcePlan | null>(null);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const profileRef = useRef<CandidateProfile | null>(null);
  const profileDefaultsApplied = useRef(false);

  const searchSkills = useMemo(() => splitTerms(dorkSearch.skills), [dorkSearch.skills]);

  const normalizeJobs = (items: Partial<Job>[], activeProfile = profileRef.current) =>
    items.map((job, index) => normalizeJob(job, index, activeProfile, searchSkills));

  const buildPayload = (activeProfile = profileRef.current) => {
    return {
      role: dorkSearch.title.trim(),
      skills: searchSkills,
      frameworks: [],
      cicd_tools: [],
      languages: [],
      experience_years: Number(dorkSearch.experience) || activeProfile?.experienceYears || 0,
      location: dorkSearch.location.trim(),
      country: dorkSearch.country.trim(),
      work_mode: activeProfile?.workMode ?? "Any",
      min_match_score: 45,
      run_verification: true,
    };
  };

  const loadJobs = async (currentProfile: CandidateProfile | null, autoDiscover = false) => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const searchParam = dorkSearch.title ? `&search=${encodeURIComponent(dorkSearch.title)}` : "";
      const res = await fetch(`${apiUrl}/api/jobs/?limit=100${searchParam}`, { headers: authHeader() });
      if (res.ok) {
        const data: Partial<Job>[] = await res.json();
        if (data.length > 0) {
          setJobs(normalizeJobs(data, currentProfile));
          setLastRefresh(new Date());
          if (autoDiscover) {
            const newest = data.reduce((a, b) => new Date(b.postedDate || 0) > new Date(a.postedDate || 0) ? b : a, data[0]);
            const ageHours = (Date.now() - new Date(newest.postedDate || 0).getTime()) / 3600000;
            if (Number.isFinite(ageHours) && ageHours > 24) void runDorkSearch(true, currentProfile);
          }
          return;
        }
      }
      setJobs([]);
      if (autoDiscover && currentProfile) {
        void runDorkSearch(true, currentProfile);
      }
    } catch {
      setJobs([]);
      if (autoDiscover && currentProfile) {
        void runDorkSearch(true, currentProfile);
      }
    } finally {
      setLastRefresh(new Date());
      setLoading(false);
    }
  };

  const runDorkSearch = async (silent = false, activeProfile = profileRef.current) => {
    const payload = buildPayload(activeProfile);
    if (!payload.role) {
      setDiscoverError("Enter a job title before searching.");
      return;
    }

    setDiscovering(true);
    if (!silent) setDiscoverError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const headers = { "Content-Type": "application/json", ...(authHeader() as Record<string, string>) };

      const queryRes = await fetch(`${apiUrl}/api/jobs/dork-query`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (queryRes.ok) {
        const queryData = await queryRes.json();
        setDorkUrls(queryData.google_urls ?? []);
        setSourcePlan(queryData.source_plan ?? null);
      }

      const res = await fetch(`${apiUrl}/api/jobs/discover`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);
      const discovered: Partial<Job>[] = await res.json();
      setJobs(normalizeJobs(discovered, activeProfile));
      setLastRefresh(new Date());
      if (!discovered.length && !silent) {
        setDiscoverError("No openings came back from live search. Try a broader title, fewer skills, or just Remote without a country for worldwide results.");
      }
    } catch (err) {
      if (!silent) {
        const msg = err instanceof Error ? err.message : String(err);
        setJobs([]);
        setDiscoverError(
          msg.includes("Failed to fetch")
            ? "Backend is not reachable on http://localhost:8000. Start the backend and search again."
            : `Discovery unavailable (${msg}). No stale results are shown for this search.`
        );
      }
    } finally {
      setDiscovering(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SEARCH_STORAGE);
      if (saved) setDorkSearch({ ...defaultDorkSearch, ...JSON.parse(saved) });
    } catch {
      // ignore storage issues
    } finally {
      setStorageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      localStorage.setItem(SEARCH_STORAGE, JSON.stringify(dorkSearch));
    } catch {
      // ignore storage issues
    }
  }, [dorkSearch, storageHydrated]);

  useEffect(() => {
    if (profileLoading) return;
    profileRef.current = profile;
    if (profile && !profileDefaultsApplied.current) {
      setDorkSearch((current) => applyProfileDefaults(profile, current));
      profileDefaultsApplied.current = true;
    }
    void loadJobs(profile, Boolean(profile));
    const interval = setInterval(() => void loadJobs(profileRef.current, Boolean(profileRef.current)), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile, storageHydrated]);

  const filtered = jobs;
  const upliftCount = jobs.filter((j) => j.levelUp).length;
  const verifiedCount = jobs.filter((j) => j.verificationStatus === "VERIFIED").length;
  const strongFitCount = jobs.filter((j) => (j.fitScore ?? j.matchScore ?? 0) >= 80).length;
  const sourceCount = new Set(jobs.map((j) => j.source || "Other")).size;
  const searchLocation = [dorkSearch.location, dorkSearch.country].filter(Boolean).join(", ") || "Any location";

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Dork-powered job discovery</p>
            <h1 className="text-2xl font-bold text-white">
              {dorkSearch.title || "Any Title"} <span className="gradient-text">Find Jobs</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {dorkSearch.experience || "0"}+ yrs - {searchLocation} - profile score is calculated from each JD before apply
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void runDorkSearch(false)}
              disabled={discovering || loading}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Zap className={`w-4 h-4 ${discovering || loading ? "animate-pulse" : ""}`} />
              {discovering || loading ? "Finding Latest Jobs..." : "Find Latest Jobs"}
            </button>
          </div>
        </div>

        <div className="card mb-6 py-4 space-y-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Job search and filters</p>
              <p className="text-xs text-slate-500 mt-0.5">These values are used directly for dork discovery and AI relevance matching.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>{jobs.length} matched openings</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Title</span>
              <input
                className="input"
                value={dorkSearch.title}
                onChange={(e) => setDorkSearch((s) => ({ ...s, title: e.target.value }))}
                placeholder="Senior QA Engineer, SDET, Product Manager..."
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Experience</span>
              <input
                className="input"
                type="number"
                min={0}
                value={dorkSearch.experience}
                onChange={(e) => setDorkSearch((s) => ({ ...s, experience: e.target.value }))}
                placeholder="7"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Location</span>
              <input
                className="input"
                value={dorkSearch.location}
                onChange={(e) => setDorkSearch((s) => ({ ...s, location: e.target.value }))}
                placeholder="Bengaluru, Dublin, Remote"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Country</span>
              <input
                className="input"
                value={dorkSearch.country}
                onChange={(e) => setDorkSearch((s) => ({ ...s, country: e.target.value }))}
                placeholder="India, Ireland, Canada"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Skills / technologies</span>
            <input
              className="input"
              value={dorkSearch.skills}
              onChange={(e) => setDorkSearch((s) => ({ ...s, skills: e.target.value }))}
              placeholder="Playwright, Selenium WebDriver, API testing, Java"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            Search uses only the title, skill, experience, location, and country entered above. Your profile is used later for fit scoring.
            {sourcePlan && (
              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 font-medium text-cyan-300">
                {sourcePlan.country_label}: {sourcePlan.include_ats ? "all supported sources" : "country boards only"} ({sourcePlan.job_boards.length} boards)
              </span>
            )}
            {dorkUrls.length > 0 && (
              <>
                <span className="hidden sm:inline text-slate-700">|</span>
                {dorkUrls.map((url, index) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200">
                    Query {index + 1}<ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </>
            )}
          </div>


        </div>

        {discoverError && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {discoverError}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {[
            { label: "Openings", value: jobs.length, icon: Briefcase, color: "text-indigo-400" },
            { label: "Strong Fit", value: strongFitCount, icon: Sparkles, color: "text-emerald-400" },
            { label: "Verified Links", value: verifiedCount, icon: CheckCircle2, color: "text-cyan-400" },
            { label: "Sources", value: sourceCount, icon: Globe, color: "text-amber-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card py-3 px-4">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Icon className={`w-4 h-4 ${color}`} /> {label}
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>



        {loading || discovering ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-64 skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="font-medium">
              {"No jobs loaded yet"}
            </p>
            <p className="text-sm mt-1">
              Enter a title, experience, location, and country, then run Find Latest Jobs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filtered.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        )}

        <p className="text-xs text-slate-600 text-center mt-6" suppressHydrationWarning>
          Last checked: {lastRefresh.toLocaleTimeString()} - Auto-checks real sources every 10 minutes
        </p>
      </main>
    </div>
  );
}


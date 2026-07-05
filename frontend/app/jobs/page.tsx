"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JobCard from "@/components/JobCard";
import { mockJobs } from "@/lib/mockData";
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
  MapPin,
  RefreshCw,
  Search,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";

const WORK_MODES = ["All", "Remote", "Hybrid", "On-site"];
const TECH_FILTERS = [
  "All",
  "Playwright", "Selenium", "Cypress", "K6",
  "Python", "Java", "TypeScript", "JavaScript",
  "AWS", "Azure", "Kubernetes", "Terraform", "Jenkins", "GitHub Actions", "Docker",
  "webMethods", "webMethods.IO", "Trading Networks", "webMethods BPM",
  "MuleSoft", "Dell Boomi", "IBM Sterling", "IBM MQ", "TIBCO",
  "SAP CPI", "Axway", "Informatica",
  "Kong", "Apigee", "Azure APIM", "IBM API Connect",
  "EDI X12", "EDIFACT", "AS2", "FHIR", "HL7",
  "PostgreSQL", "Oracle DB", "MongoDB", "Snowflake",
];
const PORTAL_FILTERS = [
  "All", "Dork/Google", "Dork/Bing", "Dork/DuckDuckGo",
  "LinkedIn", "Indeed", "Glassdoor", "Naukri", "Adzuna",
  "Remotive", "Arbeitnow", "WeWorkRemotely", "HackerNews", "AuthenticJobs",
  "Greenhouse", "Lever", "Wellfound", "Direct", "Other",
];
const AUTO_REFRESH_MS = 10 * 60 * 1000;
const SEARCH_STORAGE = "job_dork_search_v1";

type DorkSearch = {
  title: string;
  experience: string;
  location: string;
  country: string;
  skills: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [workMode, setWorkMode] = useState("All");
  const [techFilter, setTechFilter] = useState("All");
  const [portalFilter, setPortalFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState<"All" | "SameLevel" | "CareerUplift">("All");
  const [minScore, setMinScore] = useState(0);
  const [strictMode, setStrictMode] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [dorkSearch, setDorkSearch] = useState<DorkSearch>(defaultDorkSearch);
  const [dorkUrls, setDorkUrls] = useState<string[]>([]);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const profileRef = useRef<CandidateProfile | null>(null);
  const profileDefaultsApplied = useRef(false);

  const searchSkills = useMemo(() => splitTerms(dorkSearch.skills), [dorkSearch.skills]);

  const normalizeJobs = (items: Partial<Job>[], activeProfile = profileRef.current) =>
    items.map((job, index) => normalizeJob(job, index, activeProfile, searchSkills));

  const buildPayload = (activeProfile = profileRef.current) => {
    const combinedSkills = Array.from(new Set([...searchSkills, ...profileSkillTerms(activeProfile)]));
    return {
      role: dorkSearch.title.trim(),
      skills: combinedSkills,
      frameworks: activeProfile?.frameworks ?? [],
      cicd_tools: activeProfile?.cicdTools ?? [],
      languages: activeProfile?.languages ?? [],
      experience_years: Number(dorkSearch.experience) || activeProfile?.experienceYears || 0,
      location: dorkSearch.location.trim(),
      country: dorkSearch.country.trim(),
      work_mode: activeProfile?.workMode ?? "Any",
      min_match_score: strictMode ? Math.max(70, minScore) : minScore,
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
      if (autoDiscover && currentProfile) {
        void runDorkSearch(true, currentProfile);
        return;
      }
    } catch {
      // fall back below
    } finally {
      setLoading(false);
    }
    setJobs(normalizeJobs(mockJobs, currentProfile));
    setLastRefresh(new Date());
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
        setDiscoverError("No openings came back from the dork search. Try a broader title, fewer skills, or a wider country/location.");
      }
    } catch (err) {
      if (!silent) {
        const msg = err instanceof Error ? err.message : String(err);
        setDiscoverError(
          msg.includes("Failed to fetch")
            ? "Backend is not reachable on http://localhost:8000. Start the backend and search again."
            : `Discovery unavailable (${msg}). Cached/mock jobs are still shown below.`
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
      if (profile.workMode && profile.workMode !== "Any") setWorkMode(profile.workMode);
      profileDefaultsApplied.current = true;
    }
    void loadJobs(profile, Boolean(profile));
    const interval = setInterval(() => void loadJobs(profileRef.current, Boolean(profileRef.current)), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile, storageHydrated]);

  const refresh = () => void loadJobs(profileRef.current, false);

  const filtered = jobs.filter((j) => {
    const q = searchQuery.toLowerCase();
    const matchesQ =
      !q ||
      j.title.toLowerCase().includes(q) ||
      j.organization.toLowerCase().includes(q) ||
      j.technologies.some((t) => t.toLowerCase().includes(q)) ||
      j.location.toLowerCase().includes(q);
    const matchesMode = workMode === "All" || j.workMode === workMode;
    const matchesTech = techFilter === "All" || j.technologies.includes(techFilter);
    const matchesLevel = levelFilter === "All" ? true : levelFilter === "CareerUplift" ? j.levelUp : !j.levelUp;
    const matchesPortal = portalFilter === "All" || j.source === portalFilter;
    const matchesScore = (j.fitScore ?? j.matchScore ?? 0) >= minScore;
    return matchesQ && matchesMode && matchesTech && matchesLevel && matchesPortal && matchesScore;
  });

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
              {dorkSearch.title || "Any Title"} <span className="gradient-text">Job Dashboard</span>
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
              <Zap className={`w-4 h-4 ${discovering ? "animate-pulse" : ""}`} />
              {discovering ? "Searching Dork Sites..." : "Search Dork Jobs"}
            </button>
            <button
              onClick={refresh}
              disabled={loading || discovering}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="card mb-6 py-4 space-y-4">
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
            <span className="text-xs font-medium text-slate-400">Skills / technologies used for dork matching and profile fit</span>
            <input
              className="input"
              value={dorkSearch.skills}
              onChange={(e) => setDorkSearch((s) => ({ ...s, skills: e.target.value }))}
              placeholder="Playwright, Selenium WebDriver, API testing, Java"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            {profile ? "Saved profile skills are merged into scoring automatically." : "No saved profile loaded; score uses the search skills until profile is available."}
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

        <div className="card mb-6 py-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-56 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                className="input pl-9"
                placeholder="Filter displayed results by role, company, technology..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-base)" }}>
              {(["All", "CareerUplift", "SameLevel"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLevelFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    levelFilter === f ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {f === "All" ? "All Jobs" : f === "CareerUplift" ? "Career Uplift" : "Same Level+"}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setStrictMode((s) => !s);
                if (!strictMode) setMinScore((m) => Math.max(m, 70));
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                strictMode
                  ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                  : "bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Strict Match {strictMode ? "ON" : "OFF"}
            </button>

            <span className="text-xs text-slate-500 whitespace-nowrap">
              <Filter className="w-3 h-3 inline mr-1" />{filtered.length} results
            </span>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <MapPin className="w-3.5 h-3.5" />
              <select className="input py-1.5 text-xs w-28" value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
                {WORK_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <Sliders className="w-3.5 h-3.5" />
              <select className="input py-1.5 text-xs w-40" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
                {TECH_FILTERS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <Globe className="w-3.5 h-3.5" />
              <select className="input py-1.5 text-xs w-44" value={portalFilter} onChange={(e) => setPortalFilter(e.target.value)}>
                {PORTAL_FILTERS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              <span className="whitespace-nowrap">Min score:</span>
              <input
                type="range" min={0} max={95} step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-24 accent-indigo-500"
              />
              <span className={`font-semibold w-8 ${minScore >= 80 ? "text-emerald-400" : minScore >= 60 ? "text-indigo-400" : "text-slate-400"}`}>
                {minScore > 0 ? `${minScore}%` : "Any"}
              </span>
            </div>
          </div>
        </div>

        {loading || discovering ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-64 skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="font-medium">No jobs match the current filters</p>
            <p className="text-sm mt-1">Enter a title, experience, location, and country, then run Search Dork Jobs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filtered.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        )}

        <p className="text-xs text-slate-600 text-center mt-6" suppressHydrationWarning>
          Last refreshed: {lastRefresh.toLocaleTimeString()} - Auto-refreshes every 10 minutes
        </p>
      </main>
    </div>
  );
}


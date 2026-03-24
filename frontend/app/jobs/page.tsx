"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import JobCard from "@/components/JobCard";
import { mockJobs } from "@/lib/mockData";
import { useProfile } from "@/lib/ProfileContext";
import { Job, CandidateProfile, JobPortal } from "@/lib/types";
import {
  Search, Filter, MapPin, Sliders, TrendingUp,
  CheckCircle2, RefreshCw, Briefcase, UserCircle2,
  Zap, AlertCircle, SlidersHorizontal, Globe
} from "lucide-react";

const WORK_MODES = ["All", "Remote", "Hybrid", "On-site"];
const TECH_FILTERS = [
  "All",
  // QA / Automation
  "Playwright", "Selenium", "Cypress", "K6",
  // Languages
  "Python", "Java", "TypeScript",
  // Cloud / DevOps
  "AWS", "Azure", "Kubernetes", "Terraform", "Jenkins", "GitHub Actions", "Docker",
  // B2B Integration
  "webMethods", "webMethods.IO", "Trading Networks", "webMethods BPM",
  "MuleSoft", "Dell Boomi", "IBM Sterling", "IBM MQ", "TIBCO",
  "SAP CPI", "Axway", "Informatica",
  // API Management
  "Kong", "Apigee", "Azure APIM", "IBM API Connect",
  // EDI / Standards
  "EDI X12", "EDIFACT", "AS2",
  // Databases
  "PostgreSQL", "Oracle DB", "MongoDB", "Snowflake",
];
const PORTAL_FILTERS: Array<"All" | JobPortal> = ["All", "LinkedIn", "Indeed", "Glassdoor", "Naukri", "Adzuna", "Remotive", "Arbeitnow", "TheMuse", "RemoteOK", "Jobicy", "Direct"];
const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10 minutes

export default function JobsPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [workMode, setWorkMode] = useState("All");
  const [techFilter, setTechFilter] = useState("All");
  const [portalFilter, setPortalFilter] = useState<"All" | JobPortal>("All");
  const [levelFilter, setLevelFilter] = useState<"All" | "SameLevel" | "CareerUplift">("All");
  const [minScore, setMinScore] = useState(0);
  const [strictMode, setStrictMode] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const profileRef = useRef<CandidateProfile | null>(null);

  const loadJobs = async (currentProfile: CandidateProfile, autoDiscover = false) => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      {
        const searchParam = currentProfile.currentRole ? `&search=${encodeURIComponent(currentProfile.currentRole)}` : "";
        const res = await fetch(`${apiUrl}/api/jobs/?limit=100${searchParam}`);
        if (res.ok) {
          const data: Job[] = await res.json();
          if (data.length > 0) {
            setJobs(data);
            setLastRefresh(new Date());
            setLoading(false);
            // Auto-discover in background if data looks stale (oldest job > 24h)
            if (autoDiscover) {
              const newest = data.reduce((a, b) =>
                new Date(b.postedDate) > new Date(a.postedDate) ? b : a, data[0]);
              const ageHours = (Date.now() - new Date(newest.postedDate).getTime()) / 3600000;
              if (ageHours > 24) findBestMatchesSilent(currentProfile);
            }
            return;
          }
        }
        // No cached jobs — trigger live discovery immediately
        if (autoDiscover) {
          setLoading(false);
          findBestMatchesSilent(currentProfile);
          return;
        }
      }
    } catch { /* fall through to mock */ }
    setJobs([...mockJobs]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  const findBestMatchesSilent = (currentProfile: CandidateProfile) => {
    const p = currentProfile;
    setDiscovering(true);
    setDiscoverError(null);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/api/jobs/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: p.currentRole,
        skills: p.skills,
        frameworks: p.frameworks,
        cicd_tools: p.cicdTools,
        languages: p.languages,
        experience_years: p.experienceYears,
        location: p.preferredLocations?.[0] || p.currentLocation || "",
        work_mode: p.workMode,
        min_match_score: 0,
        run_verification: true,
      }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((discovered: Job[]) => {
        if (discovered.length > 0) {
          setJobs(discovered);
          setLastRefresh(new Date());
        }
      })
      .catch(() => {/* silent — user already sees cached or mock data */})
      .finally(() => setDiscovering(false));
  };

  const findBestMatches = async () => {
    if (!profile) return;
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/jobs/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: profile.currentRole,
          skills: profile.skills,
          frameworks: profile.frameworks,
          cicd_tools: profile.cicdTools,
          languages: profile.languages,
          experience_years: profile.experienceYears,
          location: profile.preferredLocations?.[0] || profile.currentLocation || "",
          work_mode: profile.workMode,
          min_match_score: strictMode ? Math.max(70, minScore) : minScore,
          run_verification: true,
        }),
      });
      if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);
      const discovered: Job[] = await res.json();
      if (discovered.length > 0) {
        setJobs(discovered);
        setLastRefresh(new Date());
      } else {
        setDiscoverError("No matches found from live portals. Showing local data.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("API not configured") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setDiscoverError("Backend not reachable. Make sure the backend server is running on http://localhost:8000 — showing mock data instead.");
      } else {
        setDiscoverError(`Discovery unavailable (${msg}) — showing cached/mock jobs.`);
      }
    } finally {
      setDiscovering(false);
    }
  };

  useEffect(() => {
    if (profileLoading || !profile) return;

    profileRef.current = profile;

    if (profile.workMode && profile.workMode !== "Any") setWorkMode(profile.workMode);

    loadJobs(profile, true);

    const interval = setInterval(() => {
      if (profileRef.current) loadJobs(profileRef.current, true);
    }, AUTO_REFRESH_MS);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile]);

  const refresh = () => { if (profile) loadJobs(profile); };

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
    const matchesLevel =
      levelFilter === "All" ? true : levelFilter === "CareerUplift" ? j.levelUp : !j.levelUp;
    const matchesPortal = portalFilter === "All" || j.source === portalFilter;
    const matchesScore = (j.matchScore ?? 0) >= minScore;
    return matchesQ && matchesMode && matchesTech && matchesLevel && matchesPortal && matchesScore;
  });

  const upliftCount = jobs.filter((j) => j.levelUp).length;
  const verifiedCount = jobs.filter((j) => j.verificationStatus === "VERIFIED").length;
  const unverifiedCount = jobs.filter((j) => j.verificationStatus !== "VERIFIED").length;

  if (!profileLoading && !profile) {
    return (
      <div className="flex min-h-screen bg-transparent">
        <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <UserCircle2 className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-white font-semibold text-xl mb-2">No profile found</h2>
            <p className="text-slate-400 text-sm mb-6">
              Complete your career profile first — we&apos;ll match you with verified jobs tailored to your skills and experience.
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
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Showing results for</p>
            <h1 className="text-2xl font-bold text-white">
              {profile?.currentRole || "Your Profile"} → <span className="gradient-text">Career Uplift Jobs</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {profile?.experienceYears || 0} yrs experience · {profile?.currentLocation || "Location not set"} · looking for &gt;{" "}
              <span className="text-emerald-400 font-medium">
                {profile?.currency || "USD"} {profile?.currentSalary ? Number(profile.currentSalary).toLocaleString() : "0"}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={findBestMatches}
              disabled={discovering || loading}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Zap className={`w-4 h-4 ${discovering ? "animate-pulse" : ""}`} />
              {discovering ? "Searching Portals…" : "Find Best Matches"}
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

        {/* Discovery error / info banner */}
        {discoverError && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {discoverError}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {[
            { label: "Total Matches", value: jobs.length, icon: Briefcase, color: "text-indigo-400" },
            { label: "Career Uplift", value: upliftCount, icon: TrendingUp, color: "text-rose-400" },
            { label: "Verified", value: verifiedCount, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Unverified", value: unverifiedCount, icon: AlertCircle, color: "text-amber-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card py-3 px-4">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Icon className={`w-4 h-4 ${color}`} /> {label}
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card mb-6 py-4 space-y-3">
          {/* Row 1 — search + level toggle + strict mode */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-56 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                className="input pl-9"
                placeholder="Search role, company, or technology…"
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
                  {f === "All" ? "All Jobs" : f === "CareerUplift" ? "🚀 Career Uplift" : "↗ Same Level+"}
                </button>
              ))}
            </div>

            {/* Strict mode toggle */}
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

          {/* Row 2 — work mode, tech, portal, min score */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <MapPin className="w-3.5 h-3.5" />
              <select className="input py-1.5 text-xs w-28" value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
                {WORK_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <Sliders className="w-3.5 h-3.5" />
              <select className="input py-1.5 text-xs w-36" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
                {TECH_FILTERS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Portal source filter */}
            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <Globe className="w-3.5 h-3.5" />
              <select
                className="input py-1.5 text-xs w-36"
                value={portalFilter}
                onChange={(e) => setPortalFilter(e.target.value as "All" | JobPortal)}
              >
                {PORTAL_FILTERS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>

            {/* Min match score slider */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="whitespace-nowrap">Min match:</span>
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

        {/* Job Grid */}
        {loading || discovering ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-64 skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="font-medium">No jobs match your current filters</p>
            <p className="text-sm mt-1">Try adjusting your search or filters, or click <strong>Find Best Matches</strong> to search live portals</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}

        <p className="text-xs text-slate-600 text-center mt-6" suppressHydrationWarning>
          Last refreshed: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 10 minutes
        </p>
      </main>
    </div>
  );
}

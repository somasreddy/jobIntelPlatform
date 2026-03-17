"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import JobCard from "@/components/JobCard";
import { mockJobs } from "@/lib/mockData";
import { loadProfile } from "@/lib/profile";
import { Job, CandidateProfile } from "@/lib/types";
import {
  Search, Filter, MapPin, Sliders, TrendingUp,
  CheckCircle2, RefreshCw, Briefcase, UserCircle2
} from "lucide-react";

const WORK_MODES = ["All", "Remote", "Hybrid", "On-site"];
const TECH_FILTERS = ["All", "Playwright", "Selenium", "Python", "Java", "TypeScript", "Cypress", "K6", "AWS"];
const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10 minutes

export default function JobsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workMode, setWorkMode] = useState("All");
  const [techFilter, setTechFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState<"All" | "SameLevel" | "CareerUplift">("All");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const profileRef = useRef<CandidateProfile | null>(null);

  const loadJobs = async (currentProfile: CandidateProfile) => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (apiUrl) {
        const searchParam = currentProfile.currentRole ? `&search=${encodeURIComponent(currentProfile.currentRole)}` : "";
        const res = await fetch(`${apiUrl}/api/jobs/?limit=100${searchParam}`);
        if (res.ok) {
          const data: Job[] = await res.json();
          if (data.length > 0) {
            setJobs(data);
            setLastRefresh(new Date());
            setLoading(false);
            return;
          }
        }
      }
    } catch { /* fall through to mock */ }
    setJobs([...mockJobs]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    profileRef.current = p;
    setProfileChecked(true);

    if (!p) return;

    // Default work mode filter from saved profile preference
    if (p.workMode && p.workMode !== "Any") setWorkMode(p.workMode);

    loadJobs(p);

    // Auto-refresh every 10 minutes
    const interval = setInterval(() => {
      if (profileRef.current) loadJobs(profileRef.current);
    }, AUTO_REFRESH_MS);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    return matchesQ && matchesMode && matchesTech && matchesLevel;
  });

  const upliftCount = jobs.filter((j) => j.levelUp).length;
  const sameLevelCount = jobs.filter((j) => !j.levelUp).length;
  const verifiedCount = jobs.filter((j) => j.verificationStatus === "VERIFIED").length;

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
      <Navbar />
      <main className="ml-64 flex-1 px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
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
          <button
            onClick={refresh}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Jobs
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Matches", value: jobs.length, icon: Briefcase, color: "text-indigo-400" },
            { label: "Career Uplift", value: upliftCount, icon: TrendingUp, color: "text-rose-400" },
            { label: "Same Level+", value: sameLevelCount, icon: Briefcase, color: "text-amber-400" },
            { label: "Verified Jobs", value: verifiedCount, icon: CheckCircle2, color: "text-emerald-400" },
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
        <div className="card mb-6 py-4">
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

            <div className="flex gap-1 bg-[#0f172a] rounded-lg p-1">
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

            <span className="text-xs text-slate-500 whitespace-nowrap">
              <Filter className="w-3 h-3 inline mr-1" />{filtered.length} results
            </span>
          </div>
        </div>

        {/* Job Grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-64 skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="font-medium">No jobs match your current filters</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
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

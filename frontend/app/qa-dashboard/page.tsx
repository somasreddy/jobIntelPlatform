"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bookmark,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Globe2,
  MapPin,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Star,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

type QaCategory = "Healthcare" | "Low-Code" | "General";
type QaStatus = "new" | "bookmarked" | "applied";

interface QaJob {
  id: string;
  title: string;
  company: string;
  location: string;
  fitScore: number;
  category: QaCategory;
  status: QaStatus;
  source: string;
  posted: string;
  salary: string;
  url: string;
  summary: string;
  keywords: string[];
  gaps: string[];
  resumeFocus: string[];
}

interface Tweak {
  id: string;
  label: string;
  current: string;
  suggested: string;
}

type PortalStatus = "Idle" | "Fetching" | "Merged" | "No jobs" | "Unavailable";

interface SearchProfile {
  role: string;
  skills: string;
  location: string;
  experienceYears: string;
}

const defaultSearchProfile: SearchProfile = {
  role: "QA Automation Engineer",
  skills: "Playwright, Selenium WebDriver, API Testing, CI/CD",
  location: "India, Bengaluru, Hyderabad, Pune, Remote",
  experienceYears: "7",
};

const STORAGE_JOBS = "qa_dashboard_jobs_v2";
const STORAGE_BOOKMARKS = "qa_dashboard_bookmarks_v2";
const STORAGE_APPLIED = "qa_dashboard_applied_v2";
const STORAGE_PORTALS = "qa_dashboard_portals_v2";
const STORAGE_SEARCH_PROFILE = "qa_dashboard_search_profile_v1";

const portals = ["LinkedIn", "Naukri", "Indeed", "Glassdoor", "Wellfound", "RemoteOK"];

const seedJobs: QaJob[] = [
  {
    id: "qa-healthcare-automation-lead",
    title: "Senior QA Automation Lead",
    company: "CareBridge Health",
    location: "Hyderabad / Remote",
    fitScore: 94,
    category: "Healthcare",
    status: "new",
    source: "LinkedIn",
    posted: "2 days ago",
    salary: "INR 32L - 44L",
    url: "https://example.com/jobs/qa-healthcare-automation-lead",
    summary: "Own Playwright, API, and healthcare workflow automation across patient-facing platforms.",
    keywords: ["Playwright", "API Testing", "FHIR", "CI/CD", "Regression"],
    gaps: ["Healthcare domain vocabulary", "FHIR test data"],
    resumeFocus: ["automation framework ownership", "defect leakage reduction", "regulated domain testing"],
  },
  {
    id: "qa-low-code-test-architect",
    title: "QA Architect - Low-Code Platforms",
    company: "FlowOps Cloud",
    location: "Bengaluru / Hybrid",
    fitScore: 89,
    category: "Low-Code",
    status: "new",
    source: "Naukri",
    posted: "5 days ago",
    salary: "INR 36L - 52L",
    url: "https://example.com/jobs/qa-low-code-test-architect",
    summary: "Build quality strategy for workflow automation, API integrations, and release governance.",
    keywords: ["Low-Code", "API Automation", "webMethods", "Jenkins", "Test Strategy"],
    gaps: ["Platform governance examples"],
    resumeFocus: ["integration testing", "release quality gates", "automation ROI"],
  },
  {
    id: "principal-sdet-platform",
    title: "Principal SDET - Platform Quality",
    company: "VectorScale Systems",
    location: "Pune / Remote",
    fitScore: 86,
    category: "General",
    status: "new",
    source: "Indeed",
    posted: "1 week ago",
    salary: "INR 40L - 58L",
    url: "https://example.com/jobs/principal-sdet-platform",
    summary: "Drive contract, performance, and end-to-end quality across distributed services.",
    keywords: ["Contract Testing", "K6", "Kubernetes", "TypeScript", "Observability"],
    gaps: ["Performance benchmark portfolio"],
    resumeFocus: ["distributed systems quality", "pipeline acceleration", "observability-driven QA"],
  },
  {
    id: "qa-manager-healthtech",
    title: "QA Manager - HealthTech SaaS",
    company: "MedLedger AI",
    location: "Chennai / Hybrid",
    fitScore: 82,
    category: "Healthcare",
    status: "new",
    source: "Glassdoor",
    posted: "3 days ago",
    salary: "INR 30L - 42L",
    url: "https://example.com/jobs/qa-manager-healthtech",
    summary: "Lead QA planning, automation coverage, and compliance release readiness for SaaS products.",
    keywords: ["Team Leadership", "SaaS QA", "Compliance", "Automation Coverage", "Scrum"],
    gaps: ["Compliance audit metrics"],
    resumeFocus: ["team leadership through outcomes", "coverage growth", "release confidence"],
  },
];

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseSkillInput(value: string): string[] {
  return value.split(/[,;|\n]+/).map((item) => item.trim()).filter(Boolean);
}

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeJob(raw: Record<string, unknown>, index: number): QaJob {
  const title = String(raw.title || raw.jobTitle || raw.role || "QA Role");
  const company = String(raw.company || raw.organization || raw.employer || "Unknown company");
  const categoryValue = String(raw.category || "General");
  const category: QaCategory = categoryValue === "Healthcare" || categoryValue === "Low-Code" ? categoryValue : "General";
  const fitScore = Number(raw.fitScore || raw.matchScore || raw.score || 70);
  const statusValue = String(raw.status || "new").toLowerCase();
  const status: QaStatus = statusValue === "applied" || statusValue === "bookmarked" ? statusValue : "new";

  return {
    id: String(raw.id || `${company}-${title}-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    title,
    company,
    location: String(raw.location || "Remote"),
    fitScore: Math.max(0, Math.min(100, fitScore || 70)),
    category,
    status,
    source: String(raw.source || raw.portal || "Imported"),
    posted: String(raw.posted || raw.postedDate || raw.date || "Recently"),
    salary: String(raw.salary || raw.salaryRange || "Not disclosed"),
    url: String(raw.url || raw.applicationLink || raw.applyUrl || ""),
    summary: String(raw.summary || raw.description || "QA opportunity imported into the intelligence dashboard."),
    keywords: normalizeArray(raw.keywords || raw.technologies || raw.skills).slice(0, 8),
    gaps: normalizeArray(raw.gaps || raw.missingKeywords).slice(0, 5),
    resumeFocus: normalizeArray(raw.resumeFocus || raw.resume_focus || raw.focus).slice(0, 5),
  };
}

function getTweaksForJob(job: QaJob): Tweak[] {
  const topKeywords = job.keywords.slice(0, 4).join(", ") || "automation, API testing, CI/CD";
  const focus = job.resumeFocus[0] || "automation framework ownership";
  const gap = job.gaps[0] || "role-specific domain evidence";

  return [
    {
      id: "headline",
      label: "Title line",
      current: "QA Automation Engineer | SDET | Test Automation",
      suggested: `${job.title} | ${topKeywords} | ${job.category} Quality Strategy`,
    },
    {
      id: "summary",
      label: "Summary hook",
      current: "Experienced QA professional with strong automation and testing skills.",
      suggested: `Accomplished QA leader with deep experience in ${topKeywords}. Delivered ${focus} for complex product teams and positioned to solve ${job.company}'s ${job.category.toLowerCase()} quality needs.`,
    },
    {
      id: "bullet-impact",
      label: "Impact bullet",
      current: "Worked on automation framework and improved testing process.",
      suggested: `Architected ${job.keywords[0] || "automation"} regression coverage for critical workflows, reducing release validation effort by 40% while improving defect detection before production.`,
    },
    {
      id: "gap-bridge",
      label: "Gap bridge",
      current: "No explicit domain alignment stated.",
      suggested: `Add a defensible example showing ${gap}: project context, tooling used, measurable result, and how it maps to ${job.title}.`,
    },
  ];
}

export default function QaDashboardPage() {
  const { authHeader } = useAuth();
  const [jobs, setJobs] = useState<QaJob[]>(seedJobs);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | QaCategory>("All");
  const [location, setLocation] = useState("All");
  const [status, setStatus] = useState<"All" | QaStatus>("All");
  const [minFit, setMinFit] = useState(70);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<QaJob | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mergeMode, setMergeMode] = useState<"merge" | "replace">("merge");
  const [selectedPortals, setSelectedPortals] = useState<Set<string>>(new Set(["LinkedIn", "Naukri", "Indeed"]));
  const [portalStatus, setPortalStatus] = useState<Record<string, PortalStatus>>({});
  const [searchProfile, setSearchProfile] = useState<SearchProfile>(defaultSearchProfile);
  const [globalStatus, setGlobalStatus] = useState("Dashboard ready");
  const [refreshOpen, setRefreshOpen] = useState(false);

  useEffect(() => {
    setJobs(safeJson(localStorage.getItem(STORAGE_JOBS), seedJobs));
    setBookmarks(new Set(safeJson<string[]>(localStorage.getItem(STORAGE_BOOKMARKS), [])));
    setApplied(new Set(safeJson<string[]>(localStorage.getItem(STORAGE_APPLIED), [])));
    setSelectedPortals(new Set(safeJson<string[]>(localStorage.getItem(STORAGE_PORTALS), ["LinkedIn", "Naukri", "Indeed"])));
    setSearchProfile(safeJson<SearchProfile>(localStorage.getItem(STORAGE_SEARCH_PROFILE), defaultSearchProfile));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_JOBS, JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_BOOKMARKS, JSON.stringify([...bookmarks]));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_APPLIED, JSON.stringify([...applied]));
  }, [applied]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PORTALS, JSON.stringify([...selectedPortals]));
  }, [selectedPortals]);

  useEffect(() => {
    localStorage.setItem(STORAGE_SEARCH_PROFILE, JSON.stringify(searchProfile));
  }, [searchProfile]);

  useEffect(() => {
    if (!selectedJob) return;
    const timer = window.setTimeout(() => saveDraft(false), 500);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, selectedJob?.id]);

  const locations = useMemo(() => ["All", ...Array.from(new Set(jobs.map((job) => job.location)))], [jobs]);

  const decoratedJobs = useMemo(() => jobs.map((job) => ({
    ...job,
    status: applied.has(job.id) ? "applied" as QaStatus : bookmarks.has(job.id) ? "bookmarked" as QaStatus : job.status,
  })), [jobs, applied, bookmarks]);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decoratedJobs
      .filter((job) => {
        const haystack = [job.title, job.company, job.location, job.source, job.summary, ...job.keywords].join(" ").toLowerCase();
        return !q || haystack.includes(q);
      })
      .filter((job) => category === "All" || job.category === category)
      .filter((job) => location === "All" || job.location === location)
      .filter((job) => status === "All" || job.status === status)
      .filter((job) => job.fitScore >= minFit)
      .sort((a, b) => b.fitScore - a.fitScore);
  }, [decoratedJobs, query, category, location, status, minFit]);

  const stats = useMemo(() => ({
    total: decoratedJobs.length,
    highFit: decoratedJobs.filter((job) => job.fitScore >= 85).length,
    bookmarked: decoratedJobs.filter((job) => job.status === "bookmarked").length,
    applied: decoratedJobs.filter((job) => job.status === "applied").length,
  }), [decoratedJobs]);

  const openTweakModal = (job: QaJob) => {
    const saved = safeJson<Record<string, string>>(localStorage.getItem(`qa_dashboard_draft_${job.id}`), {});
    const initial = Object.fromEntries(getTweaksForJob(job).map((tweak) => [tweak.id, saved[tweak.id] || tweak.suggested]));
    setDrafts(initial);
    setSelectedJob(job);
  };

  const saveDraft = (showStatus = true) => {
    if (!selectedJob) return;
    localStorage.setItem(`qa_dashboard_draft_${selectedJob.id}`, JSON.stringify(drafts));
    if (showStatus) setGlobalStatus(`Draft saved for ${selectedJob.company}`);
  };

  const copyText = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    setGlobalStatus(message);
  };

  const copyAllEdits = async () => {
    if (!selectedJob) return;
    const text = getTweaksForJob(selectedJob).map((tweak) => `${tweak.label}\n${drafts[tweak.id] || tweak.suggested}`).join("\n\n");
    await copyText(text, "All resume edits copied");
  };

  const downloadEdits = () => {
    if (!selectedJob) return;
    const text = getTweaksForJob(selectedJob).map((tweak) => `${tweak.label}\n${drafts[tweak.id] || tweak.suggested}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedJob.company}-${selectedJob.title}-resume-edits.txt`.replace(/[^a-z0-9.-]+/gi, "-");
    a.click();
    URL.revokeObjectURL(url);
    setGlobalStatus("Resume edits downloaded");
  };

  const toggleBookmark = (jobId: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const toggleApplied = (jobId: string) => {
    setApplied((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const updateSearchProfile = (field: keyof SearchProfile, value: string) => {
    setSearchProfile((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setQuery("");
    setCategory("All");
    setLocation("All");
    setStatus("All");
    setMinFit(70);
  };

  const applyNewJobs = (incoming: QaJob[]) => {
    setJobs((prev) => {
      const next = mergeMode === "replace" ? [] : [...prev];
      const existing = new Set(next.map((job) => job.id));
      incoming.forEach((job) => {
        if (!existing.has(job.id)) {
          next.push(job);
          existing.add(job.id);
        }
      });
      return next;
    });
    setGlobalStatus(`${incoming.length} job records ${mergeMode === "replace" ? "loaded" : "merged"}`);
  };

  const loadJsonFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const rows = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { jobs?: unknown[] }).jobs) ? (parsed as { jobs: unknown[] }).jobs : [];
      const normalized = rows.map((row, index) => normalizeJob(row as Record<string, unknown>, index));
      applyNewJobs(normalized);
    } catch (error) {
      setGlobalStatus(error instanceof Error ? error.message : "Could not parse JSON file");
    } finally {
      event.target.value = "";
    }
  };

  const fetchSelectedPortals = async () => {
    const selected = [...selectedPortals];
    if (selected.length === 0) {
      setGlobalStatus("Select at least one source family");
      return;
    }

    const role = searchProfile.role.trim() || defaultSearchProfile.role;
    const skills = parseSkillInput(searchProfile.skills || defaultSearchProfile.skills);
    const preferredLocation = searchProfile.location.trim() || defaultSearchProfile.location;
    const experienceYears = Number(searchProfile.experienceYears) || 0;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    setGlobalStatus(`Searching ${role} roles for ${preferredLocation}`);
    selected.forEach((portal) => setPortalStatus((prev) => ({ ...prev, [portal]: "Fetching" })));

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${apiUrl}/api/jobs/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        signal: controller.signal,
        body: JSON.stringify({
          role,
          skills,
          location: preferredLocation,
          experience_years: experienceYears,
          min_match_score: minFit,
          source_portals: selected,
          run_verification: true,
        }),
      });
      window.clearTimeout(timeout);
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const rows = Array.isArray(data) ? data : Array.isArray(data.jobs) ? data.jobs : [];
      const normalized = rows.map((row: Record<string, unknown>, index: number) => normalizeJob(row, index));
      selected.forEach((portal) => setPortalStatus((prev) => ({ ...prev, [portal]: normalized.length ? "Merged" : "No jobs" })));
      if (normalized.length) applyNewJobs(normalized);
      setGlobalStatus(normalized.length ? `Merged ${normalized.length} live jobs` : "Discovery finished with no new jobs");
    } catch {
      selected.forEach((portal) => setPortalStatus((prev) => ({ ...prev, [portal]: "Unavailable" })));
      setGlobalStatus("Discovery endpoint unavailable");
    }
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">QA search command center</p>
            <h1 className="text-2xl font-bold text-white">QA Job Intelligence Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Centralized QA role tracking with fit scoring, resume-change drafts, bookmarks, applied status, JSON imports, and portal refresh controls.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary flex items-center gap-2 text-sm" onClick={() => setRefreshOpen((open) => !open)}>
              <RefreshCw className="w-4 h-4" /> Refresh Data
            </button>
            <label className="btn-primary flex items-center gap-2 text-sm cursor-pointer">
              <Upload className="w-4 h-4" /> Import JSON
              <input type="file" accept="application/json,.json" className="hidden" onChange={loadJsonFile} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Tracked Jobs", value: stats.total, icon: Briefcase, color: "text-indigo-400" },
            { label: "85+ Fit", value: stats.highFit, icon: Star, color: "text-emerald-400" },
            { label: "Bookmarked", value: stats.bookmarked, icon: Bookmark, color: "text-amber-300" },
            { label: "Applied", value: stats.applied, icon: CheckCircle2, color: "text-cyan-300" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1"><Icon className={`w-4 h-4 ${color}`} /> {label}</div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {refreshOpen && (
          <div className="card mb-6 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Globe2 className="w-4 h-4 text-indigo-300" /> Refresh Dashboard Data</h2>
                <p className="text-xs text-slate-500 mt-1">Merge a local JSON export or fetch selected portals through the backend discovery endpoint.</p>
              </div>
              <button className="p-2 text-slate-400 hover:text-white" onClick={() => setRefreshOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">Role title</span>
                <input className="input" value={searchProfile.role} onChange={(event) => updateSearchProfile("role", event.target.value)} placeholder="Senior QA Engineer" />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">Location</span>
                <input className="input" value={searchProfile.location} onChange={(event) => updateSearchProfile("location", event.target.value)} placeholder="Bengaluru, Hyderabad, Remote" />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">Experience</span>
                <input className="input" type="number" min={0} max={40} value={searchProfile.experienceYears} onChange={(event) => updateSearchProfile("experienceYears", event.target.value)} placeholder="7" />
              </label>
              <label className="space-y-1 md:col-span-2 xl:col-span-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">Skills</span>
                <input className="input" value={searchProfile.skills} onChange={(event) => updateSearchProfile("skills", event.target.value)} placeholder="Playwright, Selenium, API Testing" />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <select className="input w-40" value={mergeMode} onChange={(event) => setMergeMode(event.target.value as "merge" | "replace")}>
                <option value="merge">Merge records</option>
                <option value="replace">Replace records</option>
              </select>
              <button className="btn-primary flex items-center gap-2 text-sm" onClick={fetchSelectedPortals}>
                <RefreshCw className="w-4 h-4" /> Fetch Selected
              </button>
              <span className="text-xs text-slate-500">{globalStatus}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
              {portals.map((portal) => {
                const active = selectedPortals.has(portal);
                return (
                  <button
                    key={portal}
                    className={`rounded-xl border px-3 py-2 text-left transition-all ${active ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-200" : "border-slate-800 bg-slate-950/40 text-slate-400"}`}
                    onClick={() => setSelectedPortals((prev) => {
                      const next = new Set(prev);
                      if (next.has(portal)) next.delete(portal); else next.add(portal);
                      return next;
                    })}
                  >
                    <span className="block text-xs font-medium">{portal}</span>
                    <span className="text-[10px] text-slate-500">{portalStatus[portal] || "Idle"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="card mb-6 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, company, portal, keyword, or location" />
            </div>
            <select className="input w-40" value={category} onChange={(event) => setCategory(event.target.value as "All" | QaCategory)}>
              {(["All", "Healthcare", "Low-Code", "General"] as const).map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="input w-48" value={location} onChange={(event) => setLocation(event.target.value)}>
              {locations.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="input w-40" value={status} onChange={(event) => setStatus(event.target.value as "All" | QaStatus)}>
              {(["All", "new", "bookmarked", "applied"] as const).map((item) => <option key={item}>{item}</option>)}
            </select>
            <button className="btn-secondary flex items-center gap-2 text-sm" onClick={resetFilters}>
              <RotateCcw className="w-4 h-4" /> Reset Filters
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <Filter className="w-4 h-4 text-indigo-300" />
            <span>{filteredJobs.length} jobs match your filters</span>
            <SlidersHorizontal className="w-4 h-4 text-indigo-300 ml-2" />
            <span>Minimum fit</span>
            <input type="range" min={0} max={100} step={5} value={minFit} onChange={(event) => setMinFit(Number(event.target.value))} className="w-32 accent-indigo-500" />
            <span className="font-semibold text-indigo-300">{minFit}%</span>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="card text-center py-16 text-slate-400">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <h2 className="font-semibold text-white mb-1">No jobs match your filters</h2>
            <p className="text-sm">Reset filters or import a fresh JSON export.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filteredJobs.map((job) => {
              const isBookmarked = bookmarks.has(job.id);
              const isApplied = applied.has(job.id);
              return (
                <article key={job.id} className="card p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="badge border-indigo-500/30 text-indigo-300 bg-indigo-500/10">{job.category}</span>
                        <span className="badge border-slate-700 text-slate-400 bg-slate-900/70">{job.source}</span>
                        {isApplied && <span className="badge border-emerald-500/30 text-emerald-300 bg-emerald-500/10">Applied</span>}
                      </div>
                      <h2 className="text-lg font-semibold text-white truncate">{job.title}</h2>
                      <p className="text-sm text-slate-400">{job.company}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-2xl font-bold ${job.fitScore >= 85 ? "text-emerald-400" : job.fitScore >= 70 ? "text-indigo-300" : "text-amber-300"}`}>{job.fitScore}%</p>
                      <p className="text-[10px] text-slate-500">fit score</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed">{job.summary}</p>

                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
                    <span>{job.posted}</span>
                    <span>{job.salary}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {job.keywords.map((keyword) => <span key={keyword} className="tag text-[11px]">{keyword}</span>)}
                  </div>

                  {job.gaps.length > 0 && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Resume gaps: {job.gaps.join(", ")}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button className="btn-primary flex items-center gap-2 text-xs" onClick={() => openTweakModal(job)}>
                      <FileText className="w-4 h-4" /> Resume Changes
                    </button>
                    <button className="btn-secondary flex items-center gap-2 text-xs" onClick={() => toggleBookmark(job.id)}>
                      <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-current text-amber-300" : ""}`} /> {isBookmarked ? "Bookmarked" : "Bookmark"}
                    </button>
                    <button className="btn-secondary flex items-center gap-2 text-xs" onClick={() => toggleApplied(job.id)}>
                      <CheckCircle2 className={`w-4 h-4 ${isApplied ? "text-emerald-300" : ""}`} /> {isApplied ? "Applied" : "Mark Applied"}
                    </button>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2 text-xs">
                        <ExternalLink className="w-4 h-4" /> Open
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-600 text-center mt-6">{globalStatus}</p>
      </main>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 p-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-300" /> Resume Changes</h2>
                <p className="text-sm text-slate-400">{selectedJob.title} at {selectedJob.company}</p>
              </div>
              <button className="p-2 text-slate-400 hover:text-white" onClick={() => setSelectedJob(null)}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {getTweaksForJob(selectedJob).map((tweak) => (
                <section key={tweak.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{tweak.label}</h3>
                      <p className="text-xs text-slate-500 mt-1">Current: {tweak.current}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white" onClick={() => copyText(drafts[tweak.id] || tweak.suggested, `${tweak.label} copied`)} title="Copy">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white" onClick={() => setDrafts((prev) => ({ ...prev, [tweak.id]: tweak.suggested }))} title="Reset">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="input min-h-28 leading-relaxed"
                    value={drafts[tweak.id] || ""}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [tweak.id]: event.target.value }))}
                  />
                </section>
              ))}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button className="btn-secondary flex items-center gap-2 text-sm" onClick={copyAllEdits}><Copy className="w-4 h-4" /> Copy All Edits</button>
                <button className="btn-secondary flex items-center gap-2 text-sm" onClick={downloadEdits}><Download className="w-4 h-4" /> Download as TXT</button>
                <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => saveDraft(true)}><Save className="w-4 h-4" /> Save Draft</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

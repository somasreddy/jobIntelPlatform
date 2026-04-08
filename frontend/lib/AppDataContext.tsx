"use client";
/**
 * AppDataContext — single source of truth for all shared platform data.
 *
 * Every module reads from and writes through this context so that:
 *  - Saving a job instantly appears in the Pipeline / Campaign
 *  - Moving an application to "Applied" auto-logs the campaign action
 *  - Logging an outreach from any page updates the Campaign progress ring
 *  - All API calls use a consistent auth header
 *  - Interview stories saved in Simulator appear on the Interview page
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from "react";
import { Application, ApplicationStatus, Job } from "./types";
import { mockApplications, mockJobs } from "./mockData";
import { getSavedJobIds, toggleSavedJob } from "./profile";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type ActionType = "apply" | "evaluate" | "outreach" | "interview_prep" | "follow_up";

// ── Shared types ──────────────────────────────────────────────────────────────
export interface TodayProgress {
  applications_sent: number; applications_goal: number;
  evaluations_done: number;  evaluations_goal: number;
  outreaches_sent: number;   outreaches_goal: number;
}

export interface CampaignInfo {
  id: string; name: string;
  target_role: string | null; target_salary: string | null;
  target_location: string | null; work_mode: string;
  days_remaining: number | null;
  current_streak: number; longest_streak: number;
}

export interface PipelineSummary {
  total_applications: number; interviews: number; offers: number;
}

export interface InterviewStory {
  id: string; situation: string; task: string;
  action: string; result: string; reflection?: string;
  archetype: string; tags: string[];
}

// ── Context shape ─────────────────────────────────────────────────────────────
interface AppDataContextType {
  // ── Applications / Pipeline ─────────────────────────────────────────────
  applications: Application[];
  appsLoading: boolean;
  refreshApplications: () => void;
  /** Save a job → creates a "Saved" application & syncs to backend */
  saveJob: (job: Job) => Promise<void>;
  /** Remove a saved job */
  unsaveJob: (jobId: string) => Promise<void>;
  /** Drag-drop or status change — syncs to backend & auto-logs campaign action */
  moveApplication: (appId: string, status: ApplicationStatus) => Promise<void>;
  /** Create an "Applied" application directly from the job detail page */
  applyToJob: (job: Job) => Promise<void>;

  // ── Campaign ────────────────────────────────────────────────────────────
  campaign: CampaignInfo | null;
  todayProgress: TodayProgress | null;
  pipelineSummary: PipelineSummary | null;
  campaignLoading: boolean;
  refreshCampaign: () => void;
  /** Log any job-search action — updates campaign progress rings instantly */
  logAction: (type: ActionType) => Promise<void>;

  // ── Interview stories ───────────────────────────────────────────────────
  interviewStories: InterviewStory[];
  storiesLoading: boolean;
  refreshStories: () => void;

  // ── Auth helper ─────────────────────────────────────────────────────────
  /** Returns headers including Authorization if a token is stored */
  authHeaders: (extra?: Record<string, string>) => Record<string, string>;
}

// ── Context creation ──────────────────────────────────────────────────────────
const AppDataContext = createContext<AppDataContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AppDataProvider({ children }: { children: ReactNode }) {

  // ── Applications state ────────────────────────────────────────────────────
  const [applications, setApplications] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading]   = useState(true);

  // ── Campaign state ────────────────────────────────────────────────────────
  const [campaign,        setCampaign]        = useState<CampaignInfo | null>(null);
  const [todayProgress,   setTodayProgress]   = useState<TodayProgress | null>(null);
  const [pipelineSummary, setPipelineSummary] = useState<PipelineSummary | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const campaignIdRef = useRef<string | null>(null);

  // ── Interview stories state ───────────────────────────────────────────────
  const [interviewStories, setInterviewStories] = useState<InterviewStory[]>([]);
  const [storiesLoading,   setStoriesLoading]   = useState(true);

  // ── Auth headers helper ───────────────────────────────────────────────────
  const authHeaders = useCallback((extra: Record<string, string> = {}): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("ji_token") : null;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }, []);

  // ── Fetch: applications ───────────────────────────────────────────────────
  const fetchApplications = useCallback(async () => {
    setAppsLoading(true);
    try {
      const res = await fetch(`${API}/api/applications/`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setApplications(data);
          setAppsLoading(false);
          return;
        }
      }
    } catch { /* fall through to local fallback */ }

    // Fallback: merge mock data + localStorage saved jobs
    const savedIds = getSavedJobIds();
    const existingJobIds = new Set(mockApplications.map(a => a.jobId));
    const savedApps: Application[] = savedIds
      .filter(id => !existingJobIds.has(id))
      .map(id => {
        const job = mockJobs.find(j => j.id === id);
        if (!job) return null;
        return {
          id: `saved-${id}`, jobId: id, job,
          status: "Saved" as ApplicationStatus,
          dateApplied: new Date().toISOString().split("T")[0],
        };
      })
      .filter(Boolean) as Application[];
    setApplications([...mockApplications, ...savedApps]);
    setAppsLoading(false);
  }, [authHeaders]);

  // ── Fetch: campaign ───────────────────────────────────────────────────────
  const fetchCampaign = useCallback(async () => {
    setCampaignLoading(true);
    try {
      const res = await fetch(`${API}/api/campaign/active`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.campaign) {
          setCampaign(data.campaign);
          setTodayProgress(data.today_progress);
          setPipelineSummary(data.pipeline_summary);
          campaignIdRef.current = data.campaign.id;
        } else {
          setCampaign(null);
          setTodayProgress(null);
          setPipelineSummary(null);
          campaignIdRef.current = null;
        }
      }
    } catch { /* no campaign — that's fine */ }
    setCampaignLoading(false);
  }, [authHeaders]);

  // ── Fetch: interview stories ──────────────────────────────────────────────
  const fetchStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const res = await fetch(`${API}/api/interview/stories`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInterviewStories(Array.isArray(data) ? data : data.stories ?? []);
      }
    } catch { /* stories optional */ }
    setStoriesLoading(false);
  }, [authHeaders]);

  // Initial fetch
  useEffect(() => {
    fetchApplications();
    fetchCampaign();
    fetchStories();
  }, [fetchApplications, fetchCampaign, fetchStories]);

  // Re-fetch when user logs in (token appears in storage)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "ji_token" && e.newValue) {
        fetchApplications();
        fetchCampaign();
        fetchStories();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [fetchApplications, fetchCampaign, fetchStories]);

  // ── Internal: log action to active campaign ───────────────────────────────
  const _logActionRaw = useCallback(async (type: ActionType) => {
    const cid = campaignIdRef.current;
    if (!cid) return;
    try {
      await fetch(`${API}/api/campaign/${cid}/log-action`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action_type: type, count: 1 }),
      });
      // Optimistic update — don't wait for re-fetch
      setTodayProgress(prev => {
        if (!prev) return prev;
        const map: Partial<Record<ActionType, keyof TodayProgress>> = {
          apply:    "applications_sent",
          evaluate: "evaluations_done",
          outreach: "outreaches_sent",
        };
        const key = map[type];
        if (!key) return prev;
        return { ...prev, [key]: (prev[key] as number) + 1 };
      });
    } catch { /* best-effort */ }
  }, [authHeaders]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Save a job from the jobs list → creates "Saved" application everywhere */
  const saveJob = useCallback(async (job: Job) => {
    toggleSavedJob(job.id); // keep localStorage in sync for pages that still read it
    // Optimistic: add to local state immediately
    setApplications(prev => {
      if (prev.find(a => a.jobId === job.id)) return prev; // already exists
      return [{
        id: `saved-${job.id}`, jobId: job.id, job,
        status: "Saved" as ApplicationStatus,
        dateApplied: new Date().toISOString().split("T")[0],
      }, ...prev];
    });
    // Persist to backend
    try {
      await fetch(`${API}/api/applications/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ job_id: job.id, status: "Saved" }),
      });
    } catch { /* localStorage is enough fallback */ }
  }, [authHeaders]);

  /** Remove a saved job */
  const unsaveJob = useCallback(async (jobId: string) => {
    toggleSavedJob(jobId);
    setApplications(prev => prev.filter(a => !(a.jobId === jobId && a.status === "Saved")));
    // Best-effort delete from backend
    try {
      const app = applications.find(a => a.jobId === jobId);
      if (app) {
        await fetch(`${API}/api/applications/${app.id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
      }
    } catch {}
  }, [authHeaders, applications]);

  /** Move an application (Kanban drag-drop) — auto-logs campaign action */
  const moveApplication = useCallback(async (appId: string, status: ApplicationStatus) => {
    // Optimistic update
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
    // Backend sync
    try {
      await fetch(`${API}/api/applications/${appId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
    } catch {}
    // Campaign action logging
    if (status === "Applied")   await _logActionRaw("apply");
    if (status === "Interview") await fetchCampaign(); // big milestone — re-fetch for accurate pipeline
  }, [authHeaders, _logActionRaw, fetchCampaign]);

  /** Apply directly from the job detail page → creates Applied record + logs campaign */
  const applyToJob = useCallback(async (job: Job) => {
    // Check if already in pipeline
    const existing = applications.find(a => a.jobId === job.id);
    if (existing) {
      // Just promote the status if it was "Saved"
      if (existing.status === "Saved") {
        await moveApplication(existing.id, "Applied");
      }
      return;
    }
    // New application
    const tempId = `applied-${job.id}`;
    const newApp: Application = {
      id: tempId, jobId: job.id, job,
      status: "Applied",
      dateApplied: new Date().toISOString().split("T")[0],
    };
    setApplications(prev => [newApp, ...prev]);
    try {
      const res = await fetch(`${API}/api/applications/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ job_id: job.id, status: "Applied" }),
      });
      if (res.ok) {
        const created = await res.json();
        // Replace temp ID with real one
        setApplications(prev => prev.map(a => a.id === tempId ? { ...a, id: created.id ?? tempId } : a));
      }
    } catch {}
    // Campaign: log the apply action
    await _logActionRaw("apply");
  }, [applications, moveApplication, authHeaders, _logActionRaw]);

  /** Public logAction — use this from any page for outreach, evaluate, etc. */
  const logAction = _logActionRaw;

  return (
    <AppDataContext.Provider value={{
      applications, appsLoading,
      refreshApplications: fetchApplications,
      saveJob, unsaveJob, moveApplication, applyToJob,
      campaign, todayProgress, pipelineSummary, campaignLoading,
      refreshCampaign: fetchCampaign,
      logAction,
      interviewStories, storiesLoading,
      refreshStories: fetchStories,
      authHeaders,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

/** Use this in every page/component that needs shared platform data */
export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

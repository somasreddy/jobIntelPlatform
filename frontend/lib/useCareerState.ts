"use client";
/**
 * useCareerState — fetches the shared "career state" read model from
 * GET /api/career-state/ (backend: services/career_state.py + api/career_state.py).
 *
 * This is the single aggregated snapshot of a user's profile summary, skill
 * gaps, fit score, application pipeline, learning progress, and active goals
 * / milestones — assembled live by the backend from existing tables (it is
 * NOT a separate synced store, so there is nothing to keep in sync here).
 *
 * A plain fetch-based hook (not a Context) was chosen deliberately: this is
 * read-only, single-endpoint data with no cross-component mutation surface
 * to coordinate (contrast with AppDataContext, which fans out writes —
 * saveJob/moveApplication/logAction — to keep many consumers in lockstep).
 * Any page that needs the same data can just call this hook; if a future
 * need for shared/deduplicated fetching across many simultaneous consumers
 * emerges, this can be wrapped in a Context without changing its shape.
 *
 * Follows this codebase's existing authenticated-fetch convention (see
 * lib/ProfileContext.tsx / lib/AppDataContext.tsx / lib/AuthContext.tsx):
 *   - Base URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
 *   - Auth: Bearer token from localStorage["ji_token"]
 *   - Re-fetch automatically when a token appears (cross-tab login)
 *
 * Usage:
 *   const { data, loading, error, refetch } = useCareerState();
 */
import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Response types (mirror the backend's snake_case field names exactly —
// see services/career_state.py get_career_state() for the source of truth) ──

export interface CareerStateProfileSummary {
  has_profile: boolean;
  name: string | null;
  current_role: string | null;
  /** From the user's active CareerGoal, if any. */
  target_role: string | null;
  experience_years: number | null;
  current_location: string | null;
  preferred_locations: string[];
  work_mode: string | null;
}

export interface CareerStateSkillGapItem {
  skill: string;
  /** Raw count of VERIFIED job postings mentioning this technology. */
  demand_count: number;
  /** Only present for skills the user already has tracked in CareerGraph. */
  level?: number | null;
}

export interface CareerStateSkillGaps {
  available: boolean;
  /** Documents which gap-detection method produced this section. */
  method: "presence_comparison_vs_verified_jobs";
  target_role: string | null;
  /** True if demand was scoped to jobs matching the target role's title tokens. */
  scoped_to_target_role?: boolean;
  missing_skills: CareerStateSkillGapItem[];
  present_skills: CareerStateSkillGapItem[];
  jobs_analyzed: number;
  /** Present when available is false (e.g. no market data yet). */
  message?: string;
}

export interface CareerStateFitScoreBestMatch {
  application_id: string;
  job_id: string;
  job_title: string;
  organization: string;
  fit_score: number;
  badge: string;
}

export interface CareerStateFitScore {
  available: boolean;
  /** Documents which formula produced this (always services/fit_score.py). */
  method: string;
  /** Average of compute_fit_score() across sampled applications, 0-100. */
  current_fit_score: number | null;
  badge: string | null;
  sample_size: number;
  sampled_statuses: "active_pipeline" | "all_applications" | null;
  best_match: CareerStateFitScoreBestMatch | null;
  /** Present when available is false (e.g. no linked applications yet). */
  message?: string;
}

export interface CareerStatePipeline {
  total: number;
  /** Keyed by every status in api/applications.py's VALID_STATUSES (zero-filled). */
  by_status: Record<string, number>;
  /** Applications in Applied | Assessment | Responded | Interview | Offer. */
  active_count: number;
}

export interface CareerStateRecentCompletion {
  skill_name: string;
  path_id: string | null;
  completed_at: string | null;
  rating_given: number | null;
}

export interface CareerStateLearning {
  total_paths: number;
  active_paths: number;
  active_path_resources_total: number;
  active_path_completions: number;
  /** active_path_completions / active_path_resources_total * 100, or null if no resources. */
  completion_pct: number | null;
  recent_completions: CareerStateRecentCompletion[];
  /** Deduplicated skill_name values from the most recent completions. */
  skills_targeted_recently: string[];
}

export interface CareerStateGoal {
  id: string;
  target_role: string | null;
  target_company: string | null;
  target_salary_min: number | null;
  target_salary_max: number | null;
  target_location: string | null;
  timeline_months: number | null;
  work_mode: string | null;
}

export interface CareerStateMilestone {
  id: string;
  type: string;
  title: string;
  company: string | null;
  milestone_date: string | null;
  impact_statement: string | null;
  created_at: string | null;
}

export interface CareerStateGoalsAndMilestones {
  active_goal: CareerStateGoal | null;
  /** Most recent milestones, newest first (max 5). */
  recent_milestones: CareerStateMilestone[];
}

export interface CareerState {
  /** ISO 8601 UTC timestamp — when this snapshot was computed (it is live, not cached). */
  generated_at: string;
  user_id: string;
  profile: CareerStateProfileSummary;
  skill_gaps: CareerStateSkillGaps;
  fit_score: CareerStateFitScore;
  pipeline: CareerStatePipeline;
  learning: CareerStateLearning;
  career_goals: CareerStateGoalsAndMilestones;
}

// ─── Auth helper (matches ProfileContext.tsx / AppDataContext.tsx exactly) ──

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("ji_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseCareerStateResult {
  data: CareerState | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch on demand (e.g. after an action that changes profile/pipeline/learning data). */
  refetch: () => Promise<void>;
}

export function useCareerState(): UseCareerStateResult {
  const [data, setData] = useState<CareerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCareerState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/career-state/`, {
        cache: "no-store",
        headers: authHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Career state request failed: ${res.status}`);
      }
      const json = (await res.json()) as CareerState;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load career state");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchCareerState();
  }, [fetchCareerState]);

  // Re-fetch when the user logs in elsewhere (same cross-tab convention as
  // ProfileContext/AppDataContext — a token appearing in storage means a
  // fresh identity to fetch career state for).
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "ji_token" && e.newValue) {
        fetchCareerState();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [fetchCareerState]);

  return { data, loading, error, refetch: fetchCareerState };
}

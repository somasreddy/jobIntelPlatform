/**
 * Shared types for the Career Graph route — mirrors the real backend shape
 * returned by GET /api/career-graph/ (backend/api/career_graph.py) which in
 * turn serialises the CareerGraph / CareerSkill / CareerGoal / CareerMilestone
 * SQLAlchemy models (backend/models/database.py). Kept in one place so the
 * page, the client view, and the graph visualization all agree on the shape.
 */

export interface HealthBreakdown {
  score: number;
  label: string;
  weight: number;
}

export interface CareerGraph {
  graph_id: string;
  health_score: number;
  health_breakdown: Record<string, HealthBreakdown>;
  onboarding_complete: boolean;
  last_computed: string | null;
  skills: CareerSkill[];
  goals: CareerGoal[];
  milestones: CareerMilestone[];
}

export interface CareerSkill {
  id: string;
  skill_name: string;
  category: string | null;
  level: number;
  verified: boolean;
  last_used_year: number | null;
  trending_score: number;
}

export interface CareerGoal {
  id: string;
  target_role: string | null;
  target_salary_min: number | null;
  target_salary_max: number | null;
  target_location: string | null;
  timeline_months: number | null;
  work_mode: string | null;
  is_active: boolean;
}

export interface CareerMilestone {
  id: string;
  type: string;
  title: string;
  company: string | null;
  milestone_date: string | null;
  impact_statement: string | null;
}

export interface Insight {
  dimension: string;
  current_score: number;
  label: string;
  potential_gain: number;
  action: string;
}

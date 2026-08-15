/**
 * Shape returned by GET /api/portfolio/public/{slug} (see
 * backend/api/portfolio.py::_portfolio_to_dict / _project_to_dict).
 *
 * Note: the backend's `_portfolio_to_dict` already resolves `bio` to
 * `ai_bio or bio` server-side and does not currently send `avatar_url` or
 * `ai_bio` as separate fields, and `_project_to_dict` does not send
 * `image_url`. Those fields are kept here (optional) to match what the API
 * schema could return without fabricating data that isn't actually served
 * today — the UI treats them as optional/absent rather than assuming
 * they're populated.
 */
export interface PublicPortfolio {
  slug: string;
  headline: string;
  bio: string;
  ai_bio?: string;
  avatar_url?: string;
  linkedin_url?: string;
  github_url?: string;
  website_url?: string;
  theme?: string;
  skills: string[];
  certifications: string[];
  view_count: number;
  projects: Array<{
    id: string;
    title: string;
    description: string;
    ai_impact?: string;
    tech_stack: string[];
    demo_url?: string;
    github_url?: string;
    image_url?: string;
    featured: boolean;
  }>;
}

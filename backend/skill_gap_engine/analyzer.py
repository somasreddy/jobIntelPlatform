"""
Skill gap analyzer — compares profile skills against aggregated demand
from the verified_jobs table, and produces a prioritized gap list + LLM-powered roadmap.
"""
import json
import logging
from collections import Counter

logger = logging.getLogger(__name__)

# Curated learning resources per technology
_RESOURCES: dict[str, str] = {
    "Playwright": "playwright.dev",
    "TypeScript": "typescriptlang.org",
    "K6": "k6.io/docs",
    "Kubernetes": "kubernetes.io/docs",
    "Cypress": "cypress.io",
    "Robot Framework": "robotframework.org",
    "AWS": "aws.amazon.com/training",
    "Appium": "appium.io",
    "REST Assured": "rest-assured.io",
    "Grafana": "grafana.com/docs",
    "Terraform": "developer.hashicorp.com/terraform",
    "Docker": "docs.docker.com",
    "Python": "python.org/doc",
    "Go": "go.dev/doc",
    "Kotlin": "kotlinlang.org/docs",
    "JMeter": "jmeter.apache.org",
    "Gatling": "gatling.io/docs",
    "GitHub Actions": "docs.github.com/en/actions",
    "Jenkins": "jenkins.io/doc",
    "Azure DevOps": "learn.microsoft.com/azure/devops",
}

_CATEGORIES: dict[str, str] = {
    "Playwright": "UI Automation", "Cypress": "UI Automation", "Appium": "Mobile Automation",
    "Selenium": "UI Automation", "WebdriverIO": "UI Automation", "Robot Framework": "Automation",
    "TypeScript": "Language", "Python": "Language", "Java": "Language",
    "Go": "Language", "Kotlin": "Language",
    "K6": "Performance", "JMeter": "Performance", "Gatling": "Performance",
    "Kubernetes": "DevOps", "Docker": "DevOps", "Terraform": "DevOps",
    "AWS": "Cloud", "Azure": "Cloud", "GCP": "Cloud",
    "REST Assured": "API Testing", "Postman": "API Testing",
    "GitHub Actions": "CI/CD", "Jenkins": "CI/CD", "Azure DevOps": "CI/CD",
    "Grafana": "Monitoring",
}

_SYSTEM_PROMPT = """You are a Senior Engineering Career Coach specializing in QA/SDET career growth.
Given a candidate's current skills, target role, and their identified skill gaps (missing high-demand skills),
generate a personalized learning roadmap and strategic career insights.

Return ONLY a JSON object with this structure:
{
  "summary": "2-3 sentence strategic overview of the candidate's skill gap situation",
  "roadmap": [
    {
      "phase": 1,
      "title": "Phase title",
      "duration": "X-Y weeks",
      "skills": ["skill1", "skill2"],
      "resources": ["resource_url1"],
      "why": "Why this phase matters for their target role"
    }
  ],
  "quick_wins": ["skill or action that can be added/demonstrated quickly"],
  "market_insight": "1-2 sentences on current market demand for their target role"
}

Keep roadmap to 3 phases max. Focus on the specific gaps provided, not generic advice."""


async def _generate_llm_insights(
    profile_skills: list,
    target_role: str,
    missing_skills: list,
    strengths: list,
) -> dict | None:
    """Use LLM to generate personalized roadmap and insights."""
    try:
        from core.llm import smart_chat
        top_missing = [g["skill"] for g in missing_skills[:8]]
        top_strengths = [g["skill"] for g in strengths[:6]]
        user_prompt = (
            f"Candidate Profile:\n"
            f"- Target Role: {target_role}\n"
            f"- Current Skills: {', '.join(profile_skills[:15])}\n"
            f"- Strengths (already has): {', '.join(top_strengths)}\n"
            f"- Missing High-Demand Skills: {', '.join(top_missing)}\n\n"
            "Generate a personalized learning roadmap and career insights."
        )
        raw = await smart_chat(_SYSTEM_PROMPT, user_prompt, temperature=0.5, task_type="skill_gap", cache_ttl=1800)
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(clean)
    except Exception as e:
        logger.warning(f"LLM skill gap insights failed: {e}")
        return None


class SkillGapAnalyzer:
    def __init__(self):
        pass

    async def analyze(
        self,
        profile_skills: list,
        target_role: str,
        db_session=None,
    ) -> dict:
        """
        Aggregates technology demand from verified_jobs DB (if available),
        falls back to curated data. Uses LLM to generate personalized roadmap + insights.
        """
        tech_counts: Counter = Counter()

        if db_session is not None:
            try:
                from sqlalchemy import select
                from models.database import VerifiedJob
                result = await db_session.execute(
                    select(VerifiedJob.technologies).where(
                        VerifiedJob.verification_status == "VERIFIED"
                    )
                )
                rows = result.scalars().all()
                for tech_list in rows:
                    if tech_list:
                        for t in tech_list:
                            tech_counts[t] += 1
            except Exception as e:
                logger.warning(f"DB skill aggregation failed: {e}")

        # Fallback curated demand data
        if not tech_counts:
            tech_counts = Counter({
                "Playwright": 94, "TypeScript": 89, "K6": 75,
                "Kubernetes": 82, "Cypress": 78, "Robot Framework": 65,
                "AWS": 88, "Appium": 70, "GitHub Actions": 85,
                "REST Assured": 80, "Docker": 90, "Python": 88,
                "Selenium": 72, "JMeter": 68, "Jenkins": 75,
            })

        total = max(sum(tech_counts.values()), 1)
        profile_lower = {s.lower() for s in profile_skills}

        gaps = []
        for tech, count in tech_counts.most_common(20):
            in_profile = tech.lower() in profile_lower
            demand_score = min(99, int((count / total) * 100 * 6))
            priority = "High" if demand_score >= 75 else ("Medium" if demand_score >= 50 else "Low")
            gaps.append({
                "skill": tech,
                "category": _CATEGORIES.get(tech, "General"),
                "demandScore": demand_score,
                "inProfile": in_profile,
                "priority": priority,
                "learningResource": _RESOURCES.get(tech),
            })

        missing = [g for g in gaps if not g["inProfile"]]
        have = [g for g in gaps if g["inProfile"]]

        # Generate LLM-powered personalized roadmap and insights
        llm_insights = await _generate_llm_insights(profile_skills, target_role, missing, have)

        result = {
            "missing_high_demand_skills": missing[:10],
            "strengths": have,
            "total_jobs_analyzed": sum(tech_counts.values()),
        }

        if llm_insights:
            result["summary"] = llm_insights.get("summary", "")
            result["roadmap"] = llm_insights.get("roadmap", [])
            result["quick_wins"] = llm_insights.get("quick_wins", [])
            result["market_insight"] = llm_insights.get("market_insight", "")
        else:
            # Static fallback roadmap if LLM fails
            result["roadmap"] = [
                {
                    "phase": 1,
                    "title": "Modern UI & API Automation",
                    "duration": "4–6 weeks",
                    "skills": ["Playwright", "TypeScript", "Cypress"],
                    "resources": ["playwright.dev", "typescriptlang.org", "cypress.io"],
                    "why": "Highest demand skills in current job market for QA roles.",
                },
                {
                    "phase": 2,
                    "title": "Performance & Contract Testing",
                    "duration": "4–6 weeks",
                    "skills": ["K6", "REST Assured", "Postman Collections"],
                    "resources": ["k6.io", "rest-assured.io"],
                    "why": "Differentiates senior QA engineers from mid-level candidates.",
                },
                {
                    "phase": 3,
                    "title": "DevOps & Cloud Integration",
                    "duration": "6–8 weeks",
                    "skills": ["Kubernetes", "AWS", "Terraform", "Grafana"],
                    "resources": ["kubernetes.io", "aws.amazon.com/training", "grafana.com"],
                    "why": "Required for principal/staff SDET roles and higher compensation bands.",
                },
            ]

        return result

"""
Skill gap analyzer — compares profile skills against aggregated demand
from the verified_jobs table, and produces a prioritized gap list + roadmap.
"""
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

_ROADMAP_PHASES = [
    {
        "phase": 1,
        "title": "Modern UI & API Automation",
        "duration": "4–6 weeks",
        "skills": ["Playwright", "TypeScript", "Cypress"],
        "resources": ["playwright.dev", "typescriptlang.org", "cypress.io"],
    },
    {
        "phase": 2,
        "title": "Performance & Contract Testing",
        "duration": "4–6 weeks",
        "skills": ["K6", "REST Assured", "Postman Collections"],
        "resources": ["k6.io", "rest-assured.io"],
    },
    {
        "phase": 3,
        "title": "DevOps & Cloud Integration",
        "duration": "6–8 weeks",
        "skills": ["Kubernetes", "AWS", "Terraform", "Grafana"],
        "resources": ["kubernetes.io", "aws.amazon.com/training", "grafana.com"],
    },
]


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
        falls back to curated data. Returns gap list + roadmap.
        """
        tech_counts: Counter = Counter()

        if db_session is not None:
            try:
                from sqlalchemy import select, text
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
            demand_score = min(99, int((count / total) * 100 * 6))  # normalize to 0-99
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

        return {
            "missing_high_demand_skills": missing[:10],
            "strengths": have,
            "roadmap": _ROADMAP_PHASES,
            "total_jobs_analyzed": sum(tech_counts.values()),
        }

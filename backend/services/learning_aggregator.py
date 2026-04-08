"""
Learning Content Aggregator
Fetches real learning resources from multiple sources:
  - YouTube Data API v3 (YOUTUBE_API_KEY env var)
  - Coursera public catalog API (no auth required for search)
  - freeCodeCamp curriculum (curated static map)
  - roadmap.sh (curated skill paths)

Used by learning.py to augment AI-generated paths with real, verifiable resources.
"""
import logging
import os
from typing import Optional
import httpx

logger = logging.getLogger(__name__)
_TIMEOUT = 10.0


# ── YouTube Data API ──────────────────────────────────────────────────────────

async def fetch_youtube_resources(skill: str, max_results: int = 5) -> list[dict]:
    """
    Fetch tutorial playlists/videos from YouTube for a given skill.
    Requires YOUTUBE_API_KEY env var.
    """
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    if not api_key:
        return []

    results = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            # Search for playlists first (more structured learning)
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "q": f"{skill} tutorial course 2024",
                    "type": "playlist",
                    "maxResults": max_results,
                    "relevanceLanguage": "en",
                    "safeSearch": "strict",
                    "key": api_key,
                },
            )
            if resp.ok:
                data = resp.json()
                for item in data.get("items", []):
                    snippet = item.get("snippet", {})
                    pid = item.get("id", {}).get("playlistId", "")
                    if not pid:
                        continue
                    results.append({
                        "title": snippet.get("title", ""),
                        "provider": "YouTube",
                        "url": f"https://www.youtube.com/playlist?list={pid}",
                        "type": "video",
                        "duration_minutes": None,
                        "difficulty": "Beginner",
                        "is_free": True,
                        "description": snippet.get("description", "")[:200],
                        "thumbnail": snippet.get("thumbnails", {}).get("default", {}).get("url"),
                        "source": "youtube_api",
                    })
    except Exception as exc:
        logger.warning(f"YouTube API failed for '{skill}': {exc}")

    return results[:max_results]


# ── Coursera public catalog ────────────────────────────────────────────────────

async def fetch_coursera_resources(skill: str, max_results: int = 5) -> list[dict]:
    """
    Search Coursera's public catalog. No API key required.
    Uses their informal search endpoint.
    """
    results = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                "https://api.coursera.org/api/courses.v1",
                params={
                    "q": "search",
                    "query": skill,
                    "fields": "name,slug,description,photoUrl,workload,primaryLanguages,partnerIds",
                    "limit": max_results,
                    "includes": "partnerIds",
                },
                headers={"User-Agent": "JobIntelBot/1.0"},
            )
            if resp.ok:
                data = resp.json()
                for course in data.get("elements", []):
                    slug = course.get("slug", "")
                    name = course.get("name", "")
                    if not name:
                        continue
                    desc = course.get("description", "")
                    workload = course.get("workload", "")
                    # Estimate duration from workload string e.g. "4-8 hours/week"
                    duration = None
                    if workload:
                        nums = [int(n) for n in __import__("re").findall(r"\d+", workload)]
                        if nums:
                            duration = nums[0] * 4 * 60  # assume 4 weeks
                    results.append({
                        "title": name,
                        "provider": "Coursera",
                        "url": f"https://www.coursera.org/learn/{slug}",
                        "type": "course",
                        "duration_minutes": duration,
                        "difficulty": "Intermediate",
                        "is_free": False,  # Coursera is paid (audit may be free)
                        "description": (desc[:200] + "…") if len(desc) > 200 else desc,
                        "source": "coursera_api",
                    })
    except Exception as exc:
        logger.warning(f"Coursera API failed for '{skill}': {exc}")

    return results[:max_results]


# ── freeCodeCamp curated map ──────────────────────────────────────────────────

_FCC_MAP: dict[str, list[dict]] = {
    "javascript": [
        {"title": "JavaScript Algorithms and Data Structures", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/",
         "type": "course", "duration_minutes": 300, "difficulty": "Beginner", "is_free": True,
         "description": "300 hours of JS content covering ES6, regex, debugging, data structures, algorithms, OOP, and functional programming."},
    ],
    "python": [
        {"title": "Scientific Computing with Python", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/learn/scientific-computing-with-python/",
         "type": "course", "duration_minutes": 360, "difficulty": "Beginner", "is_free": True,
         "description": "Learn Python fundamentals through video lectures and interactive projects."},
    ],
    "react": [
        {"title": "Front End Development Libraries", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/learn/front-end-development-libraries/",
         "type": "course", "duration_minutes": 300, "difficulty": "Intermediate", "is_free": True,
         "description": "Bootstrap, jQuery, Sass, React, and Redux — build 5 projects."},
    ],
    "data structures": [
        {"title": "Data Structures and Algorithms", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/news/learn-data-structures-and-algorithms/",
         "type": "article", "duration_minutes": 120, "difficulty": "Intermediate", "is_free": True,
         "description": "Comprehensive DSA crash course with code examples."},
    ],
    "sql": [
        {"title": "Relational Database Certification", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/learn/relational-database/",
         "type": "course", "duration_minutes": 300, "difficulty": "Beginner", "is_free": True,
         "description": "Learn SQL, PostgreSQL, and Bash scripting through interactive labs."},
    ],
    "typescript": [
        {"title": "TypeScript Tutorial", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/news/learn-typescript-beginners-guide/",
         "type": "article", "duration_minutes": 90, "difficulty": "Beginner", "is_free": True,
         "description": "Full TypeScript guide for JavaScript developers."},
    ],
    "aws": [
        {"title": "AWS Certified Cloud Practitioner Prep", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/news/aws-certified-cloud-practitioner-study-guide/",
         "type": "video", "duration_minutes": 180, "difficulty": "Beginner", "is_free": True,
         "description": "Full course covering AWS fundamentals for the CCP exam."},
    ],
    "machine learning": [
        {"title": "Machine Learning with Python", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/learn/machine-learning-with-python/",
         "type": "course", "duration_minutes": 300, "difficulty": "Intermediate", "is_free": True,
         "description": "TensorFlow, neural networks, NLP, and reinforcement learning."},
    ],
    "kubernetes": [
        {"title": "Kubernetes Course for Beginners", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/news/learn-kubernetes-in-under-3-hours/",
         "type": "video", "duration_minutes": 180, "difficulty": "Intermediate", "is_free": True,
         "description": "Build and deploy containerized apps with Kubernetes."},
    ],
    "docker": [
        {"title": "Docker Tutorial for Beginners", "provider": "freeCodeCamp",
         "url": "https://www.freecodecamp.org/news/docker-tutorial-for-beginners/",
         "type": "article", "duration_minutes": 60, "difficulty": "Beginner", "is_free": True,
         "description": "Containerization fundamentals with Docker."},
    ],
}

def fetch_freecodecamp_resources(skill: str) -> list[dict]:
    """Return freeCodeCamp resources for a skill (case-insensitive partial match)."""
    skill_lower = skill.lower()
    for key, resources in _FCC_MAP.items():
        if key in skill_lower or skill_lower in key:
            return [dict(r, source="freecodecamp") for r in resources]
    return []


# ── roadmap.sh curated paths ──────────────────────────────────────────────────

_ROADMAP_MAP: dict[str, str] = {
    "frontend": "https://roadmap.sh/frontend",
    "backend": "https://roadmap.sh/backend",
    "devops": "https://roadmap.sh/devops",
    "react": "https://roadmap.sh/react",
    "vue": "https://roadmap.sh/vue",
    "angular": "https://roadmap.sh/angular",
    "node": "https://roadmap.sh/nodejs",
    "python": "https://roadmap.sh/python",
    "java": "https://roadmap.sh/java",
    "go": "https://roadmap.sh/golang",
    "rust": "https://roadmap.sh/rust",
    "kubernetes": "https://roadmap.sh/kubernetes",
    "docker": "https://roadmap.sh/docker",
    "aws": "https://roadmap.sh/aws",
    "postgresql": "https://roadmap.sh/postgresql-dba",
    "mongodb": "https://roadmap.sh/mongodb",
    "sql": "https://roadmap.sh/sql",
    "typescript": "https://roadmap.sh/typescript",
    "javascript": "https://roadmap.sh/javascript",
    "android": "https://roadmap.sh/android",
    "ios": "https://roadmap.sh/ios",
    "machine learning": "https://roadmap.sh/ai-data-scientist",
    "data science": "https://roadmap.sh/ai-data-scientist",
    "software architect": "https://roadmap.sh/software-architect",
    "system design": "https://roadmap.sh/system-design",
    "api design": "https://roadmap.sh/api-design",
    "graphql": "https://roadmap.sh/graphql",
    "terraform": "https://roadmap.sh/terraform",
    "git": "https://roadmap.sh/git-github",
    "linux": "https://roadmap.sh/linux",
    "computer science": "https://roadmap.sh/computer-science",
}

def fetch_roadmap_resource(skill: str) -> Optional[dict]:
    """Return a roadmap.sh link for the skill if one exists."""
    skill_lower = skill.lower()
    for key, url in _ROADMAP_MAP.items():
        if key in skill_lower or skill_lower in key:
            return {
                "title": f"Complete {skill.title()} Roadmap",
                "provider": "roadmap.sh",
                "url": url,
                "type": "roadmap",
                "duration_minutes": None,
                "difficulty": "All levels",
                "is_free": True,
                "description": f"Community-curated visual learning roadmap for {skill}.",
                "source": "roadmap_sh",
            }
    return None


# ── Main aggregator ────────────────────────────────────────────────────────────

async def aggregate_resources(skill: str, max_total: int = 8) -> list[dict]:
    """
    Fetch and merge resources from all available sources.
    Returns up to `max_total` deduplicated results.
    """
    import asyncio

    results: list[dict] = []

    # Roadmap (instant)
    roadmap = fetch_roadmap_resource(skill)
    if roadmap:
        results.append(roadmap)

    # freeCodeCamp (instant)
    fcc = fetch_freecodecamp_resources(skill)
    results.extend(fcc)

    # Async network sources in parallel
    yt_task = fetch_youtube_resources(skill, max_results=3)
    coursera_task = fetch_coursera_resources(skill, max_results=3)
    yt_results, coursera_results = await asyncio.gather(yt_task, coursera_task)

    results.extend(yt_results)
    results.extend(coursera_results)

    # Deduplicate by URL
    seen_urls: set[str] = set()
    unique: list[dict] = []
    for r in results:
        url = r.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique.append(r)

    return unique[:max_total]

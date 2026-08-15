"""
ATS Keyword-Match Service
=========================
Real, deterministic keyword-overlap scoring between a candidate's resume text
and a specific job's description/requirements — no LLM call involved.

This is intentionally a *different* computation from two other things already
in this codebase that look similar at a glance:

- ``services/fit_score.py``'s ``skills_match`` dimension compares the user's
  structured *profile skill tags* (e.g. ``profile.skills``) against the JD —
  it never looks at the candidate's actual resume text.
- ``ats_resume_generator/generator.py``'s ``_analyze_gaps`` asks an LLM to
  *guess* matched/missing skills — that's an AI opinion, not a computation.

This module instead compares the candidate's real resume *text* against the
job's keyword set using plain, case-insensitive substring/word-boundary
matching. Every number this module returns is reproducible by hand: count
the words in ``matched_keywords``, count the words in ``missing_keywords``,
divide. Nothing here calls an LLM, a cache, or the network.

Methodology
-----------
1. Build a keyword list for the job:
   - every entry in ``job_technologies`` / ``job_requirements`` (already
     curated skill/tech tags on the job record) — these always win, and
   - the most frequent significant words extracted from the free-text JD
     description (stopwords and short/numeric tokens removed), so a JD
     that mentions something not present in the tag lists still counts.
2. For each keyword, check whether it appears in the resume text
   (case-insensitive; whole-word for single tokens; plain substring for
   multi-word/punctuated keywords like "Node.js" or "CI/CD", since a
   word-boundary regex doesn't reason sensibly about those characters).
3. ``match_pct = matched / total keywords``.
"""
from __future__ import annotations

import re
from collections import Counter

__all__ = ["compute_ats_match", "extract_job_keywords"]

# Generic stopwords plus common job-posting filler that would otherwise
# dominate the frequency count without signalling any real skill/requirement.
_STOPWORDS: set[str] = {
    "the", "a", "an", "and", "or", "but", "if", "then", "so", "of", "to", "in",
    "on", "for", "with", "at", "by", "from", "as", "is", "are", "was", "were",
    "be", "been", "being", "this", "that", "these", "those", "it", "its",
    "you", "your", "we", "our", "they", "their", "will", "would", "can",
    "could", "should", "may", "might", "must", "have", "has", "had", "do",
    "does", "did", "not", "no", "yes", "about", "into", "over", "under",
    "between", "per", "via", "including", "etc", "all", "any", "each",
    "other", "such", "than", "also", "more", "most", "only", "some", "job",
    "role", "work", "working", "team", "teams", "company", "years", "year",
    "experience", "experienced", "required", "requirements", "requirement",
    "responsibilities", "responsible", "ability", "skills", "skill",
    "strong", "excellent", "good", "candidate", "candidates", "position",
    "opportunity", "looking", "seeking", "join", "help", "across", "using",
    "use", "used", "within", "plus", "new", "one", "who", "what", "when",
    "where", "how", "which", "while", "you'll", "we're", "you're", "need",
    "needs", "needed", "great", "many", "much", "very", "well", "make",
    "making", "get", "getting", "like", "just",
}

# Tokenizer mirrors the spirit of services/fit_score.py's `_tokenize` so a
# skill like "Node.js" or "C#" survives as one token instead of being split
# on internal punctuation. Requires a leading letter and at least one more
# character (drops bare single letters, which are almost always noise when
# harvested from free-text JD prose).
_TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9#+.\-]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text or "")


def _contains_keyword(haystack_lower: str, keyword: str) -> bool:
    """Case-insensitive containment check for a single keyword.

    Single alphanumeric tokens get a word-boundary regex (so "go" doesn't
    match inside "going" or "algorithm"); anything containing punctuation or
    spaces (e.g. "Node.js", "CI/CD", "Machine Learning") falls back to plain
    substring containment, since `\\b` doesn't reason sensibly about those
    characters.
    """
    kw = (keyword or "").strip()
    if not kw:
        return False
    if re.fullmatch(r"[a-zA-Z0-9]+", kw):
        return re.search(rf"\b{re.escape(kw.lower())}\b", haystack_lower) is not None
    return kw.lower() in haystack_lower


def extract_job_keywords(
    job_description: str,
    job_technologies: list[str] | None = None,
    job_requirements: list[str] | None = None,
    max_extra_keywords: int = 25,
) -> list[str]:
    """Build the keyword set an ATS-style scan would check the resume against.

    Curated tags (``job_technologies`` / ``job_requirements``) are already-
    known skill/tech names from the job record, so they always win and are
    listed first. On top of those, pull the most frequent significant words
    straight out of the JD body text so a JD mentioning something outside
    the tag lists still counts.
    """
    curated = [
        t.strip() for t in (list(job_technologies or []) + list(job_requirements or []))
        if t and str(t).strip()
    ]
    seen_lower = {c.lower() for c in curated}

    tokens = [t.lower() for t in _tokenize(job_description)]
    freq = Counter(
        t for t in tokens
        if len(t) >= 3 and t not in _STOPWORDS and not t.isdigit() and t not in seen_lower
    )
    extra = [word for word, _count in freq.most_common(max_extra_keywords)]

    # Dedup while preserving order: curated keywords first, then extracted.
    ordered: list[str] = []
    seen: set[str] = set()
    for kw in curated + extra:
        key = kw.lower()
        if key not in seen:
            seen.add(key)
            ordered.append(kw)
    return ordered


_METHODOLOGY_NOTE = (
    "Set-overlap of keywords pulled from this job's technologies/requirements "
    "tags plus the most frequent significant words in its description, "
    "checked for exact (case-insensitive) presence in your resume text. "
    "No AI involved — every match/miss below is verifiable by reading the "
    "two lists."
)


def compute_ats_match(
    resume_text: str,
    job_description: str = "",
    job_technologies: list[str] | None = None,
    job_requirements: list[str] | None = None,
    max_keywords: int = 40,
) -> dict:
    """Real (non-LLM) keyword-overlap ATS match score.

    Returns:
        {
          "match_pct": int 0-100,
          "matched_keywords": [...],  # keywords found verbatim in resume_text
          "missing_keywords": [...], # keywords not found
          "total_keywords": int,
          "source": "computed",      # deterministic figure, not an AI guess
          "methodology": "<human-readable description of the method above>",
        }
    """
    keywords = extract_job_keywords(job_description, job_technologies, job_requirements)[:max_keywords]
    resume_lower = (resume_text or "").lower()

    matched: list[str] = []
    missing: list[str] = []
    for kw in keywords:
        if resume_lower and _contains_keyword(resume_lower, kw):
            matched.append(kw)
        else:
            missing.append(kw)

    total = len(keywords)
    match_pct = round((len(matched) / total) * 100) if total else 0

    return {
        "match_pct": match_pct,
        "matched_keywords": matched,
        "missing_keywords": missing,
        "total_keywords": total,
        "source": "computed",
        "methodology": _METHODOLOGY_NOTE,
    }

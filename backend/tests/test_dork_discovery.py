"""
Tests for the dork-query-building logic in job_discovery/dork_discovery.py
and the country-routing logic in job_discovery/source_registry.py.

NOTE: backend/test_dork_source_registry.py (repo root) already covers
India/Ireland/remote query building and direct-board URL scoping - this
file deliberately does NOT repeat those cases. It adds coverage for the
lower-level pure helpers (_role_titles, _skill_terms, _location_terms,
_experience_terms) and for source_registry.resolve_source_plan itself
(country match, city-inference match, global fallback), which the root
file exercises only indirectly through build_dork_queries.
"""
from __future__ import annotations

from job_discovery.dork_discovery import (
    _experience_terms,
    _location_terms,
    _role_titles,
    _skill_terms,
    build_dork_queries,
    build_dork_search_plan,
    google_search_urls,
)
from job_discovery.source_registry import resolve_source_plan


# --- _role_titles -------------------------------------------------------------

def test_role_titles_expands_known_synonym_family():
    titles = _role_titles("QA Engineer")
    assert "SDET" in titles
    assert "QA Automation Engineer" in titles
    # The synonym family takes priority but the original phrase should not
    # be dropped entirely from downstream matching.
    assert "QA Engineer" in titles


def test_role_titles_adds_seniority_variants_when_none_present():
    titles = _role_titles("Backend Engineer")
    assert "Senior Backend Engineer" in titles
    assert "Lead Backend Engineer" in titles


def test_role_titles_does_not_double_up_seniority_when_already_present():
    titles = _role_titles("Principal Backend Engineer")
    assert "Senior Principal Backend Engineer" not in titles
    assert "Lead Principal Backend Engineer" not in titles


def test_role_titles_deduplicates_and_caps_at_eight():
    titles = _role_titles("qa")
    assert len(titles) <= 8
    assert len(titles) == len(set(titles))


# --- _skill_terms ---------------------------------------------------------------

def test_skill_terms_drops_blanks_and_dedupes_while_preserving_order():
    terms = _skill_terms(["Python", "", "Python", "Go", None, "Go"])
    assert terms == ["Python", "Go"]


def test_skill_terms_caps_at_eight():
    terms = _skill_terms([f"skill{i}" for i in range(20)])
    assert len(terms) == 8
    assert terms[0] == "skill0"


# --- _location_terms -------------------------------------------------------------

def test_location_terms_splits_on_commas():
    terms = _location_terms("Dublin, Ireland, Remote")
    assert terms == ["Dublin", "Ireland", "Remote"]


def test_location_terms_keeps_protected_two_word_city_together():
    terms = _location_terms("New York")
    assert terms == ["New York"]


def test_location_terms_splits_unprotected_multi_word_location():
    terms = _location_terms("Berlin Germany")
    assert terms == ["Berlin", "Germany"]


def test_location_terms_defaults_to_remote_when_blank():
    assert _location_terms("") == ["Remote"]
    assert _location_terms("   ") == ["Remote"]


# --- _experience_terms -------------------------------------------------------------

def test_experience_terms_include_relative_bands_for_given_years():
    terms = _experience_terms(6)
    assert "6+ years" in terms
    assert "4+ years" in terms
    assert "6 years experience" in terms


def test_experience_terms_add_principal_language_for_very_senior_candidates():
    terms = _experience_terms(12)
    assert "principal" in terms
    assert "architect" in terms


def test_experience_terms_fall_back_to_generic_bands_when_unspecified():
    terms = _experience_terms(0)
    assert "5+ years" in terms
    assert "7+ years" in terms


# --- resolve_source_plan (source_registry) -------------------------------------

def test_resolve_source_plan_matches_country_alias_directly():
    plan = resolve_source_plan("Remote, United Kingdom")
    assert plan.scope == "country"
    assert plan.country_code == "GB"
    assert "site:indeed.co.uk" in plan.job_boards
    assert plan.include_ats is True


def test_resolve_source_plan_infers_country_from_city_name():
    # "Berlin" alone doesn't mention Germany, but it is a registered
    # default_locations entry for the DE group.
    plan = resolve_source_plan("Berlin")
    assert plan.scope == "country"
    assert plan.country_code == "DE"
    assert "site:stepstone.de" in plan.job_boards


def test_resolve_source_plan_defaults_to_global_remote_when_blank():
    plan = resolve_source_plan("")
    assert plan.scope == "global_remote"
    assert plan.country_code is None


def test_resolve_source_plan_falls_back_to_global_for_unmatched_onsite_location():
    # No country/city alias matches and "remote" is not mentioned, so this
    # should be treated as a global (non-remote-flagged) search rather than
    # silently defaulting to a single country.
    plan = resolve_source_plan("Atlantis")
    assert plan.scope == "global"
    assert plan.country_code is None
    assert len(plan.job_boards) > 0


# --- build_dork_queries / build_dork_search_plan --------------------------------

def test_build_dork_queries_never_exceeds_max_and_has_no_duplicates():
    queries = build_dork_queries("Backend Engineer", ["Python", "AWS"], "Berlin, Germany", 5)
    assert 0 < len(queries) <= 8
    assert len(queries) == len(set(queries))


def test_build_dork_queries_mixes_precise_inurl_queries_with_a_broad_fallback():
    # The progressive strict/no-exp/no-skill queries all carry inurl: hints
    # to bias toward real job-posting pages; the final, broadest fallback
    # query intentionally drops them in favor of plain "jobs careers" text.
    queries = build_dork_queries("Backend Engineer", ["Python"], "London", 5)
    assert any("inurl:" in q for q in queries)
    assert any("inurl:" not in q for q in queries)


def test_build_dork_search_plan_exposes_matching_intent_and_source_plan():
    plan = build_dork_search_plan("SDET", ["Playwright"], "London, UK", 4)
    assert plan["source_plan"]["country_code"] == "GB"
    assert "Playwright" in plan["intent"]["skills"]
    assert plan["queries"] == build_dork_queries("SDET", ["Playwright"], "London, UK", 4)


def test_google_search_urls_percent_encodes_queries():
    urls = google_search_urls(['site:indeed.com AND "Backend Engineer"'])
    assert len(urls) == 1
    assert urls[0].startswith("https://www.google.com/search?q=")
    assert " " not in urls[0]
    assert "%22Backend" in urls[0] or "%22Backend%20Engineer%22" in urls[0]

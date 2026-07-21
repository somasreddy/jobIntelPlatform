from types import SimpleNamespace

from services.profile_intelligence import normalize_fact_key, profile_fact_specs


def test_normalized_profile_facts_are_deduplicated_and_typed():
    profile = SimpleNamespace(
        name="Ada Lovelace",
        current_role="Platform Engineer",
        experience_years=8,
        current_location="Berlin",
        work_mode="Remote",
        current_salary=120000,
        preferred_locations=["Berlin", "berlin", "Remote - EU"],
        skills=["Kubernetes", "kubernetes", "Python"],
        frameworks=[],
        languages=["Python"],
        cicd_tools=["GitHub Actions"],
        ai_tools=[],
        certifications=["CKA"],
    )
    specs = profile_fact_specs(profile)
    keys = [(item["fact_type"], item["normalized_key"]) for item in specs]
    assert len(keys) == len(set(keys))
    assert ("skill", "kubernetes") in keys
    assert ("preferred_location", "remote_eu") in keys
    assert ("experience", "experience_years") in keys


def test_fact_key_normalization_is_stable():
    assert normalize_fact_key("  GitHub Actions / CI  ") == "github_actions_ci"
    assert normalize_fact_key("C++") == "c"

import pytest

from services.application_status import (
    canonical_statuses,
    display_application_status,
    normalize_application_status,
)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("Ready to Apply", "ready_to_apply"),
        ("ready-to-apply", "ready_to_apply"),
        ("Recruiter Contacted", "recruiter_contacted"),
        ("Evaluated", "shortlisted"),
        ("Responded", "recruiter_contacted"),
        ("SKIP", "archived"),
        ("Negotiating", "offer"),
    ],
)
def test_normalizes_current_and_legacy_statuses(value, expected):
    assert normalize_application_status(value) == expected


def test_display_contract_stays_backward_compatible():
    assert display_application_status("final_interview") == "Final Interview"
    assert display_application_status("Rejected") == "Rejected"


def test_rejects_unknown_statuses():
    with pytest.raises(ValueError):
        normalize_application_status("maybe later")


def test_canonical_statuses_are_lowercase_keys():
    statuses = canonical_statuses()
    assert "ready_to_apply" in statuses
    assert all(status == status.lower() and " " not in status for status in statuses)

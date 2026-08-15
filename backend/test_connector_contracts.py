import json
from pathlib import Path

import pytest

from job_discovery.connector_contracts import (
    DEFINITIONS,
    parse_connector_payload,
    parse_json_ld_html,
)


@pytest.fixture(scope="module")
def payloads():
    path = Path(__file__).parent / "job_discovery" / "fixtures" / "ats_payloads.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("kind", ["greenhouse", "lever", "workday", "ashby", "generic"])
def test_captured_payloads_satisfy_normalized_contract(payloads, kind):
    batch = parse_connector_payload(
        kind,
        payloads[kind],
        organization="Acme",
        base_url="https://careers.acme.test/",
    )
    assert batch.status == "healthy"
    assert batch.received == 1
    assert len(batch.jobs) == 1
    job = batch.jobs[0]
    assert job["title"]
    assert job["organization"]
    assert job["application_link"].startswith("http")
    assert job["parser_version"] == DEFINITIONS[kind].parser_version
    assert job["source_capabilities"]["fallback"]


def test_schema_drift_is_observable_and_routes_to_fallback(payloads):
    batch = parse_connector_payload(
        "greenhouse",
        payloads["greenhouse_drift"],
        organization="Acme",
        base_url="https://careers.acme.test/",
    )
    assert batch.status == "drifted"
    assert batch.jobs == []
    assert batch.fallback == "career_page"
    assert batch.issues[0].code == "schema_drift"
    assert batch.telemetry()["accepted"] == 0


def test_partial_payload_rejects_bad_items_without_losing_valid_items(payloads):
    payload = {"jobs": [payloads["greenhouse"]["jobs"][0], {"id": 2, "title": ""}]}
    batch = parse_connector_payload(
        "greenhouse", payload, organization="Acme", base_url="https://careers.acme.test/"
    )
    assert batch.status == "partial"
    assert len(batch.jobs) == 1
    assert batch.rejected == 1


def test_generic_html_accepts_only_jobposting_json_ld(payloads):
    document = (
        '<script type="application/ld+json">'
        + json.dumps(payloads["generic"])
        + '</script><script type="application/json">{"title":"not a job"}</script>'
    )
    extracted = parse_json_ld_html(document)
    assert len(extracted) == 1
    batch = parse_connector_payload(
        "generic", extracted, organization="Fallback", base_url="https://careers.acme.test/"
    )
    assert batch.jobs[0]["organization"] == "Acme"
    assert batch.jobs[0]["extraction_confidence"] < 0.8

"""
Tests for JWT creation/verification in core.auth.

These are pure-function tests - no database, no network, no LLM calls.
They cover the contract `_decode_token` relies on everywhere else in the
app: a token round-trips its claims, an expired token is rejected, and a
token whose signature or payload has been tampered with is rejected.

A couple of API-level smoke tests at the bottom exercise the `client` /
`db_client` fixtures from conftest.py against the real FastAPI app.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from jose import jwt

from conftest import requires_database
from core.auth import (
    _ALGORITHM,
    _SECRET_KEY,
    _decode_token,
    create_access_token,
    create_refresh_token,
)


# --- Encode then decode ------------------------------------------------------

def test_access_token_roundtrips_claims():
    user_id = uuid.uuid4()
    token = create_access_token(user_id, "person@example.com")

    payload = _decode_token(token, expected_type="access")

    assert payload["sub"] == str(user_id)
    assert payload["email"] == "person@example.com"
    assert payload["type"] == "access"
    assert "exp" in payload and "iat" in payload


def test_refresh_token_roundtrips_claims():
    user_id = uuid.uuid4()
    token = create_refresh_token(user_id)

    payload = _decode_token(token, expected_type="refresh")

    assert payload["sub"] == str(user_id)
    assert payload["type"] == "refresh"


def test_access_and_refresh_tokens_are_distinct_and_not_interchangeable():
    user_id = uuid.uuid4()
    access = create_access_token(user_id, "person@example.com")
    refresh = create_refresh_token(user_id)

    assert access != refresh

    # An access token presented where a refresh token is expected must fail,
    # even though both are validly signed by this server.
    with pytest.raises(HTTPException) as exc_info:
        _decode_token(access, expected_type="refresh")
    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException) as exc_info:
        _decode_token(refresh, expected_type="access")
    assert exc_info.value.status_code == 401


# --- Expired token rejection --------------------------------------------------

def test_decode_rejects_expired_access_token():
    user_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    expired_payload = {
        "sub": str(user_id),
        "email": "person@example.com",
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),  # expired one hour ago
        "type": "access",
    }
    expired_token = jwt.encode(expired_payload, _SECRET_KEY, algorithm=_ALGORITHM)

    with pytest.raises(HTTPException) as exc_info:
        _decode_token(expired_token, expected_type="access")

    assert exc_info.value.status_code == 401


# --- Tampered signature / payload rejection -----------------------------------

def test_decode_rejects_tampered_signature():
    user_id = uuid.uuid4()
    token = create_access_token(user_id, "person@example.com")
    header_b64, payload_b64, signature_b64 = token.split(".")

    tampered_signature = signature_b64[::-1]
    if tampered_signature == signature_b64:  # guard against a palindrome fluke
        tampered_signature = signature_b64[:-1] + ("x" if signature_b64[-1] != "x" else "y")
    tampered_token = f"{header_b64}.{payload_b64}.{tampered_signature}"

    with pytest.raises(HTTPException) as exc_info:
        _decode_token(tampered_token, expected_type="access")

    assert exc_info.value.status_code == 401


def test_decode_rejects_payload_tampering_without_resigning():
    """An attacker editing claims (e.g. swapping the user id) without the
    secret key must still be rejected, because the signature no longer
    matches the mutated payload."""
    user_id = uuid.uuid4()
    token = create_access_token(user_id, "person@example.com")
    header_b64, payload_b64, signature_b64 = token.split(".")

    mutated_char = "A" if payload_b64[5] != "A" else "B"
    tampered_payload = payload_b64[:5] + mutated_char + payload_b64[6:]
    tampered_token = f"{header_b64}.{tampered_payload}.{signature_b64}"

    with pytest.raises(HTTPException) as exc_info:
        _decode_token(tampered_token, expected_type="access")

    assert exc_info.value.status_code == 401


def test_decode_rejects_token_signed_with_a_different_secret():
    """A token forged with a different secret (e.g. a guessed default) must
    not be accepted just because it is well-formed JWT."""
    user_id = uuid.uuid4()
    forged_payload = {"sub": str(user_id), "email": "person@example.com", "type": "access"}
    forged_token = jwt.encode(forged_payload, "a-completely-different-secret", algorithm=_ALGORITHM)

    with pytest.raises(HTTPException) as exc_info:
        _decode_token(forged_token, expected_type="access")

    assert exc_info.value.status_code == 401


def test_decode_rejects_garbage_token():
    with pytest.raises(HTTPException) as exc_info:
        _decode_token("not-a-jwt-at-all", expected_type="access")
    assert exc_info.value.status_code == 401


# --- API-level smoke tests using the TestClient fixtures ---------------------

def test_health_endpoint_does_not_require_a_database(client):
    """/health must respond without the app's lifespan (and therefore
    without a database) ever running - it's the endpoint infra uses to
    decide whether to route traffic to this instance."""
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@requires_database
def test_register_then_login_roundtrip_issues_working_tokens(db_client):
    """End-to-end: register a user, then log in with the same credentials,
    and confirm the returned access token decodes back to that user."""
    unique_email = f"pytest-{uuid.uuid4().hex}@example.com"
    password = "correct horse battery staple"

    register_response = db_client.post(
        "/api/auth/register",
        json={"name": "Pytest User", "email": unique_email, "password": password},
    )
    assert register_response.status_code == 201
    register_body = register_response.json()
    assert register_body["email"] == unique_email

    login_response = db_client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert login_response.status_code == 200
    login_body = login_response.json()

    payload = _decode_token(login_body["access_token"], expected_type="access")
    assert payload["email"] == unique_email
    assert payload["sub"] == register_body["user_id"]

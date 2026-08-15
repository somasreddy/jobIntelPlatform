"""
JWT Authentication utilities.
Uses python-jose for token encoding/decoding and passlib for password hashing.
"""
import uuid
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from core.config import settings

logger = logging.getLogger(__name__)

# ── Password hashing ─────────────────────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── JWT constants ────────────────────────────────────────────────────────────
# JWT_SECRET_KEY and REQUIRE_AUTH are typed fields on Settings (core/config.py),
# which also performs a startup-time safety check on their values.
_SECRET_KEY: str = settings.JWT_SECRET_KEY
_ALGORITHM  = "HS256"
_ACCESS_TTL  = timedelta(hours=24)
_REFRESH_TTL = timedelta(days=30)

# Public so callers outside this module (e.g. the cookie `max_age` in
# api/auth.py) can stay in sync with the access token's real lifetime
# without reaching into the private _ACCESS_TTL.
ACCESS_TOKEN_TTL_SECONDS: int = int(_ACCESS_TTL.total_seconds())


# ── Token creation ───────────────────────────────────────────────────────────
def create_access_token(user_id: uuid.UUID, email: str, csrf_token: Optional[str] = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":   str(user_id),
        "email": email,
        "iat":   now,
        "exp":   now + _ACCESS_TTL,
        "type":  "access",
    }
    if csrf_token:
        # Binds this token to a CSRF value for the optional cookie-auth path
        # (see require_csrf_if_cookie_auth below). Existing bearer-token
        # callers never pass this, so today's tokens are unaffected.
        payload["csrf"] = csrf_token
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


def create_refresh_token(user_id: uuid.UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":  str(user_id),
        "iat":  now,
        "exp":  now + _REFRESH_TTL,
        "type": "refresh",
    }
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


# ── Token verification ───────────────────────────────────────────────────────
def _decode_token(token: str, expected_type: str = "access") -> dict:
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
        if payload.get("type") != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FastAPI dependency ───────────────────────────────────────────────────────
_bearer = HTTPBearer(auto_error=False)

# Demo user UUID used as fallback when no token is provided (dev/demo mode)
_DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_DEMO_EMAIL   = "demo@jobintel.ai"


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """
    FastAPI dependency — returns { user_id: UUID, email: str }.

    If no Bearer token is provided, falls back to the demo user so that
    the platform works out-of-the-box without auth configured.
    Set REQUIRE_AUTH=true in env to enforce strict authentication.
    """
    require_auth = settings.REQUIRE_AUTH

    if not credentials:
        if require_auth:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"user_id": _DEMO_USER_ID, "email": _DEMO_EMAIL}

    payload = _decode_token(credentials.credentials, expected_type="access")
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token")

    return {"user_id": user_id, "email": payload.get("email", "")}


def get_current_user_id(
    current_user: dict = Depends(get_current_user),
) -> uuid.UUID:
    """Shorthand dependency — returns just the user_id UUID."""
    return current_user["user_id"]


# ── httpOnly-cookie session auth (additive, optional, not yet adopted) ──────
# Everything below is new scaffolding for an optional cookie-based session
# mode, for a future frontend migration. It does not change get_current_user
# above and is not wired into any router yet — see backend/api/auth.py for
# where the cookie actually gets set (opt-in via a `set_cookie` flag on
# /login and /register).

# Distinct from the frontend's existing "ji_token" localStorage key (a
# separate mechanism that remains the one actually in use today) so the two
# can never collide or be confused with one another.
SESSION_COOKIE_NAME = "ji_session"
CSRF_HEADER_NAME = "X-CSRF-Token"


def generate_csrf_token() -> str:
    """Random, unguessable CSRF token for the cookie-auth double-submit check."""
    return secrets.token_urlsafe(32)


def get_current_user_from_cookie_or_bearer(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """
    Same return contract as get_current_user, but checks the `ji_session`
    cookie first and falls back to the existing Authorization: Bearer
    header logic (get_current_user, unchanged) when no cookie is present.

    Additive dependency meant for routes to adopt incrementally later —
    swapping a route from get_current_user to this one is a no-op for
    today's bearer-token clients. Not wired into any router in this change.
    """
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie_token:
        return get_current_user(credentials)

    payload = _decode_token(cookie_token, expected_type="access")
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token")

    return {"user_id": user_id, "email": payload.get("email", "")}


def require_csrf_if_cookie_auth(request: Request) -> None:
    """
    CSRF guard for state-changing requests, scoped to the cookie-auth path.

    Bearer-token requests don't need this: the browser never attaches an
    Authorization header on its own, so a cross-site request can't forge
    one. Cookie requests are different — the browser *will* attach cookies
    automatically to a cross-site request — so state-changing routes that
    accept cookie auth should also depend on this to require a matching
    X-CSRF-Token header (double-submit check against the `csrf` claim
    embedded in the session JWT at login/register time, see
    create_access_token's csrf_token param above).

    A no-op when the request carries no session cookie (e.g. plain
    bearer-token requests), so adding this dependency to a route cannot
    break existing bearer clients.

    Not wired into any route in this change — a future adopter of
    get_current_user_from_cookie_or_bearer on a state-changing route should
    add `Depends(require_csrf_if_cookie_auth)` alongside it.
    """
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie_token:
        return

    payload = _decode_token(cookie_token, expected_type="access")
    expected_csrf = payload.get("csrf")
    provided_csrf = request.headers.get(CSRF_HEADER_NAME)

    if not expected_csrf or not provided_csrf or not secrets.compare_digest(expected_csrf, provided_csrf):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing or invalid CSRF token")

"""
JWT Authentication utilities.
Uses python-jose for token encoding/decoding and passlib for password hashing.
"""
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
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
_SECRET_KEY: str = getattr(settings, "JWT_SECRET_KEY", "change-me-in-production-use-env-var")
_ALGORITHM  = "HS256"
_ACCESS_TTL  = timedelta(hours=24)
_REFRESH_TTL = timedelta(days=30)


# ── Token creation ───────────────────────────────────────────────────────────
def create_access_token(user_id: uuid.UUID, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":   str(user_id),
        "email": email,
        "iat":   now,
        "exp":   now + _ACCESS_TTL,
        "type":  "access",
    }
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
    require_auth = getattr(settings, "REQUIRE_AUTH", "false").lower() == "true"

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

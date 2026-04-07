"""
Authentication API — register, login, refresh, me.
Stores users in a dedicated 'users' table (created via Alembic or raw SQL).
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    _decode_token,
    get_current_user,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("name")
    @classmethod
    def non_empty_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _ensure_users_table(db: AsyncSession) -> None:
    """Create the users table if it doesn't exist (idempotent)."""
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS users (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        TEXT NOT NULL,
            email       TEXT NOT NULL UNIQUE,
            hashed_pw   TEXT NOT NULL,
            plan        TEXT NOT NULL DEFAULT 'free',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_login  TIMESTAMPTZ
        )
    """))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)"))
    await db.flush()


async def _get_user_by_email(db: AsyncSession, email: str) -> dict | None:
    row = await db.execute(
        text("SELECT id, name, email, hashed_pw, plan FROM users WHERE email = :email"),
        {"email": email},
    )
    r = row.mappings().first()
    return dict(r) if r else None


async def _get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    row = await db.execute(
        text("SELECT id, name, email, plan, created_at FROM users WHERE id = :id"),
        {"id": str(user_id)},
    )
    r = row.mappings().first()
    return dict(r) if r else None


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/register", status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    await _ensure_users_table(db)

    existing = await _get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = uuid.uuid4()
    hashed = hash_password(payload.password)
    await db.execute(
        text("INSERT INTO users (id, name, email, hashed_pw) VALUES (:id, :name, :email, :hashed_pw)"),
        {"id": str(user_id), "name": payload.name, "email": payload.email, "hashed_pw": hashed},
    )
    await db.flush()

    access  = create_access_token(user_id, payload.email)
    refresh = create_refresh_token(user_id)

    return {
        "user_id":      str(user_id),
        "name":         payload.name,
        "email":        payload.email,
        "plan":         "free",
        "access_token":  access,
        "refresh_token": refresh,
        "token_type":   "bearer",
    }


@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate and return JWT tokens."""
    await _ensure_users_table(db)

    user = await _get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user["hashed_pw"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = uuid.UUID(str(user["id"]))

    # Update last_login
    await db.execute(
        text("UPDATE users SET last_login = NOW() WHERE id = :id"),
        {"id": str(user_id)},
    )
    await db.flush()

    access  = create_access_token(user_id, user["email"])
    refresh = create_refresh_token(user_id)

    return {
        "user_id":       str(user_id),
        "name":          user["name"],
        "email":         user["email"],
        "plan":          user["plan"],
        "access_token":  access,
        "refresh_token": refresh,
        "token_type":    "bearer",
    }


@router.post("/refresh")
async def refresh_token(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for a new access token."""
    token = payload.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token required")

    decoded = _decode_token(token, expected_type="refresh")
    user_id = uuid.UUID(decoded["sub"])

    user = await _get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access = create_access_token(user_id, user["email"])
    return {"access_token": access, "token_type": "bearer"}


@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current authenticated user details."""
    await _ensure_users_table(db)
    user = await _get_user_by_id(db, current_user["user_id"])
    if not user:
        # Demo user — return synthetic profile
        return {
            "user_id": str(current_user["user_id"]),
            "email":   current_user["email"],
            "name":    "Demo User",
            "plan":    "free",
            "is_demo": True,
        }
    return {
        "user_id":    str(user["id"]),
        "email":      user["email"],
        "name":       user["name"],
        "plan":       user["plan"],
        "created_at": str(user["created_at"])[:10] if user.get("created_at") else None,
        "is_demo":    False,
    }

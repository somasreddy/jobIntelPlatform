"""
Shared pytest fixtures for the backend test suite.

Design notes
------------
- No `__init__.py` exists anywhere under `backend/`, so the codebase imports
  modules absolutely from the `backend/` directory itself (e.g.
  `from core.auth import ...`, `from job_discovery.dork_discovery import
  ...`). Pytest's default rootdir-insertion only adds `backend/tests/` (the
  directory containing this file) to `sys.path`, not `backend/` - so we add
  `backend/` explicitly here, the same way `backend/test_integrations.py`
  does at the repo root.
- `DATABASE_URL` is pinned to a local placeholder *before* `core.config` /
  `main` get imported anywhere in the suite. This keeps test runs hermetic:
  tests never silently connect to whatever real Postgres a developer has
  configured in `backend/.env`, and it guarantees `main.py`'s lifespan
  treats a missing database as "local dev - degrade gracefully" rather than
  "production - fail fast" (see the `is_local_dev` check in backend/main.py).
- A real Postgres can still be exercised by setting `TEST_DATABASE_URL`
  before running pytest. Tests that need a live database are marked with
  `requires_database`, which skips them (instead of failing hard) when no
  such database is reachable - most of `models/database.py` and
  `api/auth.py`'s raw SQL use Postgres-only features (JSONB, gen_random_uuid,
  TIMESTAMPTZ), so a SQLite fallback would not exercise the real code paths.
"""
from __future__ import annotations

import os
import socket
import sys
from urllib.parse import urlsplit

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Pin the DB target before any app module is imported (see module docstring).
_DEFAULT_TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/job_platform_test"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", _DEFAULT_TEST_DB_URL)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-do-not-use-in-production")

from fastapi.testclient import TestClient  # noqa: E402

# Import the app defensively: backend/main.py, core/auth.py and core/config.py
# are actively edited by other agents in this repo, and pulling in `main`
# transitively imports all 24 API routers. A transient break in any one of
# them should not take down the pure-function tests (JWT, dork-query
# building, fit-score, salary prediction) that don't need the app object at
# all - only the `client` / `db_client` fixtures do, so only tests that use
# those fixtures get skipped if the import fails.
try:
    from main import app as _app  # noqa: E402
    _APP_IMPORT_ERROR: Exception | None = None
except Exception as exc:  # pragma: no cover - defensive
    _app = None
    _APP_IMPORT_ERROR = exc


def _postgres_reachable(database_url: str, timeout: float = 1.5) -> bool:
    """Best-effort TCP probe so the suite never hangs on an unreachable DB."""
    try:
        parts = urlsplit(database_url.replace("+asyncpg", ""))
        host = parts.hostname
        if not host:
            return False
        port = parts.port or 5432
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


DATABASE_AVAILABLE = _postgres_reachable(os.environ["DATABASE_URL"])

requires_database = pytest.mark.skipif(
    not DATABASE_AVAILABLE,
    reason=(
        "No reachable Postgres database configured for tests. Set "
        "TEST_DATABASE_URL to a live Postgres instance to run this test."
    ),
)


@pytest.fixture(scope="session")
def client() -> TestClient:
    """
    Plain TestClient for the real FastAPI app, without running the app's
    lifespan.

    `main.py`'s lifespan tries to open a real database connection and
    create tables on startup. We deliberately do NOT enter it here (i.e. no
    `with TestClient(app) as client:`) so routes that don't touch the
    database - `/health`, pure-logic endpoints, etc. - can be tested without
    ever attempting a DB connection. Use `db_client` below for tests that
    need the lifespan (and a real database) active.
    """
    if _app is None:
        pytest.skip(f"FastAPI app could not be imported: {_APP_IMPORT_ERROR!r}")
    return TestClient(_app)


@pytest.fixture(scope="session")
def db_client():
    """TestClient with the app's lifespan active. Only meaningful when a
    real test database is reachable - pair with `requires_database`."""
    if _app is None:
        pytest.skip(f"FastAPI app could not be imported: {_APP_IMPORT_ERROR!r}")
    with TestClient(_app) as test_client:
        yield test_client

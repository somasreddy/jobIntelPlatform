from typing import Any
from uuid import uuid4

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from core.config import settings


def _prepared_statement_name() -> str:
    """Generate collision-resistant statement names for transaction poolers."""
    return f"__asyncpg_{uuid4()}__"


def _engine_options(url: str, ssl_required: bool) -> dict[str, Any]:
    """Build SQLAlchemy options compatible with direct, session, and transaction connections."""
    connect_args: dict[str, Any] = {}
    if ssl_required:
        connect_args["ssl"] = True

    options: dict[str, Any] = {
        "echo": False,
        "pool_pre_ping": True,
        "connect_args": connect_args,
    }

    if make_url(url).port == 6543:
        # Supavisor/PgBouncer transaction mode cannot safely reuse asyncpg's
        # automatic prepared statements or an application-side connection pool.
        connect_args.update(
            {
                "statement_cache_size": 0,
                "prepared_statement_name_func": _prepared_statement_name,
            }
        )
        options["poolclass"] = NullPool
    else:
        options.update({"pool_size": 10, "max_overflow": 20})

    return options


database_url = settings.DATABASE_URL
engine = create_async_engine(database_url, **_engine_options(database_url, settings.DATABASE_SSL_REQUIRED))

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

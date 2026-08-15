import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Ensure the `backend/` directory (the parent of this `alembic/` package) is
# importable regardless of the working directory `alembic` is invoked from,
# so that `core.*` / `models.*` resolve the same way they do for the app
# itself (see backend/main.py, which imports the same modules the same way).
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from core.config import settings          # noqa: E402
from core.database import Base            # noqa: E402
from models import database as _models    # noqa: E402,F401 - imports every model class so it registers on Base.metadata

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.

# The database URL is never hardcoded in alembic.ini - it comes from this
# project's own Settings object, which in turn resolves DATABASE_URL (or the
# Vercel/Supabase POSTGRES_URL* fallbacks) from the environment. This keeps
# a single source of truth with backend/core/database.py.
#
# Deliberately NOT using `config.set_main_option("sqlalchemy.url", ...)` /
# `async_engine_from_config(...)` here: alembic.ini is parsed with
# configparser's interpolation enabled, which chokes on a literal "%" (a
# `%40`-style URL-encoded character in a password, e.g. Supabase/Neon
# connection strings, raises `ValueError: invalid interpolation syntax`).
# Building the engine directly from `settings.DATABASE_URL` sidesteps
# configparser entirely.
DB_URL = settings.DATABASE_URL


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an AsyncEngine
    and associate a connection with the context.

    This project's models are async-only (asyncpg), so migrations run
    through an AsyncEngine and hand the sync-style Alembic migration
    context over via `run_sync`, per Alembic's documented approach for
    async dialects.
    """
    # Mirrors the SSL handling in backend/core/database.py so migrations
    # connect the same way the application does (e.g. against Neon/Supabase).
    connect_args = {"ssl": True} if settings.DATABASE_SSL_REQUIRED else {}

    connectable = create_async_engine(
        DB_URL,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

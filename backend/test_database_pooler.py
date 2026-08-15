from sqlalchemy.pool import NullPool

from core.database import _engine_options


def test_transaction_pooler_disables_asyncpg_statement_cache():
    options = _engine_options(
        "postgresql+asyncpg://user:pass@pooler.example.com:6543/postgres?prepared_statement_cache_size=0",
        ssl_required=True,
    )

    connect_args = options["connect_args"]
    assert connect_args["ssl"] is True
    assert connect_args["statement_cache_size"] == 0
    assert callable(connect_args["prepared_statement_name_func"])
    assert connect_args["prepared_statement_name_func"]() != connect_args["prepared_statement_name_func"]()
    assert options["poolclass"] is NullPool
    assert "pool_size" not in options
    assert "max_overflow" not in options


def test_session_connection_keeps_sqlalchemy_pooling():
    options = _engine_options(
        "postgresql+asyncpg://user:pass@pooler.example.com:5432/postgres",
        ssl_required=False,
    )

    assert options["connect_args"] == {}
    assert options["pool_size"] == 10
    assert options["max_overflow"] == 20
    assert "poolclass" not in options

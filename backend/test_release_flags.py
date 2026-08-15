from core.feature_flags import deployment_warnings, feature_flags


def test_enterprise_feature_flags_are_explicit():
    flags = feature_flags()
    assert flags["contract_connectors"] is True
    assert flags["deterministic_ranking"] is True
    assert flags["profile_intelligence"] is True
    assert flags["admin_operations"] is True
    assert flags["startup_schema_sync"] is False


def test_optional_auth_is_reported_not_silently_hidden():
    assert any(item["code"] == "auth_optional" for item in deployment_warnings())

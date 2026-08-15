from core.rbac import is_configured_admin


def test_demo_admin_is_explicitly_configured_for_local_mode():
    assert is_configured_admin("demo@jobintel.ai")


def test_arbitrary_user_is_not_admin():
    assert not is_configured_admin("candidate@example.com")

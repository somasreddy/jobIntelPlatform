from job_discovery.dork_discovery import build_dork_queries, build_dork_search_plan


def _joined(location: str) -> str:
    return "\n".join(
        build_dork_queries(
            "Senior Test Automation Engineer",
            ["Playwright", "Selenium WebDriver", "API testing"],
            location,
            9,
        )
    )


def test_india_search_uses_only_india_job_boards():
    query_text = _joined("Bengaluru, India")
    assert "site:naukri.com" in query_text
    assert "site:indeed.co.in" in query_text
    assert len(build_dork_queries("Senior Test Automation Engineer", ["Playwright", "Selenium WebDriver", "API testing"], "Bengaluru, India", 9)) >= 4
    assert "site:jobsireland.ie" not in query_text
    assert "site:indeed.com OR site:monster.com" not in query_text
    assert "site:myworkdayjobs.com" not in query_text


def test_ireland_search_uses_only_ireland_job_boards():
    query_text = _joined("Dublin, Ireland, Remote")
    assert "site:jobsireland.ie" in query_text
    assert "site:ie.indeed.com" in query_text
    assert "site:naukri.com" not in query_text
    assert "site:myworkdayjobs.com" not in query_text


def test_remote_without_country_uses_worldwide_sources():
    plan = build_dork_search_plan(
        "Senior Test Automation Engineer",
        ["Playwright", "Selenium WebDriver", "API testing"],
        "Remote",
        9,
    )
    query_text = "\n".join(plan["queries"])
    assert plan["source_plan"]["scope"] == "global_remote"
    assert plan["source_plan"]["include_ats"] is True
    assert "site:myworkdayjobs.com" in query_text
    assert "site:naukri.com" in query_text
    assert "site:jobsireland.ie" in query_text
    assert "site:indeed.com OR site:monster.com" in query_text
    assert "site:computrabajo.com" in query_text
    assert len(plan["queries"]) >= 4

from job_discovery.dork_discovery import build_dork_queries, build_dork_search_plan, _direct_board_search_urls


def _joined(location: str) -> str:
    return "\n".join(
        build_dork_queries(
            "Senior Test Automation Engineer",
            ["Playwright", "Selenium WebDriver", "API testing"],
            location,
            9,
        )
    )


def test_india_search_uses_trusted_ats_plus_india_job_boards():
    query_text = _joined("Bengaluru, India")
    assert "site:naukri.com" in query_text
    assert "site:indeed.co.in" in query_text
    assert len(build_dork_queries("Senior Test Automation Engineer", ["Playwright", "Selenium WebDriver", "API testing"], "Bengaluru, India", 9)) >= 4
    assert "site:jobsireland.ie" not in query_text
    assert "site:indeed.com OR site:monster.com" not in query_text
    assert "site:myworkdayjobs.com" in query_text
    assert "site:greenhouse.io" in query_text


def test_ireland_search_uses_trusted_ats_plus_ireland_job_boards():
    query_text = _joined("Dublin, Ireland, Remote")
    assert "site:jobsireland.ie" in query_text
    assert "site:ie.indeed.com" in query_text
    assert "site:naukri.com" not in query_text
    assert "site:myworkdayjobs.com" in query_text
    assert "site:greenhouse.io" in query_text


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


def test_queries_do_not_embed_negative_blacklist_terms():
    query_text = _joined("Bengaluru, India")
    assert '-"Fresher"' not in query_text
    assert '-"Internship"' not in query_text
    assert '-"Customer Support"' not in query_text
    assert '-"CV template"' not in query_text


def test_direct_board_urls_are_country_scoped_for_india():
    urls = _direct_board_search_urls(
        "Senior Test Automation Engineer",
        ["Selenium WebDriver"],
        "Bengaluru, India",
    )
    joined = "\n".join(urls)
    assert "naukri.com" in joined
    assert "timesjobs.com" in joined
    assert "in.indeed.com" in joined
    assert "jobsireland.ie" not in joined
    assert "https://www.indeed.com/jobs" not in joined


def test_direct_board_urls_cover_remote_worldwide():
    urls = _direct_board_search_urls(
        "Senior Test Automation Engineer",
        ["Selenium WebDriver"],
        "Remote",
    )
    joined = "\n".join(urls)
    assert "linkedin.com/jobs" in joined
    assert "naukri.com" in joined
    assert "jobsireland.ie" in joined
    assert "indeed.com/jobs" in joined

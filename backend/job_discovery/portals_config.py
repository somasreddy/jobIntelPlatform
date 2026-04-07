"""
Portal Scanner Configuration — Career-Ops Integration
Ported from career-ops/portals.example.yml to Python config.

Three discovery levels:
  Level 1: Playwright direct (tracked company career pages)
  Level 2: Greenhouse/Ashby/Lever JSON APIs
  Level 3: WebSearch broad queries (site: filters)
"""

# ─────────────────────────────────────────────────────────────────────────────
# Title Filter — keywords for relevance filtering
# ─────────────────────────────────────────────────────────────────────────────
TITLE_FILTER = {
    "positive": [
        # AI/ML roles
        "AI", "ML", "LLM", "Agent", "Agentic", "GenAI", "Generative AI",
        "NLP", "LLMOps", "MLOps", "Voice AI", "Conversational AI", "Speech",
        # DACH market
        "KI", "Künstliche Intelligenz", "KI Engineer", "KI Trainer",
        "Dozent", "Weiterbildung",
        # Engineering roles
        "Platform Engineer", "Solutions Architect", "Solutions Engineer",
        "Forward Deployed", "Deployed Engineer", "Customer Engineer",
        "Integration Engineer",
        # Product roles
        "Product Manager", "Technical PM",
        # Automation roles
        "Automation", "Hyperautomation", "Low-Code", "No-Code",
        "GTM Engineer", "RevOps", "Business Systems", "Internal Tools",
        "Transformation",
    ],
    "negative": [
        "Junior", "Intern", ".NET", "Java ", "iOS", "Android",
        "PHP", "Ruby", "Embedded", "Firmware", "FPGA", "ASIC",
        "Blockchain", "Web3", "Crypto", "Salesforce Admin", "SAP ",
        "Oracle EBS", "Mainframe", "COBOL",
    ],
    "seniority_boost": [
        "Senior", "Staff", "Principal", "Lead", "Head", "Director",
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Tracked Companies — direct career page URLs
# ─────────────────────────────────────────────────────────────────────────────
TRACKED_COMPANIES = [

    # -- AI Labs & LLM providers --
    {"company": "Anthropic", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/anthropic", "api": "https://boards-api.greenhouse.io/v1/boards/anthropic/jobs", "enabled": True},
    {"company": "OpenAI", "platform": "custom", "careers_url": "https://openai.com/careers", "enabled": True},
    {"company": "Cohere", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/cohere", "notes": "AI/LLM provider. Toronto + remote.", "enabled": True},
    {"company": "LangChain", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/langchain", "notes": "LangChain/LangSmith framework.", "enabled": True},
    {"company": "Mistral AI", "platform": "lever", "careers_url": "https://jobs.lever.co/mistral", "notes": "Paris. European AI lab.", "enabled": True},
    {"company": "Hugging Face", "platform": "workable", "careers_url": "https://apply.workable.com/huggingface/", "notes": "Paris / NYC / Remote. ML hub & open-source models.", "enabled": True},

    # -- Voice AI & Conversational AI --
    {"company": "PolyAI", "platform": "greenhouse", "careers_url": "https://job-boards.eu.greenhouse.io/polyai", "api": "https://boards-api.greenhouse.io/v1/boards/polyai/jobs", "notes": "UK. Voice AI for enterprise contact centers.", "enabled": True},
    {"company": "Parloa", "platform": "greenhouse", "careers_url": "https://job-boards.eu.greenhouse.io/parloa", "api": "https://boards-api.greenhouse.io/v1/boards/parloa/jobs", "notes": "Berlin EMEA. Voice AI enterprise.", "enabled": True},
    {"company": "Hume AI", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/humeai", "api": "https://boards-api.greenhouse.io/v1/boards/humeai/jobs", "notes": "NYC. Empathic voice AI.", "enabled": True},
    {"company": "ElevenLabs", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/elevenlabs", "notes": "Voice AI TTS leader.", "enabled": True},
    {"company": "Deepgram", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/deepgram", "notes": "STT/TTS APIs.", "enabled": True},
    {"company": "Vapi", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/vapi", "notes": "Voice AI infrastructure.", "enabled": True},
    {"company": "Bland AI", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/bland", "notes": "Voice phone agents. $65M Series B.", "enabled": True},
    {"company": "Speechmatics", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/speechmatics", "api": "https://boards-api.greenhouse.io/v1/boards/speechmatics/jobs", "notes": "Cambridge UK. Speech recognition platform.", "enabled": True},

    # -- Contact Center AI & CX --
    {"company": "Intercom", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/intercom", "api": "https://boards-api.greenhouse.io/v1/boards/intercom/jobs", "notes": "Dublin EMEA. Fin AI agent.", "enabled": True},
    {"company": "Ada", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/ada", "notes": "Toronto + remote. AI customer service.", "enabled": True},
    {"company": "Sierra", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/sierra", "notes": "Bret Taylor (ex-CEO Salesforce). AI customer agents.", "enabled": True},
    {"company": "Decagon", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/decagon", "notes": "AI customer support agents.", "enabled": True},
    {"company": "Gong", "platform": "custom", "careers_url": "https://www.gong.io/careers", "notes": "Revenue intelligence with voice AI.", "enabled": True},
    {"company": "Talkdesk", "platform": "custom", "careers_url": "https://www.talkdesk.com/careers", "notes": "Lisbon. Contact center AI. EMEA friendly.", "enabled": True},
    {"company": "LivePerson", "platform": "custom", "careers_url": "https://liveperson.com/company/careers", "notes": "Remote EMEA. Conversational AI enterprise.", "enabled": True},
    {"company": "Genesys", "platform": "custom", "careers_url": "https://www.genesys.com/careers", "notes": "Contact center cloud + AI.", "enabled": True},
    {"company": "Dialpad", "platform": "custom", "careers_url": "https://www.dialpad.com/careers", "notes": "Voice AI for business comms.", "enabled": True},

    # -- AI-native platforms (FDE/SA teams) --
    {"company": "Retool", "platform": "custom", "careers_url": "https://retool.com/careers", "notes": "London. Popularized Deployed Engineer role.", "enabled": True},
    {"company": "Airtable", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/airtable", "api": "https://boards-api.greenhouse.io/v1/boards/airtable/jobs", "notes": "No-code + AI platform.", "enabled": True},
    {"company": "Vercel", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/vercel", "api": "https://boards-api.greenhouse.io/v1/boards/vercel/jobs", "notes": "AI SDK, v0.dev. Frontend AI tooling.", "enabled": True},
    {"company": "Temporal", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/temporal", "api": "https://boards-api.greenhouse.io/v1/boards/temporal/jobs", "notes": "Workflow orchestration.", "enabled": True},
    {"company": "Arize AI", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/arizeai", "api": "https://boards-api.greenhouse.io/v1/boards/arizeai/jobs", "notes": "LLMOps / AI observability.", "enabled": True},
    {"company": "Glean", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/gleanwork", "api": "https://boards-api.greenhouse.io/v1/boards/gleanwork/jobs", "notes": "Enterprise AI search.", "enabled": True},
    {"company": "Pinecone", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/pinecone", "notes": "Vector database.", "enabled": True},
    {"company": "Lindy", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/lindy", "notes": "AI agent management platform.", "enabled": True},

    # -- AI Infra & LLMOps --
    {"company": "Weights & Biases", "platform": "lever", "careers_url": "https://jobs.lever.co/wandb", "notes": "MLOps platform.", "enabled": True},
    {"company": "RunPod", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/runpod", "api": "https://boards-api.greenhouse.io/v1/boards/runpod/jobs", "notes": "GPU cloud for AI.", "enabled": True},
    {"company": "Langfuse", "platform": "custom", "careers_url": "https://langfuse.com/careers", "notes": "Berlin. LLMOps / observability.", "enabled": True},
    {"company": "Cognigy", "platform": "custom", "careers_url": "https://careers.cognigy.com", "notes": "Dusseldorf EMEA. Conversational AI enterprise.", "enabled": True},

    # -- No-Code / Low-Code / Automation --
    {"company": "n8n", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/n8n", "notes": "Berlin + remote EU/US. Workflow automation.", "enabled": True},
    {"company": "Zapier", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/zapier", "notes": "Remote-first. Automation platform leader.", "enabled": True},
    {"company": "Make.com", "platform": "custom", "careers_url": "https://www.make.com/en/careers", "notes": "Celonis parent company. Automation platform.", "enabled": True},

    # -- Enterprise SaaS --
    {"company": "Salesforce", "platform": "custom", "careers_url": "https://careers.salesforce.com", "notes": "Agentforce = AI agents platform.", "enabled": True},
    {"company": "Palantir", "platform": "lever", "careers_url": "https://jobs.lever.co/palantir", "notes": "FDE roles. Mostly US/London.", "enabled": True},
    {"company": "Twilio", "platform": "custom", "careers_url": "https://www.twilio.com/en-us/company/jobs", "notes": "Voice/messaging infrastructure.", "enabled": True},
    {"company": "Datadog", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/datadog", "api": "https://boards-api.greenhouse.io/v1/boards/datadog/jobs", "enabled": True},
    {"company": "Stripe", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/stripe", "api": "https://boards-api.greenhouse.io/v1/boards/stripe/jobs", "enabled": True},

    # -- DACH AI labs & frontier model providers --
    {"company": "Aleph Alpha", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/AlephAlpha", "notes": "Heidelberg DE. Sovereign European LLM provider.", "enabled": True},
    {"company": "DeepL", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/DeepL", "notes": "Cologne DE. Translation & language AI.", "enabled": True},
    {"company": "Black Forest Labs", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/blackforestlabs", "api": "https://boards-api.greenhouse.io/v1/boards/blackforestlabs/jobs", "notes": "Freiburg DE / SF. FLUX image models.", "enabled": True},
    {"company": "Helsing", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/helsing", "api": "https://boards-api.greenhouse.io/v1/boards/helsing/jobs", "notes": "Munich / Berlin / London / Paris. Defence AI unicorn.", "enabled": True},

    # -- DACH enterprise & SaaS (AI-heavy) --
    {"company": "Celonis", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/celonis", "api": "https://boards-api.greenhouse.io/v1/boards/celonis/jobs", "notes": "Munich / NYC. Process intelligence, Applied AI Engineer roles.", "enabled": True},
    {"company": "Contentful", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/contentful", "api": "https://boards-api.greenhouse.io/v1/boards/contentful/jobs", "notes": "Berlin / Denver. Headless CMS, AI content workflows.", "enabled": True},
    {"company": "GetYourGuide", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/getyourguide", "api": "https://boards-api.greenhouse.io/v1/boards/getyourguide/jobs", "notes": "Berlin. Travel marketplace, ML & data platform roles.", "enabled": True},
    {"company": "HelloFresh", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/hellofresh", "api": "https://boards-api.greenhouse.io/v1/boards/hellofresh/jobs", "notes": "Berlin. Large data/ML org.", "enabled": True},

    # -- DACH fintech --
    {"company": "N26", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/n26", "api": "https://boards-api.greenhouse.io/v1/boards/n26/jobs", "notes": "Berlin / Barcelona. Mobile bank, ML & risk.", "enabled": True},
    {"company": "Trade Republic", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/traderepublicbank", "api": "https://boards-api.greenhouse.io/v1/boards/traderepublicbank/jobs", "notes": "Berlin / London / Paris. Neobroker.", "enabled": True},
    {"company": "SumUp", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/sumup", "api": "https://boards-api.greenhouse.io/v1/boards/sumup/jobs", "notes": "Berlin / London. Payments fintech.", "enabled": True},
    {"company": "Qonto", "platform": "lever", "careers_url": "https://jobs.lever.co/qonto", "notes": "Paris / Berlin / Barcelona / Milan. SMB neobank.", "enabled": True},

    # -- DACH logistics / mobility --
    {"company": "Forto", "platform": "lever", "careers_url": "https://jobs.lever.co/forto", "notes": "Berlin DE. Digital freight forwarder.", "enabled": True},

    # -- Switzerland / Austria AI --
    {"company": "Lakera", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/lakera.ai", "notes": "Zurich CH / SF. AI security & guardrails.", "enabled": True},
    {"company": "Scandit", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/scandit", "api": "https://boards-api.greenhouse.io/v1/boards/scandit/jobs", "notes": "Zurich CH. Computer vision / smart data capture.", "enabled": True},
    {"company": "Cradle", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/cradlebio", "notes": "Zurich CH / Amsterdam. AI-guided protein design.", "enabled": True},

    # -- France AI ecosystem --
    {"company": "Photoroom", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/photoroom", "notes": "Paris FR. AI photo editor.", "enabled": True},
    {"company": "Pigment", "platform": "lever", "careers_url": "https://jobs.lever.co/pigment", "notes": "Paris FR / NYC / London. AI-powered FP&A planning platform.", "enabled": True},

    # -- UK & Ireland AI (EU-friendly hiring) --
    {"company": "Wayve", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/wayve", "api": "https://boards-api.greenhouse.io/v1/boards/wayve/jobs", "notes": "London UK. Embodied AI for self-driving.", "enabled": True},
    {"company": "Isomorphic Labs", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/isomorphiclabs", "api": "https://boards-api.greenhouse.io/v1/boards/isomorphiclabs/jobs", "notes": "London / Lausanne / Cambridge MA. DeepMind spin-out.", "enabled": True},
    {"company": "PhysicsX", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/physicsx", "api": "https://boards-api.greenhouse.io/v1/boards/physicsx/jobs", "notes": "London UK. Physics-informed ML for engineering.", "enabled": True},
    {"company": "Stability AI", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/stabilityai", "api": "https://boards-api.greenhouse.io/v1/boards/stabilityai/jobs", "notes": "London / SF. Generative AI image/video research lab.", "enabled": True},
    {"company": "Synthesia", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/synthesia", "notes": "London UK. AI video generation for enterprise, $4B valuation.", "enabled": True},
    {"company": "Faculty", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/faculty", "notes": "London UK. Applied AI consultancy.", "enabled": True},
    {"company": "Causaly", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/causaly", "notes": "London / Athens. Biomedical knowledge graph + AI.", "enabled": True},

    # -- Nordics AI --
    {"company": "Lovable", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/lovable", "notes": "Stockholm SE. AI app builder (text-to-app).", "enabled": True},
    {"company": "Legora", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/legora", "notes": "Stockholm SE / NYC / London. AI-native legal workspace.", "enabled": True},
    {"company": "Spotify", "platform": "lever", "careers_url": "https://jobs.lever.co/spotify", "notes": "Stockholm SE / NYC / London. Large ML/personalization org.", "enabled": True},
    {"company": "Vinted", "platform": "lever", "careers_url": "https://jobs.lever.co/vinted", "notes": "Vilnius LT / Berlin. C2C marketplace unicorn, data science & ML.", "enabled": True},

    # -- Iberia AI --
    {"company": "Amplemarket", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/amplemarket", "api": "https://boards-api.greenhouse.io/v1/boards/amplemarket/jobs", "notes": "Lisbon PT / Remote. AI-native sales platform.", "enabled": True},
    {"company": "Attio", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/attio", "notes": "Remote EU. AI-native CRM. Series B $52M.", "enabled": True},
    {"company": "Travelperk", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/travelperk", "notes": "Barcelona. Business travel unicorn.", "enabled": True},
    {"company": "Factorial", "platform": "greenhouse", "careers_url": "https://job-boards.greenhouse.io/factorial", "notes": "Barcelona. HR SaaS unicorn.", "enabled": True},
    {"company": "Tinybird", "platform": "ashby", "careers_url": "https://jobs.ashbyhq.com/tinybird", "notes": "Remote. Real-time data platform.", "enabled": True},
    {"company": "Clarity AI", "platform": "lever", "careers_url": "https://jobs.lever.co/clarity-ai", "notes": "Madrid/Remote. Sustainability analytics with AI.", "enabled": True},
]


# ─────────────────────────────────────────────────────────────────────────────
# WebSearch Queries — Level 3 broad discovery
# ─────────────────────────────────────────────────────────────────────────────
SEARCH_QUERIES = [
    # Ashby
    {"name": "Ashby — AI PM", "query": 'site:jobs.ashbyhq.com "AI Product Manager" OR "Senior Product Manager AI" remote', "enabled": True},
    {"name": "Ashby — Solutions Architect", "query": 'site:jobs.ashbyhq.com "Solutions Architect" AI OR automation remote', "enabled": True},
    {"name": "Ashby — AI Engineer", "query": 'site:jobs.ashbyhq.com "AI Engineer" OR "LLM Engineer" OR "Forward Deployed" remote', "enabled": True},
    {"name": "Ashby — Agentic", "query": 'site:jobs.ashbyhq.com "Agentic" OR "AI Agent" OR "Automation Architect" remote', "enabled": True},
    {"name": "Ashby — No-Code & Automation", "query": 'site:jobs.ashbyhq.com "no-code" OR "low-code" OR "automation engineer" OR "n8n" OR "Make" remote senior', "enabled": True},
    # Greenhouse
    {"name": "Greenhouse — AI PM", "query": 'site:boards.greenhouse.io OR site:job-boards.greenhouse.io "AI Product Manager" OR "Senior Product Manager" AI remote', "enabled": True},
    {"name": "Greenhouse — SA & FDE", "query": 'site:boards.greenhouse.io OR site:job-boards.greenhouse.io "Solutions Architect" OR "Forward Deployed" AI remote', "enabled": True},
    {"name": "Greenhouse — AI Engineer", "query": 'site:boards.greenhouse.io OR site:job-boards.greenhouse.io "AI Engineer" OR "LLM" OR "Agentic" remote', "enabled": True},
    {"name": "Greenhouse — No-Code & Automation", "query": 'site:job-boards.greenhouse.io "no-code" OR "low-code" OR "automation engineer" OR "business systems" senior remote', "enabled": True},
    # Lever
    {"name": "Lever — AI PM", "query": 'site:jobs.lever.co "AI Product Manager" OR "Solutions Architect" AI remote', "enabled": True},
    {"name": "Lever — AI Roles", "query": 'site:jobs.lever.co "AI Engineer" OR "Agentic" OR "LLMOps" OR "Automation" remote', "enabled": True},
    # Specialized
    {"name": "GTM Engineer — All portals", "query": '"GTM Engineer" OR "RevOps Engineer" OR "Growth Engineer" automation Airtable OR Make OR Clay remote', "enabled": True},
    {"name": "Voice AI — FDE & SA", "query": 'site:job-boards.greenhouse.io OR site:jobs.ashbyhq.com "Voice AI" OR "Conversational AI" OR "Speech" "Solutions" OR "Forward Deployed" OR "Customer Engineer"', "enabled": True},
    {"name": "FDE & Deployed Engineer — All portals", "query": '"Forward Deployed Engineer" OR "Deployed Engineer" OR "Deployment Engineer" AI site:job-boards.greenhouse.io OR site:jobs.ashbyhq.com OR site:jobs.lever.co', "enabled": True},
    {"name": "Contact Center AI — SA & SE", "query": '"contact center" OR "customer service" "AI" "Solutions Architect" OR "Solutions Engineer" OR "Forward Deployed" remote', "enabled": True},
    {"name": "Wellfound — AI PM", "query": 'site:wellfound.com "AI Product Manager" OR "AI Solutions" remote', "enabled": True},
]


def get_enabled_companies() -> list[dict]:
    """Return only enabled tracked companies."""
    return [c for c in TRACKED_COMPANIES if c.get("enabled")]


def get_greenhouse_companies() -> list[dict]:
    """Return tracked companies with Greenhouse API URLs."""
    return [c for c in TRACKED_COMPANIES if c.get("api") and c.get("enabled")]


def get_ashby_companies() -> list[dict]:
    """Return Ashby-based companies for direct crawl."""
    return [c for c in TRACKED_COMPANIES if c.get("platform") == "ashby" and c.get("enabled")]


def get_lever_companies() -> list[dict]:
    """Return Lever-based companies for direct crawl."""
    return [c for c in TRACKED_COMPANIES if c.get("platform") == "lever" and c.get("enabled")]


def get_enabled_queries() -> list[dict]:
    """Return only enabled search queries."""
    return [q for q in SEARCH_QUERIES if q.get("enabled")]


def filter_title(title: str) -> dict:
    """
    Apply title_filter rules. Returns:
      { "passes": bool, "reason": str, "seniority_boost": bool }
    """
    title_lower = title.lower()

    # Check negative keywords (any match = reject)
    for neg in TITLE_FILTER["negative"]:
        if neg.lower() in title_lower:
            return {"passes": False, "reason": f"Negative keyword: {neg}", "seniority_boost": False}

    # Check positive keywords (at least one must match)
    has_positive = any(pos.lower() in title_lower for pos in TITLE_FILTER["positive"])
    if not has_positive:
        return {"passes": False, "reason": "No positive keyword match", "seniority_boost": False}

    # Check seniority boost
    has_boost = any(s.lower() in title_lower for s in TITLE_FILTER["seniority_boost"])

    return {"passes": True, "reason": "Match", "seniority_boost": has_boost}

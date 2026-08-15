"""Read-only release smoke checks against a running deployment."""
from __future__ import annotations

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE_URL = os.getenv("JOBINTEL_SMOKE_URL", "http://localhost:8000").rstrip("/")
TOKEN = os.getenv("JOBINTEL_SMOKE_TOKEN", "")


def request(path: str) -> tuple[int, dict]:
    headers = {"Accept": "application/json"}
    if TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    try:
        with urlopen(Request(BASE_URL + path, headers=headers), timeout=15) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        payload = json.loads(exc.read().decode("utf-8") or "{}")
        return exc.code, payload


def main() -> int:
    checks = [("/health", 200), ("/ready", 200)]
    if TOKEN:
        checks.append(("/api/admin/source-health", 200))
    failed = []
    for path, expected in checks:
        try:
            status, payload = request(path)
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            failed.append({"path": path, "error": type(exc).__name__})
            continue
        print(json.dumps({"path": path, "status": status, "payload": payload}, default=str))
        if status != expected:
            failed.append({"path": path, "status": status, "expected": expected})
    if failed:
        print(json.dumps({"smoke": "failed", "failures": failed}))
        return 1
    print(json.dumps({"smoke": "passed", "checks": len(checks)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

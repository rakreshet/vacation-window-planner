"""Measure warm Search latency against a local disposable acceptance environment."""

import json
import math
import platform
import statistics
import time
import urllib.request
from datetime import date, timedelta

BASE_URL = "http://127.0.0.1:18080"


def post(path: str, payload: dict, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        BASE_URL + path, data=json.dumps(payload).encode(), headers=headers
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def measure(country: str, many_rules: bool = False) -> dict:
    today = date.today()
    next_month = (today.replace(day=1) + timedelta(days=32)).replace(day=1)
    rules = (
        [
            {
                "start_date": (today + timedelta(days=800 + offset * 3)).isoformat(),
                "end_date": (today + timedelta(days=800 + offset * 3)).isoformat(),
                "kind": "extra_working_day",
            }
            for offset in range(100)
        ]
        if many_rules
        else []
    )
    session = post(
        "/sessions",
        {
            "balance_days": 28,
            "allowed_negative_days": 0,
            "country_code": country,
            "time_zone": "Asia/Jerusalem",
            "weekend_days": [4, 5] if country == "IL" else [5, 6],
            "personal_calendar": {
                "schema_version": 1,
                "date_overrides": rules,
                "unavailable_ranges": [
                    {"start_date": rule["start_date"], "end_date": rule["end_date"]}
                    for rule in rules
                ],
                "minimum_notice_days": 0,
            },
        },
    )
    request = {
        "months": [{"year": next_month.year, "month": next_month.month}],
        "preferred_length_days": 7,
        "result_limit": 5,
        "include_opportunities": True,
        "include_action_details": True,
    }
    post("/recommendations", request, session["token"])
    durations = []
    for _ in range(20):
        start = time.perf_counter()
        result = post("/recommendations", request, session["token"])
        durations.append(time.perf_counter() - start)
        assert result["opportunities"]["status"] == "complete"
        for recommendation in result["recommendations"]:
            assert recommendation["assessment"]["window"] == recommendation["window"]
            assert len(recommendation["alternative_assessments"]) == len(
                recommendation["alternative_windows"]
            )
    return {
        "country": country,
        "override_count": len(rules),
        "runs": len(durations),
        "evaluated_candidates": result["opportunities"]["evaluated_pair_count"],
        "median_seconds": round(statistics.median(durations), 4),
        "p95_seconds": round(
            sorted(durations)[math.ceil(len(durations) * 0.95) - 1], 4
        ),
        "max_seconds": round(max(durations), 4),
    }


if __name__ == "__main__":
    print(
        json.dumps(
            {
                "host": platform.platform(),
                "fixtures": [
                    measure("IL"),
                    measure("US"),
                    measure("GB"),
                    measure("IL", True),
                ],
            },
            indent=2,
        )
    )

import argparse
import json
import math
import platform
import statistics
import subprocess
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from threading import Barrier
from typing import Any


@dataclass(frozen=True)
class Fixture:
    name: str
    country: str
    session: dict[str, Any]
    request: dict[str, Any]
    expected_status: str
    warm_runs: int = 20


def post(
    base_url: str, path: str, payload: dict[str, Any], token: str = ""
) -> dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        base_url + path, data=json.dumps(payload).encode(), headers=headers
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        result: dict[str, Any] = json.load(response)
        return result


def fixtures() -> list[Fixture]:
    today = datetime.now(UTC).date()
    year = today.year + 1
    cases: list[Fixture] = []
    for country, zone in [
        ("IL", "Asia/Jerusalem"),
        ("US", "America/New_York"),
        ("GB", "Europe/London"),
    ]:
        session = {
            "balance_days": 18,
            "allowed_negative_days": 0,
            "country_code": country,
            "time_zone": zone,
            "weekend_days": [4, 5] if country == "IL" else [5, 6],
        }
        slots = [
            {"slot_id": "long", "min_days": 7, "max_days": 14},
            {"slot_id": "short-1", "min_days": 3, "max_days": 5},
            {"slot_id": "short-2", "min_days": 3, "max_days": 5},
        ]
        request = {
            "year": year,
            "reserve_days": 3,
            "minimum_gap_days": 7,
            "allowed_start_months": list(range(1, 13)),
            "slots": slots,
        }
        cases.append(Fixture("default", country, session, request, "complete"))
        dates = [
            (date(year, 1, 1) + timedelta(days=offset * 2)).isoformat()
            for offset in range(100)
        ]
        personal = {
            "schema_version": 1,
            "minimum_notice_days": 0,
            "date_overrides": [
                {
                    "start_date": (
                        date.fromisoformat(day) + timedelta(days=1)
                    ).isoformat(),
                    "end_date": (
                        date.fromisoformat(day) + timedelta(days=1)
                    ).isoformat(),
                    "kind": "extra_working_day" if index % 2 else "personal_day_off",
                }
                for index, day in enumerate(dates)
            ],
            "unavailable_ranges": [
                {"start_date": day, "end_date": day} for day in dates
            ],
        }
        cases.append(
            Fixture(
                "dense-rules",
                country,
                {**session, "personal_calendar": personal},
                request,
                "complete",
            )
        )
        locked_slots = [
            {
                **slots[0],
                "locked_dates": {
                    "start_date": f"{year}-08-06",
                    "end_date": f"{year}-08-14",
                },
            },
            *slots[1:],
        ]
        cases.append(
            Fixture(
                "locked-tight-reserve",
                country,
                {**session, "balance_days": 12},
                {**request, "slots": locked_slots},
                "complete",
            )
        )
        cases.append(
            Fixture(
                "current-year",
                country,
                session,
                {**request, "year": today.year},
                "complete",
            )
        )
        reduced_slots = [
            {"slot_id": f"break-{index}", "min_days": 3, "max_days": 3}
            for index in range(3)
        ]
        cases.append(
            Fixture(
                "reduction",
                country,
                {
                    **session,
                    "balance_days": 1,
                    "personal_calendar": {
                        "schema_version": 1,
                        "minimum_notice_days": 0,
                        "date_overrides": [],
                        "unavailable_ranges": [
                            {
                                "start_date": f"{year}-01-01",
                                "end_date": f"{year}-01-07",
                            },
                            {
                                "start_date": f"{year}-01-11",
                                "end_date": f"{year}-12-31",
                            },
                        ],
                    },
                },
                {
                    **request,
                    "reserve_days": 0,
                    "allowed_start_months": [1],
                    "slots": reduced_slots,
                },
                "infeasible",
            )
        )
        extreme_slots = [
            {"slot_id": f"break-{index}", "min_days": 3, "max_days": 28}
            for index in range(6)
        ]
        islands = [
            {
                "start_date": f"{year}-{month:02}-01",
                "end_date": f"{year}-{month:02}-07",
                "kind": "personal_day_off",
            }
            for month in range(1, 13)
        ]
        extreme_session = {
            **session,
            "balance_days": 366,
            "personal_calendar": {
                "schema_version": 1,
                "minimum_notice_days": 0,
                "unavailable_ranges": [],
                "date_overrides": islands,
            },
        }
        cases.append(
            Fixture(
                "six-broad-slots-zero-cost-islands",
                country,
                extreme_session,
                {**request, "slots": extreme_slots},
                "too_broad",
                0,
            )
        )
    return cases


def process_peak_memory() -> str:
    result = subprocess.run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "backend",
            "python",
            "-c",
            "from pathlib import Path; print(next(line for line in Path('/proc/1/status').read_text().splitlines() if line.startswith('VmHWM:')))",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def measure(base_url: str, fixture: Fixture) -> dict[str, Any]:
    session = post(base_url, "/sessions", fixture.session)
    durations: list[float] = []
    observations: list[dict[str, Any]] = []
    for _ in range(fixture.warm_runs + 1):
        start = time.perf_counter()
        result = post(base_url, "/annual-plans", fixture.request, session["token"])
        durations.append(time.perf_counter() - start)
        assert result["status"] == fixture.expected_status, (
            fixture.name,
            fixture.country,
            result["status"],
        )
        if fixture.name == "dense-rules":
            calendar = result["calculation_context"]["planning"]["personal_calendar"]
            assert len(calendar["date_overrides"]) == 100
            assert len(calendar["unavailable_ranges"]) == 100
        if result["status"] == "too_broad":
            assert result["plans"] == [] and result["full_mix_feasibility"] == "unknown"
        if fixture.name == "reduction":
            assert result["plans"] and len(result["plans"][0]["omitted_slot_ids"]) > 0
        observations.append(
            {
                key: result[key]
                for key in [
                    "status",
                    "full_mix_feasibility",
                    "counters",
                    "limit_reason",
                ]
            }
        )
    warm = durations[1:]
    return {
        "name": fixture.name,
        "country": fixture.country,
        "session_context": fixture.session,
        "input": fixture.request,
        "policy": result["policy"],
        "first_request_seconds": durations[0],
        "warm_seconds": warm,
        "warm_p95_seconds": sorted(warm)[math.ceil(len(warm) * 0.95) - 1]
        if warm
        else None,
        "warm_median_seconds": statistics.median(warm) if warm else None,
        "observations": observations,
        "backend_process_peak_memory": process_peak_memory(),
    }


def measure_concurrency(base_url: str, fixture: Fixture) -> list[dict[str, Any]]:
    session = post(base_url, "/sessions", fixture.session)
    barrier = Barrier(3)

    def submit(index: int) -> dict[str, Any]:
        barrier.wait(timeout=10)
        start = time.perf_counter()
        try:
            result = post(base_url, "/annual-plans", fixture.request, session["token"])
            return {
                "index": index,
                "http": 200,
                "status": result["status"],
                "plans": len(result["plans"]),
                "reason": result["limit_reason"],
                "counters": result["counters"],
                "seconds": time.perf_counter() - start,
            }
        except urllib.error.HTTPError as error:
            body = json.load(error)
            return {
                "index": index,
                "http": error.code,
                "code": body["error"]["code"],
                "seconds": time.perf_counter() - start,
            }

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(submit, range(3)))
    assert sorted(result["http"] for result in results) == [200, 200, 503]
    assert (
        next(result for result in results if result["http"] == 503)["code"]
        == "ANNUAL_PLANNER_BUSY"
    )
    assert all(
        result["status"] == "too_broad" and result["plans"] == 0
        for result in results
        if result["http"] == 200
    )
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:18080")
    parser.add_argument(
        "--output", type=Path, default=Path("docs/annual-evidence/performance.json")
    )
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--cold-restarts", action="store_true")
    parser.add_argument("--concurrency", action="store_true")
    arguments = parser.parse_args()
    if arguments.concurrency:
        fixture = next(
            item
            for item in fixtures()
            if item.country == "IL" and item.name == "six-broad-slots-zero-cost-islands"
        )
        results = measure_concurrency(arguments.base_url, fixture)
        arguments.output.write_text(json.dumps(results, indent=2) + "\n")
        return
    report: dict[str, Any] = {
        "host": platform.platform(),
        "measurement_python": platform.python_version(),
        "measured_on": datetime.now(UTC).date().isoformat(),
        "fixtures": [],
    }
    if arguments.resume and arguments.output.exists():
        report = json.loads(arguments.output.read_text())
    completed = {(item["country"], item["name"]) for item in report["fixtures"]}
    for fixture in fixtures():
        if (fixture.country, fixture.name) in completed:
            continue
        if arguments.cold_restarts:
            if fixture.name != "default":
                continue
            subprocess.run(
                ["docker", "compose", "restart", "backend"],
                check=True,
                capture_output=True,
            )
            for attempt in range(60):
                try:
                    with urllib.request.urlopen(
                        arguments.base_url + "/health", timeout=2
                    ):
                        break
                except OSError:
                    if attempt == 59:
                        raise
                    time.sleep(0.5)
            fixture = replace(fixture, warm_runs=0)
        measurement = measure(arguments.base_url, fixture)
        measurement["fresh_backend_process"] = arguments.cold_restarts
        report["fixtures"].append(measurement)
        arguments.output.write_text(json.dumps(report, indent=2) + "\n")
        print(
            f"{fixture.country} {fixture.name}: {measurement['warm_p95_seconds']} p95; {measurement['observations'][-1]}",
            flush=True,
        )


if __name__ == "__main__":
    main()

"""Release gate: decides GO / NO-GO from two pytest runs (JUnit XML files).

    python scripts/release_gate.py --clean clean.xml --bugged bugged.xml [--out results.json]

GO only if:
  1. the clean run has zero failures and zero errors, and
  2. in the bug-mode run, every planted bug in tests/bug_catalog.json is caught
     (at least one of its 'caught_by' tests failed).
Exit code 0 = GO, 1 = NO-GO. Also writes a JSON summary for the Test results page.
"""
import argparse
import json
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / "tests" / "bug_catalog.json").read_text(encoding="utf-8"))


def read_junit(path: str) -> dict:
    """Returns {"tests": [...], "time": seconds}; each test is {"id": "file::name", "outcome": ...}."""
    root = ET.parse(path).getroot()
    tests, total_time = [], 0.0
    for case in root.iter("testcase"):
        parts = case.get("classname", "").split(".")
        file = parts[-1]
        layer = parts[1] if len(parts) > 2 and parts[0] == "tests" else "other"
        test_id = f"{file}::{case.get('name')}"
        if case.find("failure") is not None or case.find("error") is not None:
            outcome = "failed"
        elif case.find("skipped") is not None:
            outcome = "skipped"
        else:
            outcome = "passed"
        tests.append({"id": test_id, "layer": layer, "outcome": outcome})
    for suite in root.iter("testsuite"):
        total_time += float(suite.get("time", 0))
    return {"tests": tests, "time": round(total_time, 1)}


def summarize(run: dict) -> dict:
    counts = {"passed": 0, "failed": 0, "skipped": 0}
    layers: dict[str, dict] = {}
    for t in run["tests"]:
        counts[t["outcome"]] += 1
        layer = layers.setdefault(t["layer"], {"passed": 0, "failed": 0, "skipped": 0, "total": 0})
        layer[t["outcome"]] += 1
        layer["total"] += 1
    return {**counts, "total": len(run["tests"]), "seconds": run["time"], "layers": layers}


def run_details() -> dict:
    """Where this result came from (filled in on GitHub Actions, empty locally)."""
    server, repo, run_id = os.getenv("GITHUB_SERVER_URL"), os.getenv("GITHUB_REPOSITORY"), os.getenv("GITHUB_RUN_ID")
    sha = os.getenv("GITHUB_SHA", "")
    return {
        "number": os.getenv("GITHUB_RUN_NUMBER"),
        "url": f"{server}/{repo}/actions/runs/{run_id}" if server and repo and run_id else None,
        "commit": sha[:7] or None,
        "commitUrl": f"{server}/{repo}/commit/{sha}" if server and repo and sha else None,
        "branch": os.getenv("GITHUB_REF_NAME"),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clean", required=True)
    ap.add_argument("--bugged", required=True)
    ap.add_argument("--out", default="results.json")
    args = ap.parse_args()

    clean, bugged = read_junit(args.clean), read_junit(args.bugged)
    clean_summary = summarize(clean)
    failed_in_bug_mode = [t["id"] for t in bugged["tests"] if t["outcome"] == "failed"]

    bugs = []
    for bug in CATALOG["bugs"]:
        catchers = [tid for tid in failed_in_bug_mode if any(tid.startswith(p) for p in bug["caught_by"])]
        bugs.append({**{k: bug[k] for k in ("id", "area", "layer", "summary")}, "caught": bool(catchers), "caught_by": catchers})

    clean_ok = clean_summary["failed"] == 0 and clean_summary["total"] > 0
    all_caught = all(b["caught"] for b in bugs)
    decision = "GO" if clean_ok and all_caught else "NO-GO"

    reasons = []
    if not clean_ok:
        reasons.append(f"clean build has {clean_summary['failed']} failing test(s)")
    reasons += [f"{b['id']} not caught: {b['summary']}" for b in bugs if not b["caught"]]

    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run": run_details(),
        "decision": decision,
        "reasons": reasons,
        "clean": clean_summary,
        "bugMode": {**summarize(bugged), "bugsCaught": sum(b["caught"] for b in bugs), "bugsPlanted": len(bugs)},
        "bugs": bugs,
    }
    Path(args.out).write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(f"\nRELEASE DECISION: {decision}")
    print(f"  clean run : {clean_summary['passed']}/{clean_summary['total']} passed")
    print(f"  bug mode  : {result['bugMode']['bugsCaught']}/{len(bugs)} planted bugs caught")
    for b in bugs:
        mark = "caught" if b["caught"] else "MISSED"
        print(f"   {b['id']} {mark:7} {b['summary']}  <- {', '.join(b['caught_by'][:2]) or '-'}")
    for r in reasons:
        print(f"  ! {r}")
    return 0 if decision == "GO" else 1


if __name__ == "__main__":
    sys.exit(main())

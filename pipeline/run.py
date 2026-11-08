"""Daily run: fetch every source, rebuild history, write status, update Issues.

    python -m pipeline.run [--no-issue]

A source that fails writes no raw file that day; the run still finishes.
Running twice on the same UTC day replaces that day's raw files and Issue.
"""
import argparse
import gzip
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from .build import HISTORY_PATH, RAW_DIR, ROOT, build_history, list_raw, write_history
from .sources import SOURCES, fetch

STATUS_PATH = ROOT / "data" / "status.json"
RUNS_DIR = ROOT / "data" / "runs"


def utc_now():
    return datetime.now(timezone.utc)


def fetch_all(day, now, raw_dir=RAW_DIR, sources=SOURCES, fetcher=fetch):
    """Fetch every source. Returns the per-source results (ok, count, error)."""
    day_dir = Path(raw_dir) / day
    if day_dir.exists():  # a second run on the same day replaces that day's files
        shutil.rmtree(day_dir)
    results = []
    for src in sources:
        try:
            postings = fetcher(src)
        except Exception as exc:  # one source failing must not stop the run
            print(f"FAIL {src['name']}: {exc}", file=sys.stderr)
            results.append({"name": src["name"], "ok": False, "count": 0,
                            "error": str(exc)[:200]})
            continue
        day_dir.mkdir(parents=True, exist_ok=True)
        payload = {"source": src["name"], "fetched_at": now.isoformat(), "postings": postings}
        with gzip.open(day_dir / f"{src['name']}.json.gz", "wt", encoding="utf-8",
                       compresslevel=9) as fh:
            json.dump(payload, fh, separators=(",", ":"))
        print(f"ok   {src['name']}: {len(postings)}")
        results.append({"name": src["name"], "ok": True, "count": len(postings)})
    return results


def make_status(rows, results, day, now, raw_dir=RAW_DIR):
    days = sorted(list_raw(raw_dir))
    return {
        "run_time": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "first_run_date": days[0] if days else day,
        "days_with_success": len(days),
        "open": sum(1 for r in rows if r["status"] == "open"),
        "new_today": sum(1 for r in rows if r["first_seen"] == day and not r["first_run"]),
        "removed_today": sum(1 for r in rows if r["removed_date"] == day),
        "sources": [{"name": r["name"], "ok": r["ok"], "count": r["count"]} for r in results],
    }


def changes_for(rows, day):
    new = [r for r in rows if r["first_seen"] == day and not r["first_run"]]
    removed = [r for r in rows if r["removed_date"] == day]
    return new, removed


# ---------------------------------------------------------------- Issues
def issue_body(day, new, removed, results):
    def lines(rs):
        if not rs:
            return ["_None_"]
        return [f"- [{r['title']}]({r['url']}) — {r['employer']}"
                f"{' · ' + r['location'] if r['location'] else ''}" for r in rs]

    failed = [r["name"] for r in results if not r["ok"]]
    out = [f"## New postings ({len(new)})", *lines(new), "",
           f"## Removed postings ({len(removed)})", *lines(removed), ""]
    if failed:
        out.append(f"Sources that failed today: {', '.join(failed)}")
    else:
        out.append("All sources succeeded today.")
    return "\n".join(out)


def gh(*args, check=True):
    return subprocess.run(["gh", *args], capture_output=True, text=True, check=check)


def update_issues(day, body):
    """Open (or update) today's Issue and close every other open dated Issue."""
    listing = json.loads(gh("issue", "list", "--state", "all", "--limit", "100",
                            "--json", "number,title,state").stdout or "[]")
    today = next((i for i in listing if i["title"] == day), None)
    if today is None:
        gh("issue", "create", "--title", day, "--body", body)
    else:
        gh("issue", "edit", str(today["number"]), "--body", body)
        if today["state"] == "CLOSED":
            gh("issue", "reopen", str(today["number"]))
    for issue in listing:
        title = issue["title"]
        if issue["state"] == "OPEN" and title != day and len(title) == 10 and title[4] == "-":
            gh("issue", "close", str(issue["number"]))


# ---------------------------------------------------------------- main
def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-issue", action="store_true", help="skip GitHub Issue step")
    args = parser.parse_args(argv)

    now = utc_now()
    day = now.date().isoformat()

    results = fetch_all(day, now)
    rows = build_history()
    write_history(rows)

    status = make_status(rows, results, day, now)
    STATUS_PATH.write_text(json.dumps(status, indent=2) + "\n")
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / f"{day}.json").write_text(json.dumps(
        {"run_time": status["run_time"], "sources": results}, indent=2) + "\n")

    new, removed = changes_for(rows, day)
    print(f"new={len(new)} removed={len(removed)} open={status['open']}")
    if not args.no_issue:
        update_issues(day, issue_body(day, new, removed, results))
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Build data/history.csv from the raw files alone.

    python -m pipeline.build

The result depends only on data/raw/<date>/<source>.json.gz, so running it again
produces the same file, and a change to a rule applies to every day of history.
"""
import csv
import gzip
import json
import sys
from pathlib import Path

from .sources import SOURCES, as_of_date, convert, source_by_name
from .title_rule import is_in_role

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
HISTORY_PATH = ROOT / "data" / "history.csv"

COLUMNS = [
    "posting_id", "source", "source_id", "employer", "title", "location", "department",
    "posted_date", "url", "in_role", "first_run", "first_seen", "last_seen", "status",
    "removed_date",
]


def list_raw(raw_dir=RAW_DIR):
    """Return {date_string: {source_name: path}} for every raw file."""
    found = {}
    raw_dir = Path(raw_dir)
    if not raw_dir.exists():
        return found
    for day_dir in sorted(p for p in raw_dir.iterdir() if p.is_dir()):
        for f in sorted(day_dir.glob("*.json.gz")):
            found.setdefault(day_dir.name, {})[f.name[: -len(".json.gz")]] = f
    return found


def read_raw(path):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def apply_day(history, first_run_sources, day, src, postings):
    """Apply one source's raw postings for `day` to the history dict (in place).

    - new posting: first_seen = day (first_run if this is the source's first raw file)
    - listed posting: last_seen = day; a removed posting becomes open again
    - open posting no longer listed: removed with removed_date = day
    """
    is_first_file = src["name"] not in first_run_sources
    first_run_sources.add(src["name"])
    as_of = as_of_date(day)

    listed = set()
    for raw in postings:
        row = convert(src, raw, as_of)
        pid = row["posting_id"]
        listed.add(pid)
        existing = history.get(pid)
        if existing is None:
            history[pid] = {
                **row,
                "in_role": is_in_role(row["title"]),
                "first_run": is_first_file,
                "first_seen": day,
                "last_seen": day,
                "status": "open",
                "removed_date": "",
            }
        else:
            # refresh descriptive fields; keep tracking fields
            for key in ("title", "location", "department", "url"):
                existing[key] = row[key]
            if row["posted_date"]:
                existing["posted_date"] = row["posted_date"]
            existing["in_role"] = is_in_role(row["title"])
            existing["last_seen"] = day
            existing["status"] = "open"
            existing["removed_date"] = ""

    for pid, rec in history.items():
        if rec["source"] == src["name"] and rec["status"] == "open" and pid not in listed:
            rec["status"] = "removed"
            rec["removed_date"] = day


def build_history(raw_dir=RAW_DIR, sources=None):
    """Return the history as a list of row dicts sorted by posting_id."""
    by_day = list_raw(raw_dir)
    history, first_run_sources = {}, set()
    for day in sorted(by_day):
        for name, path in sorted(by_day[day].items()):
            try:
                src = source_by_name(name) if sources is None else next(
                    s for s in sources if s["name"] == name)
            except (KeyError, StopIteration):
                continue  # raw file for a source no longer watched
            apply_day(history, first_run_sources, day, src, read_raw(path)["postings"])
    return [history[k] for k in sorted(history)]


def write_history(rows, path=HISTORY_PATH):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            out = {c: row.get(c, "") for c in COLUMNS}
            for flag in ("in_role", "first_run"):
                out[flag] = "true" if row[flag] else "false"
            writer.writerow(out)


def main():
    rows = build_history()
    write_history(rows)
    print(f"wrote {len(rows)} rows to {HISTORY_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())

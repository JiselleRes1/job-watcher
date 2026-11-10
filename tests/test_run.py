import gzip
import json
from datetime import datetime, timezone

from pipeline import run

SRCS = [{"name": "clorox", "employer": "Clorox", "ats": "workday", "host": "h",
         "tenant": "t", "site": "S"},
        {"name": "sofi", "employer": "SoFi", "ats": "greenhouse", "board": "sofi"}]
NOW = datetime(2026, 11, 8, 12, 0, tzinfo=timezone.utc)


def test_one_failing_source_does_not_stop_the_run(tmp_path):
    def fetcher(src):
        if src["name"] == "sofi":
            raise RuntimeError("blocked")
        return [{"title": "Financial Analyst", "externalPath": "/p", "bulletFields": ["R1"]}]

    results = run.fetch_all("2026-11-08", NOW, tmp_path, SRCS, fetcher)
    assert [(r["name"], r["ok"], r["count"]) for r in results] == [
        ("clorox", True, 1), ("sofi", False, 0)]
    assert (tmp_path / "2026-11-08" / "clorox.json.gz").exists()
    assert not (tmp_path / "2026-11-08" / "sofi.json.gz").exists()


def test_second_run_same_day_replaces_raw_files(tmp_path):
    run.fetch_all("2026-11-08", NOW, tmp_path, SRCS, lambda s: [{"externalPath": "/a"}])
    run.fetch_all("2026-11-08", NOW, tmp_path, SRCS[:1], lambda s: [{"externalPath": "/b"}] * 2)
    assert not (tmp_path / "2026-11-08" / "sofi.json.gz").exists()
    with gzip.open(tmp_path / "2026-11-08" / "clorox.json.gz", "rt") as fh:
        assert len(json.load(fh)["postings"]) == 2


def test_status_counts_exclude_first_run_postings(tmp_path):
    (tmp_path / "2026-11-07").mkdir()
    (tmp_path / "2026-11-07" / "clorox.json.gz").write_bytes(b"")
    (tmp_path / "2026-11-08").mkdir()
    (tmp_path / "2026-11-08" / "clorox.json.gz").write_bytes(b"")
    rows = [
        {"status": "open", "first_seen": "2026-11-07", "first_run": True, "removed_date": ""},
        {"status": "open", "first_seen": "2026-11-08", "first_run": False, "removed_date": ""},
        {"status": "open", "first_seen": "2026-11-08", "first_run": True, "removed_date": ""},
        {"status": "removed", "first_seen": "2026-11-07", "first_run": True,
         "removed_date": "2026-11-08"},
    ]
    results = [{"name": "clorox", "ok": True, "count": 3}, {"name": "sofi", "ok": False, "count": 0}]
    st = run.make_status(rows, results, "2026-11-08", NOW, tmp_path)
    assert st["days_with_success"] == 2 and st["first_run_date"] == "2026-11-07"
    assert (st["open"], st["new_today"], st["removed_today"]) == (3, 1, 1)
    assert st["run_time"] == "2026-11-08T12:00:00Z"
    assert st["sources"] == results


def test_issue_body_lists_links_and_handles_empty_day():
    new = [{"title": "Financial Analyst", "url": "https://x/1", "employer": "Clorox",
            "location": "Dallas"}]
    body = run.issue_body("2026-11-08", new, [], [{"name": "sofi", "ok": False, "count": 0}])
    assert "[Financial Analyst](https://x/1)" in body
    assert "_None_" in body and "sofi" in body
    empty = run.issue_body("2026-11-08", [], [], [])
    assert empty.count("_None_") == 2


def test_issue_body_is_capped_and_lists_my_role_first():
    rows = [{"title": f"Machine Operator {i}", "url": f"https://x/{i}", "employer": "Tyson",
             "location": "AR", "in_role": False} for i in range(5000)]
    rows.append({"title": "Financial Analyst", "url": "https://x/fa", "employer": "Clorox",
                 "location": "", "in_role": True})
    body = run.issue_body("2026-11-09", rows, rows, [])
    assert len(body) < 65536
    assert "…and" in body and "(5001)" in body
    assert body.index("Financial Analyst") < body.index("Machine Operator 0")

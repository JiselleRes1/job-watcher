import gzip
import json

from pipeline import build

SRC = {"name": "clorox", "employer": "Clorox", "ats": "workday",
       "host": "h.example.com", "tenant": "t", "site": "S"}


def job(req, title="Financial Analyst"):
    return {"title": title, "externalPath": f"/job/x_{req}", "bulletFields": [req],
            "locationsText": "Dallas, TX"}


def write_raw(raw_dir, day, source, postings):
    d = raw_dir / day
    d.mkdir(parents=True, exist_ok=True)
    with gzip.open(d / f"{source}.json.gz", "wt") as fh:
        json.dump({"source": source, "postings": postings}, fh)


def rows_by_id(raw_dir):
    return {r["source_id"]: r for r in build.build_history(raw_dir)}


def test_first_seen_last_seen_and_first_run(tmp_path):
    write_raw(tmp_path, "2026-11-01", "clorox", [job("A")])
    write_raw(tmp_path, "2026-11-02", "clorox", [job("A"), job("B")])
    write_raw(tmp_path, "2026-11-03", "clorox", [job("A"), job("B")])
    r = rows_by_id(tmp_path)
    assert (r["A"]["first_seen"], r["A"]["last_seen"], r["A"]["first_run"]) == (
        "2026-11-01", "2026-11-03", True)
    assert (r["B"]["first_seen"], r["B"]["last_seen"], r["B"]["first_run"]) == (
        "2026-11-02", "2026-11-03", False)
    assert r["A"]["status"] == "open" and r["A"]["removed_date"] == ""


def test_removed_when_source_has_file_and_no_longer_lists_it(tmp_path):
    write_raw(tmp_path, "2026-11-01", "clorox", [job("A"), job("B")])
    write_raw(tmp_path, "2026-11-02", "clorox", [job("A")])
    r = rows_by_id(tmp_path)
    assert r["B"]["status"] == "removed"
    assert r["B"]["removed_date"] == "2026-11-02"
    assert r["B"]["last_seen"] == "2026-11-01"
    assert r["A"]["status"] == "open"


def test_failed_source_day_does_not_remove_anything(tmp_path):
    # no clorox raw file on 11-02 (the source failed that day)
    write_raw(tmp_path, "2026-11-01", "clorox", [job("A")])
    write_raw(tmp_path, "2026-11-02", "sofi", [])
    write_raw(tmp_path, "2026-11-03", "clorox", [job("A")])
    r = rows_by_id(tmp_path)
    assert r["A"]["status"] == "open" and r["A"]["removed_date"] == ""
    assert r["A"]["last_seen"] == "2026-11-03"


def test_removed_posting_listed_again_reopens(tmp_path):
    write_raw(tmp_path, "2026-11-01", "clorox", [job("A")])
    write_raw(tmp_path, "2026-11-02", "clorox", [job("B")])
    write_raw(tmp_path, "2026-11-03", "clorox", [job("A"), job("B")])
    a = rows_by_id(tmp_path)["A"]
    assert a["status"] == "open" and a["removed_date"] == ""
    assert a["first_seen"] == "2026-11-01" and a["last_seen"] == "2026-11-03"


def test_first_run_is_per_source(tmp_path):
    write_raw(tmp_path, "2026-11-01", "clorox", [job("A")])
    write_raw(tmp_path, "2026-11-05", "conagra", [job("C")])  # conagra starts later
    r = rows_by_id(tmp_path)
    assert r["A"]["first_run"] is True
    assert r["C"]["first_run"] is True  # first file of *its* source


def test_all_postings_kept_and_in_role_flagged(tmp_path):
    write_raw(tmp_path, "2026-11-01", "clorox", [job("A"), job("B", "Plant Operator")])
    r = rows_by_id(tmp_path)
    assert len(r) == 2
    assert r["A"]["in_role"] is True and r["B"]["in_role"] is False


def test_rows_sorted_by_posting_id_and_rebuild_is_identical(tmp_path):
    write_raw(tmp_path, "2026-11-01", "clorox", [job("Z"), job("M")])
    write_raw(tmp_path, "2026-11-02", "clorox", [job("M"), job("Q")])
    rows = build.build_history(tmp_path)
    ids = [r["posting_id"] for r in rows]
    assert ids == sorted(ids)
    build.write_history(rows, tmp_path / "a.csv")
    build.write_history(build.build_history(tmp_path), tmp_path / "b.csv")
    assert (tmp_path / "a.csv").read_bytes() == (tmp_path / "b.csv").read_bytes()


def test_csv_has_required_columns_in_order(tmp_path):
    write_raw(tmp_path, "2026-11-01", "clorox", [job("A")])
    build.write_history(build.build_history(tmp_path), tmp_path / "h.csv")
    header = (tmp_path / "h.csv").read_text().splitlines()[0]
    assert header == ("posting_id,source,source_id,employer,title,location,department,"
                      "posted_date,url,in_role,first_run,first_seen,last_seen,status,removed_date")
    assert "true" in (tmp_path / "h.csv").read_text()

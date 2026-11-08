import pytest

from pipeline.sources import SOURCES, convert, source_by_name
from datetime import date

DAY = date(2026, 11, 8)


def test_workday_conversion():
    src = source_by_name("tyson")
    raw = {"title": "Financial Analyst", "externalPath": "/job/Springdale-AR/Financial-Analyst_R123",
           "locationsText": "Springdale, AR", "postedOn": "Posted 3 Days Ago",
           "bulletFields": ["R123"]}
    row = convert(src, raw, DAY)
    assert row["posting_id"] == "tyson:R123"
    assert row["source"] == "tyson" and row["employer"] == "Tyson Foods"
    assert row["title"] == "Financial Analyst"
    assert row["location"] == "Springdale, AR"
    assert row["department"] == ""
    assert row["posted_date"] == "2026-11-05"
    assert row["url"] == ("https://tysonfoods.wd5.myworkdayjobs.com/en-US/TSN"
                          "/job/Springdale-AR/Financial-Analyst_R123")


@pytest.mark.parametrize("text,expected", [
    ("Posted Today", "2026-11-08"), ("Posted Yesterday", "2026-11-07"),
    ("Posted 30+ Days Ago", ""), (None, "")])
def test_workday_posted_date(text, expected):
    raw = {"title": "x", "externalPath": "/job/x_R1", "bulletFields": ["R1"], "postedOn": text}
    assert convert(source_by_name("clorox"), raw, DAY)["posted_date"] == expected


def test_workday_falls_back_to_path_when_no_requisition_id():
    raw = {"title": "x", "externalPath": "/job/a/b_R9"}
    assert convert(source_by_name("clorox"), raw, DAY)["source_id"] == "/job/a/b_R9"


def test_oracle_conversion():
    raw = {"Id": "25010443", "Title": "Finance Analyst", "PostedDate": "2026-11-07",
           "PrimaryLocation": "Dallas, TX, United States", "JobFamily": "Finance"}
    row = convert(source_by_name("ti"), raw, DAY)
    assert row["posting_id"] == "ti:25010443"
    assert row["employer"] == "Texas Instruments"
    assert row["location"] == "Dallas, TX, United States"
    assert row["department"] == "Finance"
    assert row["posted_date"] == "2026-11-07"
    assert row["url"] == "https://careers.ti.com/en/sites/CX/job/25010443"


def test_greenhouse_conversion():
    raw = {"id": 7607567003, "title": "Analyst II, Credit", "location": {"name": "Remote US"},
           "departments": [{"name": "Credit"}], "first_published": "2026-02-02T10:00:00-05:00",
           "absolute_url": "https://job-boards.greenhouse.io/affirm/jobs/7607567003"}
    row = convert(source_by_name("affirm"), raw, DAY)
    assert row["posting_id"] == "affirm:7607567003"
    assert row["source_id"] == "7607567003"
    assert row["department"] == "Credit"
    assert row["posted_date"] == "2026-02-02"
    assert row["url"].endswith("/jobs/7607567003")


def test_greenhouse_missing_optional_fields_are_empty():
    row = convert(source_by_name("sofi"), {"id": 1, "title": "t"}, DAY)
    assert row["location"] == "" and row["department"] == "" and row["posted_date"] == ""


def test_every_source_is_configured_for_a_known_ats():
    assert len(SOURCES) >= 15
    assert len({s["name"] for s in SOURCES}) == len(SOURCES)
    for s in SOURCES:
        assert s["ats"] in {"workday", "oracle", "greenhouse"}

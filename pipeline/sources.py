"""Source definitions, fetchers and converters to the common columns.

Each applicant tracking system (ATS) has:
  * a fetcher   -> returns the list of raw posting dicts exactly as the board gave them
  * a converter -> turns one raw posting into the common columns (see COLUMNS_FROM_SOURCE)
"""
import re
import time
from datetime import date, timedelta

import requests

TIMEOUT = 30
HEADERS = {"User-Agent": "job-watcher/1.0 (student project; daily job board reader)"}

# Columns every converter must produce (history.csv adds the tracking columns on top).
COLUMNS_FROM_SOURCE = [
    "source_id", "title", "location", "department", "posted_date", "url",
]


# --------------------------------------------------------------------------
# Source list
# --------------------------------------------------------------------------
SOURCES = [
    # Northwest Arkansas
    {"name": "tyson", "employer": "Tyson Foods", "ats": "workday",
     "host": "tysonfoods.wd5.myworkdayjobs.com", "tenant": "tysonfoods", "site": "TSN"},
    {"name": "walmart", "employer": "Walmart", "ats": "workday",
     "host": "walmart.wd504.myworkdayjobs.com", "tenant": "walmart", "site": "WalmartExternal",
     "search": "financial analyst"},  # board is capped at 2,000 without a term
    {"name": "jbhunt", "employer": "J.B. Hunt", "ats": "workday",
     "host": "jbhunt.wd501.myworkdayjobs.com", "tenant": "jbhunt", "site": "Careers"},
    # Dallas area
    {"name": "mckesson", "employer": "McKesson", "ats": "workday",
     "host": "mckesson.wd3.myworkdayjobs.com", "tenant": "mckesson", "site": "External_Careers"},
    {"name": "toyota", "employer": "Toyota Motor North America", "ats": "workday",
     "host": "toyota.wd503.myworkdayjobs.com", "tenant": "toyota", "site": "tmna"},
    {"name": "kimberlyclark", "employer": "Kimberly-Clark", "ats": "workday",
     "host": "kimberlyclark.wd1.myworkdayjobs.com", "tenant": "kimberlyclark", "site": "GLOBAL"},
    {"name": "ti", "employer": "Texas Instruments", "ats": "oracle",
     "host": "edbz.fa.us2.oraclecloud.com", "site": "CX", "public_host": "careers.ti.com"},
    {"name": "rtx", "employer": "Raytheon (RTX)", "ats": "workday",
     "host": "globalhr.wd5.myworkdayjobs.com", "tenant": "globalhr", "site": "REC_RTX_Ext_Gateway"},
    # Consumer goods
    {"name": "conagra", "employer": "Conagra Brands", "ats": "workday",
     "host": "conagrabrands.wd1.myworkdayjobs.com", "tenant": "conagrabrands", "site": "Careers_US"},
    {"name": "clorox", "employer": "Clorox", "ats": "workday",
     "host": "clorox.wd1.myworkdayjobs.com", "tenant": "clorox", "site": "Clorox"},
    {"name": "mondelez", "employer": "Mondelez International", "ats": "workday",
     "host": "mdlz.wd3.myworkdayjobs.com", "tenant": "mdlz", "site": "External"},
    # Real estate
    {"name": "colliers", "employer": "Colliers", "ats": "workday",
     "host": "colliers.wd3.myworkdayjobs.com", "tenant": "colliers",
     "site": "Colliers-External-Career-Site"},
    # Finance / fintech (Greenhouse)
    {"name": "affirm", "employer": "Affirm", "ats": "greenhouse", "board": "affirm"},
    {"name": "sofi", "employer": "SoFi", "ats": "greenhouse", "board": "sofi"},
    {"name": "block", "employer": "Block", "ats": "greenhouse", "board": "block"},
]


def source_by_name(name):
    for s in SOURCES:
        if s["name"] == name:
            return s
    raise KeyError(name)


# --------------------------------------------------------------------------
# HTTP helper
# --------------------------------------------------------------------------
def _request(method, url, retries=3, **kwargs):
    last = None
    for attempt in range(retries):
        try:
            resp = requests.request(method, url, headers=HEADERS, timeout=TIMEOUT, **kwargs)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            last = exc
            time.sleep(2 * (attempt + 1))
    raise last


# --------------------------------------------------------------------------
# Fetchers
# --------------------------------------------------------------------------
WORKDAY_PAGE = 20  # Workday's page size limit


def fetch_workday(src):
    url = f"https://{src['host']}/wday/cxs/{src['tenant']}/{src['site']}/jobs"
    body = {"limit": WORKDAY_PAGE, "offset": 0, "searchText": src.get("search", "")}
    first = _request("POST", url, json=body)
    total = first.get("total", 0)  # Workday only reports the total on the first page
    postings = list(first.get("jobPostings", []))
    offset = WORKDAY_PAGE
    while offset < total:
        body["offset"] = offset
        page = _request("POST", url, json=body).get("jobPostings", [])
        if not page:
            break
        postings.extend(page)
        offset += WORKDAY_PAGE
    if total and len(postings) < total * 0.9:
        raise RuntimeError(f"incomplete fetch: {len(postings)} of {total}")
    return postings


ORACLE_PAGE = 100


def fetch_oracle(src):
    base = f"https://{src['host']}/hcmRestApi/resources/latest/recruitingCEJobRequisitions"
    postings, offset, total = [], 0, None
    while total is None or offset < total:
        finder = (f"findReqs;siteNumber={src['site']},limit={ORACLE_PAGE},"
                  f"offset={offset},sortBy=POSTING_DATES_DESC")
        data = _request("GET", base, params={
            "onlyData": "true", "expand": "requisitionList", "finder": finder})
        item = (data.get("items") or [{}])[0]
        total = item.get("TotalJobsCount", 0)
        page = item.get("requisitionList", [])
        if not page:
            break
        postings.extend(page)
        offset += ORACLE_PAGE
    if total and len(postings) < total * 0.9:
        raise RuntimeError(f"incomplete fetch: {len(postings)} of {total}")
    return postings


def fetch_greenhouse(src):
    url = f"https://boards-api.greenhouse.io/v1/boards/{src['board']}/jobs"
    jobs = _request("GET", url, params={"content": "true"}).get("jobs", [])
    for job in jobs:  # content=true is only needed for departments; drop the big HTML
        job.pop("content", None)
    return jobs


FETCHERS = {"workday": fetch_workday, "oracle": fetch_oracle, "greenhouse": fetch_greenhouse}


def fetch(src):
    """Return the list of raw postings for a source. Raises on any failure."""
    postings = FETCHERS[src["ats"]](src)
    if not postings:
        raise RuntimeError("board returned no postings")
    return postings


# --------------------------------------------------------------------------
# Converters (raw posting -> common columns)
# --------------------------------------------------------------------------
def _posted_from_workday(text, as_of):
    """'Posted Today' / 'Posted 3 Days Ago' -> a date; imprecise values ('30+') -> ''."""
    if not text or as_of is None:
        return ""
    t = text.lower()
    if "today" in t:
        return as_of.isoformat()
    if "yesterday" in t:
        return (as_of - timedelta(days=1)).isoformat()
    m = re.search(r"posted (\d+) days? ago", t)
    if m:
        return (as_of - timedelta(days=int(m.group(1)))).isoformat()
    return ""


def convert_workday(src, raw, as_of=None):
    path = raw.get("externalPath", "")
    bullets = raw.get("bulletFields") or []
    source_id = bullets[0] if bullets else path
    return {
        "source_id": source_id,
        "title": raw.get("title", ""),
        "location": raw.get("locationsText", "") or "",
        "department": "",
        "posted_date": _posted_from_workday(raw.get("postedOn"), as_of),
        "url": f"https://{src['host']}/en-US/{src['site']}{path}",
    }


def convert_oracle(src, raw, as_of=None):
    rid = str(raw.get("Id", ""))
    host = src.get("public_host", src["host"])
    return {
        "source_id": rid,
        "title": raw.get("Title", ""),
        "location": raw.get("PrimaryLocation", "") or "",
        "department": raw.get("JobFamily") or raw.get("Organization") or "",
        "posted_date": (raw.get("PostedDate") or "")[:10],
        "url": f"https://{host}/en/sites/{src['site']}/job/{rid}",
    }


def convert_greenhouse(src, raw, as_of=None):
    depts = raw.get("departments") or []
    return {
        "source_id": str(raw.get("id", "")),
        "title": raw.get("title", ""),
        "location": (raw.get("location") or {}).get("name", "") or "",
        "department": depts[0].get("name", "") if depts else "",
        "posted_date": (raw.get("first_published") or "")[:10],
        "url": raw.get("absolute_url", ""),
    }


CONVERTERS = {"workday": convert_workday, "oracle": convert_oracle,
              "greenhouse": convert_greenhouse}


def convert(src, raw, as_of=None):
    """Convert one raw posting to the common columns for source `src`."""
    row = CONVERTERS[src["ats"]](src, raw, as_of)
    row["source"] = src["name"]
    row["employer"] = src["employer"]
    row["posting_id"] = f"{src['name']}:{row['source_id']}"
    return row


def as_of_date(value):
    return value if isinstance(value, date) else date.fromisoformat(value)

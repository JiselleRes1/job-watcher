# Job Watcher

[![tests](https://github.com/JiselleRes1/job-watcher/actions/workflows/tests.yml/badge.svg)](https://github.com/JiselleRes1/job-watcher/actions/workflows/tests.yml)

A tool that watches the job market for me. Once a day, GitHub Actions reads the open
postings at 15 employers, compares them with the day before, records what is new and what
is gone, opens a GitHub Issue with the changes, and publishes the result to a website
(GitHub Pages).

**Role watched:** financial analyst and close equivalents (FP&A, cost, pricing, treasury,
credit and accounting analysts). **Employers:** consumer-goods, logistics and technology
companies headquartered in or with offices in Northwest Arkansas or the Dallas area, plus a
few fintech and real-estate firms.

Live site: https://jiselleres1.github.io/job-watcher/

## How it works

1. `pipeline/run.py` calls every source and saves the raw response, compressed, to
   `data/raw/<date>/<source>.json.gz`. A source that fails writes no file that day; the run
   continues, and every source's result (ok or failed, and its count) is recorded in
   `data/status.json` and `data/runs/<date>.json`.
2. `pipeline/build.py` rebuilds `data/history.csv` **from the raw files alone**, day by day,
   so running it again gives the same file and a rule change applies to every day of history.
3. `data/status.json` describes the latest run.
4. An Issue titled with the date lists new and removed postings (each with a link) and the
   previous day's Issue is closed. The Issue is opened every day, even with no changes.
5. The workflow commits `data/` to the repository.

A second run on the same UTC day replaces that day's raw files, rebuilds the history and
updates that day's Issue, so each day counts once.

### Rebuild the history from the raw files

```bash
python -m pipeline.build
```

### Run the tests / a full run locally

```bash
pip install -r requirements.txt
python -m pytest -q
python -m pipeline.run --no-issue      # skips the GitHub Issue step
```

## Files

| Path | What it does |
|---|---|
| `pipeline/sources.py` | The 15 sources; one fetcher and one converter per applicant tracking system (Workday, Oracle, Greenhouse) |
| `pipeline/title_rule.py` | The title rule that marks a posting `in_role` |
| `pipeline/build.py` | Builds `data/history.csv` from `data/raw/` (first-seen, last-seen, removed, reopened logic) |
| `pipeline/run.py` | The daily run: fetch, build, status file, Issues |
| `tests/` | pytest suite: source conversion, title rule, history logic, run behaviour |
| `.github/workflows/daily.yml` | Runs the pipeline every day at 11:17 UTC and commits the data |
| `.github/workflows/tests.yml` | Runs the tests on every push |
| `data/raw/<date>/<source>.json.gz` | What each source returned that day |
| `data/history.csv` | One row per posting ever seen |
| `data/status.json` | Latest run: time, counts, per-source result |
| `data/runs/<date>.json` | Per-source result (ok / error) for each day |
| `index.html`, `today.js` | Today page |
| `browse.html`, `browse.js` | Browse page (filters, search, sort, apply links, starred shortlist) |
| `market.html`, `market.js`, `charts.js` | Market page: six findings computed in the browser from `history.csv` |
| `app.js`, `style.css` | Shared navigation, data loading, fonts and colors |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | Makes the site installable and usable offline |
| `requirements.txt` | Python dependencies (`requests`, `pytest`) |

## Sources

All 15 return JSON to a request with no login. No HTML is read.

| Source | Employer | Applicant tracking system | Notes |
|---|---|---|---|
| tyson | Tyson Foods | Workday | |
| walmart | Walmart | Workday | **Requested with the search term `financial analyst`** — the unfiltered board is capped at 2,000 results |
| jbhunt | J.B. Hunt | Workday | |
| mckesson | McKesson | Workday | |
| toyota | Toyota Motor North America | Workday | |
| kimberlyclark | Kimberly-Clark | Workday | |
| ti | Texas Instruments | Oracle Recruiting Cloud | |
| rtx | Raytheon (RTX) | Workday | **Requested with the search term `analyst`** — the full board is about 4,600 postings and growing, so it is kept under the 5,000 limit |
| conagra | Conagra Brands | Workday | |
| clorox | Clorox | Workday | |
| mondelez | Mondelez International | Workday | |
| colliers | Colliers | Workday | |
| affirm | Affirm | Greenhouse | |
| sofi | SoFi | Greenhouse | |
| block | Block | Greenhouse | |

Every posting the board returns is kept, not only the ones in my role.

## Title rule

A posting is **in my role** (`in_role = true`) when its title:

1. contains a finance word — *financ\**, *FP&A*, *cost*, *pricing*, *revenue*, *treasury*,
   *credit*, *investment*, *budget\**, *controll\**, *accounting*, *valuation*,
   *underwriting* — together with the word *analyst* (in either order, within 40
   characters), or is an *FP&A* title; and
2. does **not** contain *director*, *vice president*, *VP*, *head of*, *chief*, *intern*,
   *co-op*, *advisor/adviser*, *attorney* or *counsel*.

So "Senior Financial Analyst", "Analyst, Finance" and "Treasury Analyst" are in role;
"Demand Planning Analyst", "Data Analyst" and "Director, Financial Analysis" are not.

## Data files

`data/history.csv` — one row per posting, sorted by `posting_id`: `posting_id`, `source`,
`source_id`, `employer`, `title`, `location`, `department`, `posted_date`, `url`, `in_role`,
`first_run`, `first_seen`, `last_seen`, `status`, `removed_date`. Dates are UTC
(`YYYY-MM-DD`). Columns a source does not provide (for example `department` for Workday)
are empty. `posted_date` for Workday comes from "Posted N Days Ago" and is left empty when
the board only says "30+ days".

`first_run` is true for a posting listed in the first raw file of its source: its real start
date is unknown, so the Market page leaves those out where the definitions say so.

`data/status.json` — `run_time`, `first_run_date`, `days_with_success`, `open`, `new_today`,
`removed_today`, and `sources` (`name`, `ok`, `count`).

## Site

Three pages share one navigation bar, fonts and colors, and load the two data files in the
browser. The site is installable (web app manifest + service worker). Online, the pages load
the data from the network; offline, they show the last data loaded. The shortlist (stars) is
saved in the browser's `localStorage`.

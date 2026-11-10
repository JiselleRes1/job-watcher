(async () => {
  const { esc } = JW;
  let rows;
  try { rows = await JW.loadHistory(); } catch (e) { document.getElementById("asof").textContent = "No data yet — the first daily run has not completed."; return; }
  if (!rows.length) { document.getElementById("asof").textContent = "The history file is empty."; return; }

  // Every number below is computed here from data/history.csv.
  const dates = rows.flatMap(r => [r.first_seen, r.last_seen, r.removed_date]).filter(Boolean);
  const last = dates.reduce((a, b) => (a > b ? a : b));
  const first = dates.reduce((a, b) => (a < b ? a : b));
  document.getElementById("asof").textContent = `Based on ${rows.length.toLocaleString()} postings in the history file, watched from ${first} to ${last}.`;

  const days = []; for (let d = first; d <= last; d = JW.addDays(d, 1)) days.push(d);
  const countBy = (list, key) => { const m = {}; list.forEach(r => m[r[key]] = (m[r[key]] || 0) + 1); return m; };
  const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const sum = a => a.reduce((x, y) => x + y, 0);

  const sections = [];
  const add = (heading, para, draw) => sections.push({ heading, para, draw });

  // 1. New postings per day (first-run postings left out)
  const fresh = rows.filter(r => !r.first_run);
  const newAll = countBy(fresh, "first_seen"), newRole = countBy(fresh.filter(r => r.in_role), "first_seen");
  const vAll = days.map(d => newAll[d] || 0), vRole = days.map(d => newRole[d] || 0);
  add(sum(vAll) ? `${sum(vAll).toLocaleString()} new postings appeared, ${sum(vRole).toLocaleString()} of them in my role`
                : "No new postings yet — only the starting snapshot exists",
    "Postings first seen on each day. Postings that were already open when a source was first watched are left out, because their real start date is unknown.",
    el => Charts.bars(el, days, [{ name: "All postings", values: vAll }, { name: "My role", values: vRole }], { ariaLabel: "New postings per day" }));

  // 2. Removed postings per day
  const rem = countBy(rows.filter(r => r.removed_date), "removed_date");
  const vRem = days.map(d => rem[d] || 0);
  add(sum(vRem) ? `${sum(vRem).toLocaleString()} postings have been removed so far` : "No postings have been removed yet",
    "Postings whose source stopped listing them, counted on the day the removal was recorded. This includes postings that were open at the start.",
    el => Charts.bars(el, days, [{ name: "Removed", values: vRem }], { ariaLabel: "Removed postings per day" }));

  // 3. Open postings per employer
  const open = rows.filter(r => r.status === "open");
  const perEmp = Object.entries(countBy(open, "employer")).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  add(perEmp.length ? `${perEmp[0].label} has the most open postings (${perEmp[0].value.toLocaleString()})` : "No open postings",
    `${open.length.toLocaleString()} postings are open as of ${last}. Some employers are read with a search term (see README), so their counts are not the full board.`,
    el => Charts.hbars(el, perEmp, { ariaLabel: "Open postings per employer" }));

  // 4. Days open (removed, not first-run)
  const spans = rows.filter(r => r.removed_date && !r.first_run).map(r => JW.diffDays(r.removed_date, r.first_seen));
  const med = median(spans);
  const maxSpan = Math.max(0, ...spans), buckets = Math.min(maxSpan, 30);
  const hist = Array.from({ length: buckets + 1 }, () => 0);
  spans.forEach(s => hist[Math.min(s, buckets)]++);
  add(med === null ? "Not enough history yet to measure how long postings stay open" : `Postings stay open a median of ${med} day${med === 1 ? "" : "s"}`,
    med === null ? "This needs postings that were first seen after watching began and have since been removed."
                 : `Based on ${spans.length.toLocaleString()} removed postings that are not first-run postings: removed date minus first-seen date. The last bar groups ${buckets} days or more.`,
    el => spans.length ? Charts.bars(el, hist.map((_, i) => String(i)), [{ name: "Postings", values: hist }], { ariaLabel: "Days open distribution", rawLabels: true }) : (el.innerHTML = '<p class="empty">No data yet.</p>'));

  // 5. Share removed within seven days
  const cutoff = JW.addDays(last, -7);
  const eligible = rows.filter(r => !r.first_run && r.first_seen <= cutoff);
  const quick = eligible.filter(r => r.removed_date && JW.diffDays(r.removed_date, r.first_seen) <= 7);
  const share = eligible.length ? quick.length / eligible.length : null;
  add(share === null ? "Not enough history yet to measure quick removals" : `${Math.round(share * 100)}% of new postings are removed within seven days`,
    share === null ? "This needs postings first seen at least seven days before the last run."
                   : `Among ${eligible.length.toLocaleString()} postings that are not first-run postings and were first seen on or before ${cutoff}, ${quick.length.toLocaleString()} were removed within seven days of first being seen.`,
    el => share === null ? (el.innerHTML = '<p class="empty">No data yet.</p>')
      : Charts.hbars(el, [{ label: "Removed within 7 days", value: quick.length }, { label: "Still open or removed later", value: eligible.length - quick.length }], { ariaLabel: "Share removed within seven days" }));

  // 6. Top locations among open postings
  const locs = Object.entries(countBy(open.filter(r => r.location), "location")).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 12);
  add(locs.length ? `${locs[0].label} is the most common location (${locs[0].value.toLocaleString()} open postings)` : "No locations available",
    "The twelve most common locations among open postings, exactly as the employers list them.",
    el => Charts.hbars(el, locs, { ariaLabel: "Top locations", color: "var(--c3)" }));

  const root = document.getElementById("sections");
  sections.forEach((s, i) => {
    root.insertAdjacentHTML("beforeend", `<section class="card"><h2 data-sleigh>${["🎁","🫠","🧝","⏳","🛷","📍"][i]} ${i + 1}. ${esc(s.heading)}</h2><p class="muted">${esc(s.para)}</p><div class="chart" id="chart-${i}"></div></section>`);
    s.draw(document.getElementById(`chart-${i}`));
  });
})();

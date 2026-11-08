(async () => {
  const { esc, fmtTime } = JW;
  let status, rows;
  try { [status, rows] = await Promise.all([JW.loadStatus(), JW.loadHistory()]); }
  catch (e) { document.getElementById("last-run").textContent = "No data yet — the first daily run has not completed."; return; }

  const day = status.run_time.slice(0, 10);
  document.getElementById("last-run").textContent = `Last run: ${fmtTime(status.run_time)} (UTC date ${day})`;

  const stat = (n, l) => `<div class="stat"><div class="n">${n.toLocaleString()}</div><div class="l">${l}</div></div>`;
  document.getElementById("stats").innerHTML =
    stat(status.days_with_success, "days with a successful run") + stat(status.open, "open postings") +
    stat(status.new_today, "new today") + stat(status.removed_today, "removed today");

  const item = r => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><div class="muted">${esc(r.employer)}${r.location ? " · " + esc(r.location) : ""}</div></li>`;
  const fill = (id, list) => {
    const mine = list.filter(r => r.in_role), other = list.filter(r => !r.in_role);
    const el = document.getElementById(id);
    if (!list.length) { el.innerHTML = '<li class="empty">None in this run.</li>'; return; }
    el.innerHTML = (mine.length ? `<li><strong>In my role (${mine.length})</strong></li>` + mine.map(item).join("") : "") +
      `<li><strong>Everything else (${other.length})</strong></li>` + other.slice(0, 50).map(item).join("") +
      (other.length > 50 ? `<li class="muted">…and ${other.length - 50} more — see Browse → All postings.</li>` : "");
  };
  fill("new", rows.filter(r => r.first_seen === day && !r.first_run));
  fill("removed", rows.filter(r => r.removed_date === day));

  document.getElementById("sources").innerHTML = status.sources.map(s =>
    `<tr><td>${esc(s.name)}</td><td><span class="pill ${s.ok ? "ok" : "bad"}">${s.ok ? "ok" : "failed"}</span></td><td>${s.count.toLocaleString()}</td></tr>`).join("");
})();

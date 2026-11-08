(async () => {
  const { esc } = JW;
  const KEY = "jobwatcher.shortlist";
  const load = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch {} };
  const shortlist = load();

  let rows, status;
  try { [status, rows] = await Promise.all([JW.loadStatus(), JW.loadHistory()]); }
  catch (e) { document.getElementById("summary").textContent = "No data yet — the first daily run has not completed."; return; }

  const today = status.run_time.slice(0, 10);
  const open = rows.filter(r => r.status === "open");
  const state = { role: true, only: false, limit: 100 };
  const $ = id => document.getElementById(id);

  [...new Set(open.map(r => r.employer))].sort().forEach(e => $("employer").insertAdjacentHTML("beforeend", `<option>${esc(e)}</option>`));
  const locs = {}; open.forEach(r => { if (r.location) locs[r.location] = (locs[r.location] || 0) + 1; });
  $("locations").innerHTML = Object.keys(locs).sort((a, b) => locs[b] - locs[a]).slice(0, 300).map(l => `<option value="${esc(l)}">`).join("");

  function filtered() {
    const emp = $("employer").value, loc = $("location").value.trim().toLowerCase();
    const days = $("days").value, q = $("q").value.trim().toLowerCase();
    let out = open.filter(r => {
      if (state.role && !r.in_role) return false;
      if (state.only && !shortlist.has(r.posting_id)) return false;
      if (emp && r.employer !== emp) return false;
      if (loc && !r.location.toLowerCase().includes(loc)) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (days) {
        const d = JW.diffDays(today, r.first_seen);
        if (days === "31+" ? d <= 30 : d > Number(days)) return false;
      }
      return true;
    });
    const dir = $("sort").value === "new" ? -1 : 1;
    out.sort((a, b) => dir * a.first_seen.localeCompare(b.first_seen) || a.posting_id.localeCompare(b.posting_id));
    return out;
  }

  function render() {
    const out = filtered();
    $("summary").textContent = `${out.length.toLocaleString()} of ${open.length.toLocaleString()} open postings match.`;
    $("note").textContent = "Days open counts from the date this tool first saw a posting; postings already open on the first run are at least that old.";
    $("shortlist-count").textContent = shortlist.size;
    $("results").innerHTML = out.length ? out.slice(0, state.limit).map(r => {
      const d = JW.diffDays(today, r.first_seen), on = shortlist.has(r.posting_id);
      return `<div class="job"><button class="star" data-id="${esc(r.posting_id)}" aria-pressed="${on}" aria-label="${on ? "Remove from" : "Add to"} shortlist">${on ? "★" : "☆"}</button>
        <div><div class="t">${esc(r.title)}</div><div class="muted">${esc(r.employer)}${r.location ? " · " + esc(r.location) : ""} · first seen ${esc(r.first_seen)} (${d} day${d === 1 ? "" : "s"} open${r.first_run ? "+" : ""})</div></div>
        <a class="apply" href="${esc(r.url)}" target="_blank" rel="noopener">Apply</a></div>`;
    }).join("") : '<p class="empty">No postings match these filters.</p>';
    $("more").hidden = out.length <= state.limit;
  }

  const rerender = () => { state.limit = 100; render(); };
  ["employer", "location", "days", "q", "sort"].forEach(id => $(id).addEventListener("input", rerender));
  const scope = role => { state.role = role; $("scope-role").setAttribute("aria-pressed", role); $("scope-all").setAttribute("aria-pressed", !role); rerender(); };
  $("scope-role").onclick = () => scope(true); $("scope-all").onclick = () => scope(false);
  $("shortlist-only").onclick = e => { state.only = !state.only; e.currentTarget.setAttribute("aria-pressed", state.only); rerender(); };
  $("more").onclick = () => { state.limit += 100; render(); };
  $("results").addEventListener("click", e => {
    const b = e.target.closest(".star"); if (!b) return;
    const id = b.dataset.id; shortlist.has(id) ? shortlist.delete(id) : shortlist.add(id);
    save(shortlist); render();
  });
  render();
})();
